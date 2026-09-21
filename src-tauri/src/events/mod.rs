//! Tauri event emission helpers
use tauri::{AppHandle, Emitter, Manager};

#[allow(dead_code)]
pub fn emit_to_main<S: serde::Serialize + Clone>(app: &AppHandle, event: &str, payload: S) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.emit(event, payload);
    }
}
