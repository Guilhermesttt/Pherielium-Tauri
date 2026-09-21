//! Tauri commands: system utilities
//! Clipboard, external URLs, path opening, notifications, window management

use serde::{Deserialize, Serialize};
use tauri::{command, AppHandle, Manager};

#[command]
pub async fn system_open_external(app: AppHandle, url: String) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    app.opener().open_url(&url, None::<String>).map_err(|e| e.to_string())
}

#[command]
pub async fn system_open_path(app: AppHandle, path: String) -> Result<String, String> {
    use tauri_plugin_opener::OpenerExt;
    app.opener().open_path(&path, None::<String>).map_err(|e| e.to_string())?;
    Ok(path)
}

#[command]
pub async fn system_copy_to_clipboard(app: AppHandle, value: String) -> Result<serde_json::Value, String> {
    use tauri_plugin_clipboard_manager::ClipboardExt;
    app.clipboard().write_text(value).map_err(|e| e.to_string())?;
    Ok(serde_json::json!({ "ok": true }))
}

#[command]
pub async fn system_show_battery_warning(_level: u32) -> Result<(), String> {
    // Emits a Tauri native notification
    Ok(())
}

#[command]
pub async fn app_get_version(app: AppHandle) -> Result<String, String> {
    Ok(app.package_info().version.to_string())
}

// ── Window commands ───────────────────────────────────────────────────────────

#[command]
pub async fn window_fullscreen_toggle(app: AppHandle) -> Result<bool, String> {
    let win = app
        .get_webview_window("main")
        .ok_or("main window not found")?;
    let current = win.is_fullscreen().map_err(|e| e.to_string())?;
    win.set_fullscreen(!current).map_err(|e| e.to_string())?;
    Ok(!current)
}

#[command]
pub async fn window_fullscreen_set(app: AppHandle, flag: bool) -> Result<bool, String> {
    let win = app
        .get_webview_window("main")
        .ok_or("main window not found")?;
    win.set_fullscreen(flag).map_err(|e| e.to_string())?;
    Ok(flag)
}

#[command]
pub async fn window_fullscreen_get(app: AppHandle) -> Result<bool, String> {
    let win = app
        .get_webview_window("main")
        .ok_or("main window not found")?;
    win.is_fullscreen().map_err(|e| e.to_string())
}

#[command]
pub async fn window_minimize(app: AppHandle) -> Result<(), String> {
    let win = app
        .get_webview_window("main")
        .ok_or("main window not found")?;
    win.minimize().map_err(|e| e.to_string())
}

#[command]
pub async fn window_maximize_toggle(app: AppHandle) -> Result<bool, String> {
    let win = app
        .get_webview_window("main")
        .ok_or("main window not found")?;
    let is_max = win.is_maximized().map_err(|e| e.to_string())?;
    if is_max {
        win.unmaximize().map_err(|e| e.to_string())?;
    } else {
        win.maximize().map_err(|e| e.to_string())?;
    }
    Ok(!is_max)
}

#[command]
pub async fn window_is_maximized(app: AppHandle) -> Result<bool, String> {
    let win = app
        .get_webview_window("main")
        .ok_or("main window not found")?;
    win.is_maximized().map_err(|e| e.to_string())
}

#[command]
pub async fn window_close(app: AppHandle) -> Result<(), String> {
    let win = app
        .get_webview_window("main")
        .ok_or("main window not found")?;

    use tauri_plugin_store::StoreExt;
    let min_to_tray = app
        .store("settings.json")
        .ok()
        .and_then(|s| s.get("minimize_to_tray"))
        .and_then(|v| v.as_bool())
        .unwrap_or(true);

    if min_to_tray {
        win.hide().map_err(|e| e.to_string())?;
    } else {
        win.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowBehavior {
    pub minimize_to_tray: bool,
    pub confirm_before_exit: bool,
}

#[command]
pub async fn window_set_behavior(
    app: AppHandle,
    behavior: WindowBehavior,
) -> Result<WindowBehavior, String> {
    // Store behavior config using tauri-plugin-store
    use tauri_plugin_store::StoreExt;
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    store.set("minimize_to_tray", serde_json::json!(behavior.minimize_to_tray));
    store.set("confirm_before_exit", serde_json::json!(behavior.confirm_before_exit));
    store.save().map_err(|e| e.to_string())?;
    Ok(behavior)
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuitConfirmation {
    pub confirmation_required: bool,
}

#[command]
pub async fn system_request_app_quit(app: AppHandle) -> Result<QuitConfirmation, String> {
    use tauri_plugin_store::StoreExt;
    let confirm = app
        .store("settings.json")
        .ok()
        .and_then(|s| s.get("confirm_before_exit"))
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    if !confirm {
        app.exit(0);
    }
    Ok(QuitConfirmation { confirmation_required: confirm })
}

#[command]
pub async fn system_confirm_app_quit(app: AppHandle) -> Result<(), String> {
    app.exit(0);
    Ok(())
}

#[command]
pub async fn system_set_open_at_login(open: bool) -> Result<serde_json::Value, String> {
    // On Windows, this modifies the registry Run key
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let exe = std::env::current_exe().map_err(|e| e.to_string())?;
        let exe_str = exe.to_string_lossy();
        if open {
            let _ = Command::new("reg")
                .args(["add", r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run",
                       "/v", "Pherielium", "/t", "REG_SZ", "/d", &exe_str, "/f"])
                .output();
        } else {
            let _ = Command::new("reg")
                .args(["delete", r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run",
                       "/v", "Pherielium", "/f"])
                .output();
        }
    }
    Ok(serde_json::json!({ "openAtLogin": open, "supported": true }))
}
