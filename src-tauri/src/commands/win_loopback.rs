//! WASAPI render-device loopback — captures the Windows mix (system audio)
//! without opening Chromium's getDisplayMedia picker.
//!
//! Not used for voice-call screen share: there is no process-tree exclusion yet,
//! so loopback would retransmit call audio. Screen share audio stays on native
//! getDisplayMedia (+ restrictOwnAudio) or video-only fallback.

use base64::{engine::general_purpose::STANDARD as B64, Engine};
use serde_json::json;
use std::sync::atomic::{AtomicBool, AtomicU64, AtomicUsize, Ordering};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};
use windows::core::GUID;
use windows::Win32::Media::Audio::{
    eConsole, eRender, IAudioCaptureClient, IAudioClient, IMMDeviceEnumerator, MMDeviceEnumerator,
    AUDCLNT_SHAREMODE_SHARED, AUDCLNT_STREAMFLAGS_LOOPBACK, WAVEFORMATEX, WAVEFORMATEXTENSIBLE,
};
use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CoTaskMemFree, CoUninitialize, CLSCTX_ALL,
    COINIT_MULTITHREADED,
};

use super::ScreenCaptureState;

const WAVE_FORMAT_PCM: u16 = 1;
const WAVE_FORMAT_IEEE_FLOAT: u16 = 3;
const WAVE_FORMAT_EXTENSIBLE: u16 = 0xFFFE;
const AUDCLNT_BUFFERFLAGS_SILENT: u32 = 0x2;
const SUBTYPE_IEEE_FLOAT: GUID = GUID::from_values(
    0x0000_0003,
    0x0000,
    0x0010,
    [0x80, 0x00, 0x00, 0xaa, 0x00, 0x38, 0x9b, 0x71],
);

#[derive(Clone, Copy)]
enum SampleKind {
    F32,
    I16,
    I32,
}

#[derive(Clone, Copy)]
pub struct LoopbackInfo {
    pub sample_rate: u32,
    pub channels: u16,
}

pub fn start(app: AppHandle, generation: u64) -> Result<LoopbackInfo, String> {
    let (tx, rx) = std::sync::mpsc::channel();
    std::thread::Builder::new()
        .name("screen-share-audio".into())
        .spawn(move || {
            if let Err(err) = run_loopback(app, generation, &tx) {
                let _ = tx.send(Err(err));
            }
        })
        .map_err(|e| format!("Falha ao iniciar captura de audio: {e}"))?;

    rx.recv_timeout(Duration::from_secs(3))
        .map_err(|_| "Timeout ao iniciar o audio do sistema.".to_string())?
}

fn run_loopback(
    app: AppHandle,
    generation: u64,
    tx: &std::sync::mpsc::Sender<Result<LoopbackInfo, String>>,
) -> Result<(), String> {
    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
    }
    struct ComGuard;
    impl Drop for ComGuard {
        fn drop(&mut self) {
            unsafe {
                CoUninitialize();
            }
        }
    }
    let _com = ComGuard;

    let enumerator: IMMDeviceEnumerator = unsafe {
        CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)
            .map_err(|e| format!("MMDeviceEnumerator: {e}"))?
    };
    let device = unsafe {
        enumerator
            .GetDefaultAudioEndpoint(eRender, eConsole)
            .map_err(|e| format!("GetDefaultAudioEndpoint: {e}"))?
    };
    let client: IAudioClient = unsafe {
        device
            .Activate(CLSCTX_ALL, None)
            .map_err(|e| format!("Activate IAudioClient: {e}"))?
    };

    let pwfx = unsafe {
        client
            .GetMixFormat()
            .map_err(|e| format!("GetMixFormat: {e}"))?
    };
    if pwfx.is_null() {
        return Err("Mix format nulo.".into());
    }

    let wfx = unsafe { *pwfx };
    let channels = wfx.nChannels.max(1);
    let sample_rate = wfx.nSamplesPerSec.max(8000);
    let bits = wfx.wBitsPerSample;
    let block_align = wfx.nBlockAlign.max(1);
    let kind = unsafe { detect_kind(pwfx, bits) };

    let init = unsafe {
        client.Initialize(
            AUDCLNT_SHAREMODE_SHARED,
            AUDCLNT_STREAMFLAGS_LOOPBACK,
            1_000_000,
            0,
            pwfx,
            None,
        )
    };
    unsafe {
        CoTaskMemFree(Some(pwfx.cast()));
    }
    init.map_err(|e| format!("IAudioClient::Initialize: {e}"))?;

    let capture: IAudioCaptureClient = unsafe {
        client
            .GetService()
            .map_err(|e| format!("GetService IAudioCaptureClient: {e}"))?
    };

    unsafe {
        client
            .Start()
            .map_err(|e| format!("IAudioClient::Start: {e}"))?;
    }

    let _ = tx.send(Ok(LoopbackInfo {
        sample_rate,
        channels,
    }));

    loop {
        let Some(state) = app.try_state::<ScreenCaptureState>() else {
            break;
        };
        let still_active = *state.active.lock()
            && state.generation.load(Ordering::SeqCst) == generation;
        drop(state);
        if !still_active {
            break;
        }

        unsafe {
            match drain_packets(
                &app,
                &capture,
                channels,
                sample_rate,
                block_align,
                kind,
            ) {
                Ok(()) => {}
                Err(err) => {
                    eprintln!("[screen-share] Falha no loopback WASAPI: {err}");
                    break;
                }
            }
        }
        std::thread::sleep(Duration::from_millis(8));
    }

    unsafe {
        let _ = client.Stop();
    }
    Ok(())
}

