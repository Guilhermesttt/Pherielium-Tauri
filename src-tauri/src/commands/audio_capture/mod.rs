//! Captura de áudio do compartilhamento de tela, sem a voz da call.
//!
//! O problema: capturar o loopback do dispositivo inteiro retransmite a voz das
//! pessoas da chamada para quem assiste. A solução é o *process loopback* do
//! Windows, que captura o desktop **excluindo** o Pherielium (e seus filhos, o
//! WebView2 incluso) ou **só** um jogo.
//!
//! Camadas:
//! - `source`  — modos, estratégias e a escolha entre elas (tabela, testada).
//! - `session` — threads, ring lock-free, `Drop` e máquina de estados (testada).
//! - `win`     — a captura WASAPI de verdade (todo o `unsafe`).
//! - `packet`  — o formato binário que segue ao front.

pub mod diag;
pub mod error;
pub mod format;
pub mod ipc;
pub mod packet;
pub mod ring;
pub mod session;
pub mod source;

#[cfg(target_os = "windows")]
pub mod win;

#[cfg(debug_assertions)]
mod wav;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

pub use error::AudioCaptureError;
pub use session::CaptureManager;
use source::{select, AudioCaptureSource, CaptureMode, Capability, Selection, Strategy};

/// Cria a fonte da estratégia escolhida.
///
/// O PID do jogo vem de `selection`, que o monta a partir do rastreador interno
/// do hub — nenhum comando recebe PID ou caminho do front.
#[cfg(target_os = "windows")]
pub fn build_source(
    selection: Selection,
) -> Result<Box<dyn AudioCaptureSource>, AudioCaptureError> {
    use win::{LoopbackScope, ProcessLoopbackSource, SystemLoopbackSource};
    Ok(match selection.strategy {
        Strategy::ExcludeOwnProcessTree => Box::new(ProcessLoopbackSource::new(
            LoopbackScope::ExcludeTree(std::process::id()),
        )),
        Strategy::IncludeTargetProcessTree => Box::new(ProcessLoopbackSource::new(
            LoopbackScope::IncludeTree(selection.pid.ok_or(AudioCaptureError::NoTrackedGame)?),
        )),
        Strategy::SystemLoopback => Box::new(SystemLoopbackSource),
    })
}

#[cfg(not(target_os = "windows"))]
pub fn build_source(
    _selection: Selection,
) -> Result<Box<dyn AudioCaptureSource>, AudioCaptureError> {
    Err(AudioCaptureError::PlatformUnsupported)
}

#[cfg(target_os = "windows")]
fn probe() -> Capability {
    win::probe_capability()
}

#[cfg(not(target_os = "windows"))]
fn probe() -> Capability {
    Capability::ActivationFailed { hresult: 0x8000_4001 }
}

/// O Windows consegue capturar áudio por processo nesta máquina?
///
/// O front usa isto para decidir se oferece "Áudio do sistema (sem a call)" ou
/// explica por que não dá. Roda numa thread própria (a ativação espera o COM).
/// Modo do compartilhamento de tela: o desktop inteiro MENOS este app (a voz da chamada não volta no stream).
/// É o mesmo contrato do caminho antigo (`win_loopback`), para não mudar o que o espectador ouve.
const SCREEN_SHARE_MODE: CaptureMode = CaptureMode::ExcludeSelf;

/// Liga/desliga o diagnóstico do áudio de desktop (flag `pherielium_stream_debug` do front). Só observa.
#[tauri::command]
pub fn stream_debug_set(enabled: bool) {
    diag::set_stream_debug(enabled);
}

#[cfg(target_os = "windows")]
fn windows_build_for_diag() -> Option<u32> {
    win::windows_build()
}

#[cfg(not(target_os = "windows"))]
fn windows_build_for_diag() -> Option<u32> {
    None
}

/// Troca um erro genérico de ativação por `UnsupportedBuild` quando o build do Windows é anterior ao mínimo oficial.
#[cfg(target_os = "windows")]
fn explain_failure(err: AudioCaptureError) -> AudioCaptureError {
    if matches!(err, AudioCaptureError::ActivationFailed { .. } | AudioCaptureError::Windows { .. }) {
        if let Some(found) = win::windows_build() {
            if found < source::MIN_PROCESS_LOOPBACK_BUILD {
                return AudioCaptureError::UnsupportedBuild { found, required: source::MIN_PROCESS_LOOPBACK_BUILD };
            }
        }
    }
    err
}

#[cfg(not(target_os = "windows"))]
fn explain_failure(err: AudioCaptureError) -> AudioCaptureError {
    err
}

fn start_desktop_audio(app: &AppHandle) -> Result<serde_json::Value, AudioCaptureError> {
    use serde_json::json;
    diag::diag(
        app,
        "start",
        json!({
            "path": "audio_capture",
            "mode": "exclude_self",
            "targetPid": std::process::id(),
            "windowsBuild": windows_build_for_diag(),
        }),
    );

    // A ativação decide se o process loopback funciona; a sonda separada só serve para explicar a falha (`explain_failure`).
    let selection = select(SCREEN_SHARE_MODE, Capability::Supported, None)?;
    let source = build_source(selection)?;

    let sink_app = app.clone();
    let sink: session::PacketSink = Box::new(move |raw| match ipc::packet_to_event_payload(&raw) {
        // `false` encerra a sessão: a janela principal não existe mais.
        Ok(payload) => sink_app.emit_to("main", ipc::AUDIO_EVENT, payload).is_ok(),
        Err(err) => {
            eprintln!("[desktop-audio] pacote inválido descartado: {err:?}");
            true
        }
    });

    match app.state::<CaptureManager>().start(source, sink) {
        Ok(()) => {
            diag::diag(app, "result", json!({ "ok": true }));
            Ok(json!({
                "active": true,
                "sampleRate": format::SAMPLE_RATE,
                "channels": format::CHANNELS,
                "excludeProcess": true,
            }))
        }
        Err(err) => {
            let err = explain_failure(err);
            diag::diag(app, "result", json!({ "ok": false, "code": err.code(), "error": err.to_string() }));
            Err(err)
        }
    }
}

