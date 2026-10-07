//! WASAPI render-device loopback — captures the Windows mix (system audio)
//! without opening Chromium's getDisplayMedia picker.
//!
//! Not used for voice-call screen share: there is no process-tree exclusion yet,
//! so loopback would retransmit call audio. Screen share audio stays on native
//! getDisplayMedia (+ restrictOwnAudio) or video-only fallback.

use base64::{engine::general_purpose::STANDARD as B64, Engine};
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};
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
static DESKTOP_AUDIO_GEN: AtomicU64 = AtomicU64::new(0);

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

pub fn stop_excluding_self() {
    DESKTOP_AUDIO_GEN.fetch_add(1, Ordering::SeqCst);
}

/// Captures the render mix except this process tree. Local playback is unchanged.
pub fn start_excluding_self(app: AppHandle) -> Result<LoopbackInfo, String> {
    let generation = DESKTOP_AUDIO_GEN.fetch_add(1, Ordering::SeqCst) + 1;
    let (tx, rx) = std::sync::mpsc::channel();
    std::thread::Builder::new()
        .name("desktop-audio-exclude".into())
        .spawn(move || {
            if let Err(err) = run_excluding_self(app, generation, &tx) {
                let _ = tx.send(Err(err));
            }
        })
        .map_err(|e| format!("Falha ao iniciar o audio de desktop: {e}"))?;

    rx.recv_timeout(Duration::from_secs(4))
        .map_err(|_| "Timeout ao iniciar o audio de desktop.".to_string())?
}

fn run_excluding_self(
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
            unsafe { CoUninitialize(); }
        }
    }
    let _com = ComGuard;

    let client = activate_excluding_self()?;
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
    unsafe { CoTaskMemFree(Some(pwfx.cast())); }
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
        if DESKTOP_AUDIO_GEN.load(Ordering::SeqCst) != generation {
            break;
        }
        unsafe {
            match drain_packets(&app, &capture, channels, sample_rate, block_align, kind) {
                Ok(()) => {}
                Err(err) => {
                    eprintln!("[desktop-audio] Falha no loopback por processo: {err}");
                    break;
                }
            }
        }
        std::thread::sleep(Duration::from_millis(8));
    }

    unsafe { let _ = client.Stop(); }
    Ok(())
}

