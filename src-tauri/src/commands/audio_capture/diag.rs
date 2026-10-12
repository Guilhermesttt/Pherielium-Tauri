//! Diagnóstico opcional da captura de áudio do desktop.
//!
//! Ligado pelo front quando a flag `pherielium_stream_debug` está ativa (`stream_debug_set`). Só observa: emite um evento
//! `stream-debug:desktop-audio` por passo e escreve no stderr. Com a flag desligada nada é emitido.

use serde_json::{json, Value};
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Emitter};

static STREAM_DEBUG: AtomicBool = AtomicBool::new(false);

pub fn set_stream_debug(enabled: bool) {
    STREAM_DEBUG.store(enabled, Ordering::Relaxed);
}

pub fn is_enabled() -> bool {
    STREAM_DEBUG.load(Ordering::Relaxed)
}

/// Emite um passo do diagnóstico para o front (console) e para o stderr. No-op com a flag desligada.
pub fn diag(app: &AppHandle, stage: &str, detail: Value) {
    if !is_enabled() {
        return;
    }
    let payload = json!({ "stage": stage, "detail": detail });
    eprintln!("[desktop-audio-diag] {payload}");
    if let Err(err) = app.emit_to("main", "stream-debug:desktop-audio", payload) {
        eprintln!("[desktop-audio-diag] emit falhou: {err}");
    }
}