/// Inicia a captura do áudio do desktop (sem o app) e passa a emitir `screen-share:audio` para a janela principal.
#[tauri::command]
pub async fn desktop_audio_start(app: AppHandle) -> Result<serde_json::Value, AudioCaptureError> {
    tauri::async_runtime::spawn_blocking(move || start_desktop_audio(&app))
        .await
        .map_err(|e| AudioCaptureError::Thread(e.to_string()))?
}

/// Para a captura. Idempotente: sem sessão ativa também devolve sucesso.
#[tauri::command]
pub async fn desktop_audio_stop(app: AppHandle) -> Result<serde_json::Value, AudioCaptureError> {
    tauri::async_runtime::spawn_blocking(move || {
        if let Some(report) = app.state::<CaptureManager>().stop() {
            diag::diag(&app, "stop", serde_json::json!({ "packets": report.packets }));
        }
        Ok(serde_json::json!({ "active": false }))
    })
    .await
    .map_err(|e| AudioCaptureError::Thread(e.to_string()))?
}

#[tauri::command]
pub async fn desktop_audio_capabilities() -> Capability {
    tauri::async_runtime::spawn_blocking(probe)
        .await
        .unwrap_or(Capability::ActivationFailed { hresult: 0x8000_4005 })
}

// ── Diagnóstico de desenvolvimento ──────────────────────────────────────────

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SelfTestReport {
    pub strategy: &'static str,
    pub wav_path: String,
    pub seconds: f32,
    pub packets: u64,
    pub samples: usize,
    /// Pico (0..1) e RMS do que foi capturado: 0 = silêncio total.
    pub peak: f32,
    pub rms: f32,
    pub overrun_samples: u64,
    pub read_timeouts: u64,
    pub ended_with: Option<AudioCaptureError>,
}

fn strategy_name(strategy: Strategy) -> &'static str {
    match strategy {
        Strategy::ExcludeOwnProcessTree => "exclude_own_process_tree",
        Strategy::IncludeTargetProcessTree => "include_target_process_tree",
        Strategy::SystemLoopback => "system_loopback",
    }
}

/// Grava alguns segundos do que a captura enxerga em um WAV e devolve as
/// medidas. É como o recorte é validado SEM o front: com uma call aberta e um
/// vídeo tocando, o arquivo deve ter o vídeo e NÃO ter a voz da call.
///
/// Só existe em build de desenvolvimento, e o destino do arquivo é fixo (pasta
/// de dados do app): o front não escolhe caminho nenhum.
#[tauri::command]
pub async fn desktop_audio_selftest(
    mode: CaptureMode,
    seconds: u32,
) -> Result<SelfTestReport, AudioCaptureError> {
    #[cfg(debug_assertions)]
    {
        tauri::async_runtime::spawn_blocking(move || selftest(mode, seconds))
            .await
            .map_err(|e| AudioCaptureError::Thread(e.to_string()))?
    }
    #[cfg(not(debug_assertions))]
    {
        let _ = (mode, seconds);
        Err(AudioCaptureError::DebugOnly)
    }
}

#[cfg(debug_assertions)]
fn selftest(mode: CaptureMode, seconds: u32) -> Result<SelfTestReport, AudioCaptureError> {
    use parking_lot::Mutex;
    use session::{CaptureSession, PacketSink};
    use std::sync::Arc;
    use std::time::Duration;

    let seconds = seconds.clamp(1, 30);
    // O modo `game` ainda não tem PID: o rastreador só passa a guardá-lo na Fase 4.
    let selection = select(mode, probe(), None)?;
    let strategy = selection.strategy;
    let source = build_source(selection)?;

    let samples: Arc<Mutex<Vec<f32>>> = Arc::new(Mutex::new(Vec::new()));
    let writer = samples.clone();
    let sink: PacketSink = Box::new(move |raw| {
        if let Ok((_, block)) = packet::decode(&raw) {
            writer.lock().extend_from_slice(&block);
        }
        true
    });

    let session = CaptureSession::start(source, sink)?;
    std::thread::sleep(Duration::from_secs(seconds as u64));
    let report = session.stop();

    let samples = samples.lock();
    let peak = samples.iter().fold(0.0f32, |m, s| m.max(s.abs()));
    let rms = if samples.is_empty() {
        0.0
    } else {
        (samples.iter().map(|s| s * s).sum::<f32>() / samples.len() as f32).sqrt()
    };

    let dir = dirs::data_local_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("Pherielium")
        .join("audio-selftest");
    std::fs::create_dir_all(&dir).map_err(|e| AudioCaptureError::Thread(e.to_string()))?;
    let path = dir.join(format!("{}.wav", strategy_name(strategy)));
    std::fs::write(&path, wav::encode_wav_s16(&samples))
        .map_err(|e| AudioCaptureError::Thread(e.to_string()))?;

    Ok(SelfTestReport {
        strategy: strategy_name(strategy),
        wav_path: path.display().to_string(),
        seconds: samples.len() as f32 / (format::SAMPLE_RATE as f32 * format::CHANNELS as f32),
        packets: report.packets,
        samples: samples.len(),
        peak,
        rms,
        overrun_samples: report.ring.overrun_samples,
        read_timeouts: report.read_timeouts,
        ended_with: report.ended_with,
    })
}