unsafe fn detect_kind(pwfx: *mut WAVEFORMATEX, bits: u16) -> SampleKind {
    let tag = (*pwfx).wFormatTag;
    if tag == WAVE_FORMAT_IEEE_FLOAT {
        return SampleKind::F32;
    }
    if tag == WAVE_FORMAT_PCM {
        return if bits >= 32 {
            SampleKind::I32
        } else {
            SampleKind::I16
        };
    }
    if tag == WAVE_FORMAT_EXTENSIBLE && (*pwfx).cbSize >= 22 {
        let ext = pwfx.cast::<WAVEFORMATEXTENSIBLE>();
        let subtype = std::ptr::addr_of!((*ext).SubFormat).read_unaligned();
        if subtype == SUBTYPE_IEEE_FLOAT {
            return SampleKind::F32;
        }
        return if bits >= 32 {
            SampleKind::I32
        } else {
            SampleKind::I16
        };
    }
    SampleKind::F32
}

unsafe fn drain_packets(
    app: &AppHandle,
    capture: &IAudioCaptureClient,
    channels: u16,
    sample_rate: u32,
    block_align: u16,
    kind: SampleKind,
) -> Result<(), String> {
    let mut packet = match capture.GetNextPacketSize() {
        Ok(size) => size,
        Err(err) => return Err(format!("GetNextPacketSize: {err}")),
    };

    while packet > 0 {
        let mut data: *mut u8 = std::ptr::null_mut();
        let mut frames: u32 = 0;
        let mut flags: u32 = 0;
        capture
            .GetBuffer(
                &mut data,
                &mut frames,
                &mut flags,
                None,
                None,
            )
            .map_err(|e| format!("GetBuffer: {e}"))?;

        if frames > 0 {
            let silent = flags & AUDCLNT_BUFFERFLAGS_SILENT != 0;
            let pcm = if silent || data.is_null() {
                vec![0u8; frames as usize * channels as usize * 2]
            } else {
                let bytes = std::slice::from_raw_parts(
                    data,
                    frames as usize * block_align as usize,
                );
                to_s16le(bytes, frames, channels, kind)
            };
            let _ = app.emit(
                "screen-share:audio",
                json!({
                    "pcm": B64.encode(&pcm),
                    "sampleRate": sample_rate,
                    "channels": channels,
                    "format": "s16le",
                }),
            );
        }

        let _ = capture.ReleaseBuffer(frames);
        packet = capture
            .GetNextPacketSize()
            .map_err(|e| format!("GetNextPacketSize: {e}"))?;
    }
    Ok(())
}

fn to_s16le(bytes: &[u8], frames: u32, channels: u16, kind: SampleKind) -> Vec<u8> {
    let samples = frames as usize * channels as usize;
    let mut out = vec![0u8; samples * 2];
    match kind {
        SampleKind::F32 => {
            for i in 0..samples {
                let start = i * 4;
                if start + 4 > bytes.len() {
                    break;
                }
                let value = f32::from_le_bytes([
                    bytes[start],
                    bytes[start + 1],
                    bytes[start + 2],
                    bytes[start + 3],
                ]);
                let s = (value.clamp(-1.0, 1.0) * 32767.0).round() as i16;
                out[i * 2..i * 2 + 2].copy_from_slice(&s.to_le_bytes());
            }
        }
        SampleKind::I16 => {
            let copy = (samples * 2).min(bytes.len()).min(out.len());
            out[..copy].copy_from_slice(&bytes[..copy]);
        }
        SampleKind::I32 => {
            for i in 0..samples {
                let start = i * 4;
                if start + 4 > bytes.len() {
                    break;
                }
                let value = i32::from_le_bytes([
                    bytes[start],
                    bytes[start + 1],
                    bytes[start + 2],
                    bytes[start + 3],
                ]);
                let s = (value >> 16) as i16;
                out[i * 2..i * 2 + 2].copy_from_slice(&s.to_le_bytes());
            }
        }
    }
    out
}