fn activate_excluding_self() -> Result<IAudioClient, String> {
    use std::sync::atomic::AtomicU32;
    use std::sync::Mutex;
    use windows::core::{Interface, GUID, HRESULT, IUnknown};
    use windows::Win32::Media::Audio::{
        ActivateAudioInterfaceAsync,
        IActivateAudioInterfaceCompletionHandler, IActivateAudioInterfaceCompletionHandler_Vtbl,
        AUDIOCLIENT_ACTIVATION_PARAMS, AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK,
        AUDIOCLIENT_PROCESS_LOOPBACK_PARAMS, PROCESS_LOOPBACK_MODE_EXCLUDE_TARGET_PROCESS_TREE,
        VIRTUAL_AUDIO_DEVICE_PROCESS_LOOPBACK,
    };

    #[repr(C)]
    struct ActivationBlob {
        vt: u16,
        reserved1: u16,
        reserved2: u16,
        reserved3: u16,
        size: u32,
        data: *const AUDIOCLIENT_ACTIVATION_PARAMS,
    }

    #[repr(C)]
    struct Handler {
        vtbl: *const IActivateAudioInterfaceCompletionHandler_Vtbl,
        ref_count: AtomicU32,
        tx: Mutex<Option<std::sync::mpsc::Sender<()>>>,
    }

    unsafe extern "system" fn query_interface(
        this: *mut std::ffi::c_void,
        iid: *const GUID,
        out: *mut *mut std::ffi::c_void,
    ) -> HRESULT {
        if iid.is_null() || out.is_null() {
            return HRESULT(0x8000_4003u32 as i32);
        }
        let iid = unsafe { *iid };
        let iunknown = GUID::from_u128(0x0000_0000_0000_0000_c000_0000_0000_0046);
        let handler = <IActivateAudioInterfaceCompletionHandler as Interface>::IID;
        if iid == iunknown || iid == handler {
            unsafe {
                *out = this;
                add_ref(this);
            }
            HRESULT(0)
        } else {
            unsafe { *out = std::ptr::null_mut(); }
            HRESULT(0x8000_4002u32 as i32)
        }
    }

    unsafe extern "system" fn add_ref(this: *mut std::ffi::c_void) -> u32 {
        let handler = unsafe { &*(this as *const Handler) };
        handler.ref_count.fetch_add(1, Ordering::SeqCst) + 1
    }

    unsafe extern "system" fn release(this: *mut std::ffi::c_void) -> u32 {
        let handler = unsafe { &*(this as *const Handler) };
        let next = handler.ref_count.fetch_sub(1, Ordering::SeqCst) - 1;
        if next == 0 {
            unsafe { drop(Box::from_raw(this as *mut Handler)); }
        }
        next
    }

    unsafe extern "system" fn activate_completed(
        this: *mut std::ffi::c_void,
        _operation: *mut std::ffi::c_void,
    ) -> HRESULT {
        let handler = unsafe { &*(this as *const Handler) };
        if let Some(tx) = handler.tx.lock().ok().and_then(|mut slot| slot.take()) {
            let _ = tx.send(());
        }
        HRESULT(0)
    }

    static VTBL: IActivateAudioInterfaceCompletionHandler_Vtbl =
        IActivateAudioInterfaceCompletionHandler_Vtbl {
            base__: windows::core::IUnknown_Vtbl {
                QueryInterface: query_interface,
                AddRef: add_ref,
                Release: release,
            },
            ActivateCompleted: activate_completed,
        };

    let params = AUDIOCLIENT_ACTIVATION_PARAMS {
        ActivationType: AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK,
        Anonymous: windows::Win32::Media::Audio::AUDIOCLIENT_ACTIVATION_PARAMS_0 {
            ProcessLoopbackParams: AUDIOCLIENT_PROCESS_LOOPBACK_PARAMS {
                TargetProcessId: std::process::id(),
                ProcessLoopbackMode: PROCESS_LOOPBACK_MODE_EXCLUDE_TARGET_PROCESS_TREE,
            },
        },
    };
    let blob = ActivationBlob {
        vt: 65, // VT_BLOB
        reserved1: 0,
        reserved2: 0,
        reserved3: 0,
        size: std::mem::size_of::<AUDIOCLIENT_ACTIVATION_PARAMS>() as u32,
        data: &params,
    };

    let (ready_tx, ready_rx) = std::sync::mpsc::channel();
    let handler = Box::new(Handler {
        vtbl: &VTBL,
        ref_count: AtomicU32::new(1),
        tx: Mutex::new(Some(ready_tx)),
    });
    let raw = Box::into_raw(handler);
    let handler_iface = unsafe {
        IActivateAudioInterfaceCompletionHandler::from_raw(raw as *mut std::ffi::c_void)
    };

    let operation = unsafe {
        ActivateAudioInterfaceAsync(
            VIRTUAL_AUDIO_DEVICE_PROCESS_LOOPBACK,
            &IAudioClient::IID,
            Some(&blob as *const ActivationBlob as *const windows::core::PROPVARIANT),
            &handler_iface,
        )
        .map_err(|e| format!("ActivateAudioInterfaceAsync: {e}"))?
    };

    ready_rx
        .recv_timeout(Duration::from_secs(3))
        .map_err(|_| "Timeout ao ativar o loopback por processo.".to_string())?;

    let mut activate_hr = HRESULT(0);
    let mut unknown: Option<IUnknown> = None;
    unsafe {
        operation
            .GetActivateResult(&mut activate_hr, &mut unknown)
            .map_err(|e| format!("GetActivateResult: {e}"))?;
    }
    if activate_hr.is_err() {
        drop(handler_iface);
        return Err(format!("Loopback por processo recusado: {activate_hr}"));
    }
    let unknown = unknown.ok_or_else(|| "Loopback por processo nao retornou cliente.".to_string())?;
    let client: IAudioClient = unknown
        .cast()
        .map_err(|e| format!("IAudioClient: {e}"))?;
    drop(handler_iface);
    Ok(client)
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

pub fn stop_level_meter() {
    LEVEL_METER_GEN.fetch_add(1, Ordering::SeqCst);
}

/// Mede o áudio que o PC toca (exceto este processo, quando o Windows suporta) e emite
/// ~30 Hz `overlay:audio-level` SÓ para a janela do overlay (RMS, pico, 3 bandas e batida).
/// Substitui qualquer medição anterior (nova geração).
pub fn start_level_meter(app: AppHandle) -> Result<(), String> {
    let generation = LEVEL_METER_GEN.fetch_add(1, Ordering::SeqCst) + 1;
    std::thread::Builder::new()
        .name("overlay-audio-level".into())
        .spawn(move || {
            if let Err(err) = run_level_meter(app, generation) {
                eprintln!("[audio-level] {err}");
            }
        })
        .map(|_| ())
        .map_err(|e| format!("Falha ao iniciar o medidor de audio: {e}"))
}

fn pcm_kind(kind: SampleKind) -> PcmKind {
    match kind {
        SampleKind::F32 => PcmKind::F32,
        SampleKind::I16 => PcmKind::I16,
        SampleKind::I32 => PcmKind::I32,
    }
}

/// Loopback clássico do dispositivo de saída padrão (ouve tudo, inclusive este app);
/// usado só se a captura "exceto este processo" não estiver disponível.
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

    let client = match activate_excluding_self() {
        Ok(client) => client,
        Err(err) => {
            eprintln!("[audio-level] captura por processo indisponivel ({err}); usando loopback classico");
            default_render_client()?
        }
    };
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
