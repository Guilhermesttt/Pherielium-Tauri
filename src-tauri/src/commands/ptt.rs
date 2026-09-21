use once_cell::sync::Lazy;
use parking_lot::Mutex;
use std::str::FromStr;
use tauri::Emitter;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

static PTT_SPEC: Lazy<Mutex<Option<String>>> = Lazy::new(|| Mutex::new(None));

#[tauri::command]
pub fn ptt_register(app: tauri::AppHandle, accelerator: String) -> Result<bool, String> {
    let _ = ptt_unregister(app.clone());
    let spec = accelerator.trim();
    if spec.is_empty() {
        return Err("Atalho PTT vazio.".into());
    }
    let shortcut =
        Shortcut::from_str(spec).map_err(|err| format!("Atalho PTT inválido ({spec}): {err}"))?;
    app.global_shortcut()
        .on_shortcut(shortcut, move |current, _shortcut, event| {
            if event.state() == ShortcutState::Pressed {
                let _ = current.emit("ptt:press", ());
            } else if event.state() == ShortcutState::Released {
                let _ = current.emit("ptt:release", ());
            }
        })
        .map_err(|err| format!("Falha ao registrar PTT: {err}"))?;
    *PTT_SPEC.lock() = Some(spec.to_string());
    Ok(true)
}

#[tauri::command]
pub fn ptt_unregister(app: tauri::AppHandle) -> Result<bool, String> {
    if let Some(spec) = PTT_SPEC.lock().take() {
        if let Ok(shortcut) = Shortcut::from_str(&spec) {
            let _ = app.global_shortcut().unregister(shortcut);
        }
    }
    Ok(true)
}