// ───────────────────────── medidor de nível (mascote) ─────────────────────────

use crate::commands::audio_analysis::{pcm_to_mono_f32, Analyzer, LevelFrame, PcmKind};

/// Geração própria: não colide com `DESKTOP_AUDIO_GEN` (compartilhamento de tela da chamada).
static LEVEL_METER_GEN: AtomicU64 = AtomicU64::new(0);

/// Quantas janelas (hub e overlay têm cada uma o seu notch) pediram o medidor. Sem contagem,
/// o `stop` de uma janela derrubava o medidor da outra e a Pherie perdia o áudio no meio da música.
static LEVEL_METER_USERS: AtomicUsize = AtomicUsize::new(0);
/// Já existe uma thread cuidando do medidor.
static LEVEL_METER_RUNNING: AtomicBool = AtomicBool::new(false);

/// Libera um pedido do medidor; a medição só para quando ninguém mais precisa dela.
pub fn stop_level_meter() {
    let prev = LEVEL_METER_USERS
        .fetch_update(Ordering::SeqCst, Ordering::SeqCst, |n| Some(n.saturating_sub(1)))
        .unwrap_or(0);
    if prev <= 1 {
        LEVEL_METER_GEN.fetch_add(1, Ordering::SeqCst);
    }
}

/// Mede o áudio que o PC toca (exceto este processo, quando o Windows suporta) e emite
/// ~30 Hz `overlay:audio-level` (RMS, pico, 3 bandas e batida). Vários pedidos compartilham a
/// mesma medição; se ela cair por erro (troca de dispositivo, etc.), a thread tenta de novo.
pub fn start_level_meter(app: AppHandle) -> Result<(), String> {
    LEVEL_METER_USERS.fetch_add(1, Ordering::SeqCst);
    if LEVEL_METER_RUNNING.swap(true, Ordering::SeqCst) {
        return Ok(());
    }
    std::thread::Builder::new()
        .name("overlay-audio-level".into())
        .spawn(move || loop {
            while LEVEL_METER_USERS.load(Ordering::SeqCst) > 0 {
                let generation = LEVEL_METER_GEN.load(Ordering::SeqCst);
                if let Err(err) = run_level_meter(app.clone(), generation) {
                    eprintln!("[audio-level] {err}");
                    std::thread::sleep(Duration::from_millis(600));
                } else if LEVEL_METER_USERS.load(Ordering::SeqCst) > 0
                    && LEVEL_METER_GEN.load(Ordering::SeqCst) != generation
                {
                    // alguém pediu de novo logo depois de o último parar: segue com a nova geração
                    continue;
                } else {
                    std::thread::sleep(Duration::from_millis(300));
                }
            }
            LEVEL_METER_RUNNING.store(false, Ordering::SeqCst);
            // pedido que chegou entre o último teste e o fim da thread: reassume
            if LEVEL_METER_USERS.load(Ordering::SeqCst) == 0 || LEVEL_METER_RUNNING.swap(true, Ordering::SeqCst) {
                break;
            }
        })
        .map(|_| ())
        .map_err(|e| {
            LEVEL_METER_RUNNING.store(false, Ordering::SeqCst);
            format!("Falha ao iniciar o medidor de audio: {e}")
        })
}

fn pcm_kind(kind: SampleKind) -> PcmKind {
    match kind {
        SampleKind::F32 => PcmKind::F32,
        SampleKind::I16 => PcmKind::I16,
        SampleKind::I32 => PcmKind::I32,
    }
}

/// Loopback clássico do dispositivo de saída padrão (ouve tudo, inclusive este app).
fn default_render_client() -> Result<IAudioClient, String> {
    let enumerator: IMMDeviceEnumerator = unsafe {
        CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)
            .map_err(|e| format!("MMDeviceEnumerator: {e}"))?
    };
    let device = unsafe {
        enumerator
            .GetDefaultAudioEndpoint(eRender, eConsole)
            .map_err(|e| format!("GetDefaultAudioEndpoint: {e}"))?
    };
    unsafe {
        device
            .Activate(CLSCTX_ALL, None)
            .map_err(|e| format!("Activate IAudioClient: {e}"))
    }
}

fn run_level_meter(app: AppHandle, generation: u64) -> Result<(), String> {
    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
    }
    struct ComGuard;
    impl Drop for ComGuard {
        fn drop(&mut self) {
            unsafe { CoUninitialize(); }
        }
    }
    let _com = ComGuard;

    // O medidor ouve o mix do dispositivo padrão. Antes tentava a captura "sem este app" e caía aqui sempre (a ativação
    // antiga nunca funcionou: handler sem IAgileObject); o comportamento efetivo é este.
    let client = default_render_client()?;
    let pwfx = unsafe { client.GetMixFormat().map_err(|e| format!("GetMixFormat: {e}"))? };
    if pwfx.is_null() {
        return Err("Mix format nulo.".into());
    }
    let wfx = unsafe { *pwfx };
    let channels = wfx.nChannels.max(1);
    let sample_rate = wfx.nSamplesPerSec.max(8000);
    let block_align = wfx.nBlockAlign.max(1);
    let kind = unsafe { detect_kind(pwfx, wfx.wBitsPerSample) };

    let init = unsafe {
        client.Initialize(AUDCLNT_SHAREMODE_SHARED, AUDCLNT_STREAMFLAGS_LOOPBACK, 1_000_000, 0, pwfx, None)
    };
    unsafe { CoTaskMemFree(Some(pwfx.cast())); }
    init.map_err(|e| format!("IAudioClient::Initialize: {e}"))?;

    let capture: IAudioCaptureClient = unsafe {
        client.GetService().map_err(|e| format!("GetService IAudioCaptureClient: {e}"))?
    };
    unsafe { client.Start().map_err(|e| format!("IAudioClient::Start: {e}"))?; }

    let mut analyzer = Analyzer::new(sample_rate, 33);
    let mut frames_out: Vec<LevelFrame> = Vec::with_capacity(8);

    loop {
        if LEVEL_METER_GEN.load(Ordering::SeqCst) != generation {
            break;
        }
        let drained = unsafe {
            drain_levels(&app, &capture, channels, block_align, pcm_kind(kind), &mut analyzer, &mut frames_out)
        };
        if let Err(err) = drained {
            eprintln!("[audio-level] Falha no loopback: {err}");
            break;
        }
        std::thread::sleep(Duration::from_millis(8));
    }

    unsafe { let _ = client.Stop(); }
    Ok(())
}

unsafe fn drain_levels(
    app: &AppHandle,
    capture: &IAudioCaptureClient,
    channels: u16,
    block_align: u16,
    kind: PcmKind,
    analyzer: &mut Analyzer,
    frames_out: &mut Vec<LevelFrame>,
) -> Result<(), String> {
    let mut packet = capture
        .GetNextPacketSize()
        .map_err(|e| format!("GetNextPacketSize: {e}"))?;
    while packet > 0 {
        let mut data: *mut u8 = std::ptr::null_mut();
        let mut frames: u32 = 0;
        let mut flags: u32 = 0;
        capture
            .GetBuffer(&mut data, &mut frames, &mut flags, None, None)
            .map_err(|e| format!("GetBuffer: {e}"))?;

        if frames > 0 {
            let silent = flags & AUDCLNT_BUFFERFLAGS_SILENT != 0;
            let mono = if silent || data.is_null() {
                vec![0.0f32; frames as usize]
            } else {
                let bytes = std::slice::from_raw_parts(data, frames as usize * block_align as usize);
                pcm_to_mono_f32(bytes, frames as usize, channels as usize, kind)
            };
            analyzer.push(&mono, frames_out);
        }

        let _ = capture.ReleaseBuffer(frames);
        packet = capture
            .GetNextPacketSize()
            .map_err(|e| format!("GetNextPacketSize: {e}"))?;
    }

    for frame in frames_out.drain(..) {
        let payload = json!({
            "rms": frame.rms,
            "peak": frame.peak,
            "low": frame.low,
            "mid": frame.mid,
            "high": frame.high,
            "beat": frame.beat,
        });
        // Emite para todas as janelas e webviews (overlay e launcher principal).
        let _ = app.emit("overlay:audio-level", payload);
    }
    Ok(())
}

