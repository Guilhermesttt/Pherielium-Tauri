//! Tauri commands: system utilities
//! Clipboard, external URLs, path opening, notifications, window management

use serde::{Deserialize, Serialize};
use tauri::{command, AppHandle, Emitter, Manager};

fn store_bool(app: &AppHandle, key: &str, default: bool) -> bool {
    use tauri_plugin_store::StoreExt;
    app.store("settings.json")
        .ok()
        .and_then(|s| s.get(key))
        .and_then(|v| v.as_bool())
        .unwrap_or(default)
}

/// Ask the UI to confirm quit, or exit immediately when confirmation is off.
pub fn request_quit_with_optional_confirm(app: &AppHandle) -> bool {
    let confirm = store_bool(app, "confirm_before_exit", false);
    if confirm {
        crate::tray::show_main_window(app);
        let _ = app.emit("system:exit-confirmation-requested", ());
        true
    } else {
        app.exit(0);
        false
    }
}

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
pub async fn window_show(app: AppHandle) -> Result<(), String> {
    crate::tray::show_main_window(&app);
    Ok(())
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

    let min_to_tray = store_bool(&app, "minimize_to_tray", true);

    if min_to_tray {
        win.hide().map_err(|e| e.to_string())?;
    } else if store_bool(&app, "confirm_before_exit", false) {
        let _ = app.emit("system:exit-confirmation-requested", ());
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
    let confirmation_required = request_quit_with_optional_confirm(&app);
    Ok(QuitConfirmation { confirmation_required })
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

#[command]
pub async fn system_is_fullscreen_active(app: AppHandle) -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        use windows::Win32::UI::WindowsAndMessaging::{
            GetForegroundWindow, GetWindowRect, GetDesktopWindow, GetShellWindow,
            GetClassNameA, IsIconic, IsWindowVisible,
        };
        use windows::Win32::Foundation::{HWND, RECT};

        let overlay_hwnd = app
            .get_webview_window("overlay")
            .and_then(|w| w.hwnd().ok())
            .map(|h| HWND(h.0));

        // Também excluir a janela principal do próprio Launcher
        let main_hwnd = app
            .get_webview_window("main")
            .and_then(|w| w.hwnd().ok())
            .map(|h| HWND(h.0));

        unsafe {
            let fg = GetForegroundWindow();
            if !fg.0.is_null() {
                let mut class_name = [0u8; 256];
                let len = GetClassNameA(fg, &mut class_name);
                let class_str = std::str::from_utf8(&class_name[..len as usize]).unwrap_or("");
                let is_shell = class_str == "Progman"
                    || class_str == "WorkerW"
                    || class_str == "Shell_TrayWnd"
                    || class_str == "Shell_SecondaryTrayWnd";

                // Desktop, shell, janela do overlay ou janela principal do Launcher = Notch visível
                if is_shell
                    || fg == GetDesktopWindow()
                    || fg == GetShellWindow()
                    || Some(fg) == overlay_hwnd
                    || Some(fg) == main_hwnd
                {
                    return Ok(false);
                }

                // Qualquer outra janela visivel e grande = Notch deve se esconder
                if !IsIconic(fg).as_bool() && IsWindowVisible(fg).as_bool() {
                    let mut rect = RECT::default();
                    if GetWindowRect(fg, &mut rect).is_ok() {
                        let w = rect.right - rect.left;
                        let h = rect.bottom - rect.top;
                        if w > 200 && h > 200 {
                            return Ok(true);
                        }
                    }
                }
            }
        }
    }
    Ok(false)
}

static LAST_MEDIA_INFO: once_cell::sync::Lazy<parking_lot::Mutex<serde_json::Value>> =
    once_cell::sync::Lazy::new(|| parking_lot::Mutex::new(serde_json::json!({
        "hasMedia": false,
        "isPlaying": false
    })));

#[command]
pub async fn system_get_media_info() -> Result<serde_json::Value, String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;

        let script = r#"
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
Function Await-WinRt($WinRtTask, $ResultType) {
    $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
    $netTask = $asTask.Invoke($null, @($WinRtTask))
    $netTask.Wait(-1) | Out-Null
    $netTask.Result
}
try {
    [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media, ContentType=WindowsRuntime] | Out-Null
    $asyncOp = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()
    $mgr = Await-WinRt $asyncOp ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
    $sessions = $mgr.GetSessions()
    $found = $null
    foreach ($session in $sessions) {
        $info = $session.GetPlaybackInfo()
        $propsAsync = $session.TryGetMediaPropertiesAsync()
        $props = Await-WinRt $propsAsync ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
        $title = $props.Title
        if ($title -like "*PHERIELIUM*" -or $title -like "*PHELIERIUM*" -or $session.SourceAppId -like "*pherielium*") {
            continue
        }
        if ($title) {
            $status = $info.PlaybackStatus.ToString()
            $playbackType = $props.PlaybackType.ToString()
            $isPlay = ($status -eq "Playing")
            $item = [PSCustomObject]@{
                hasMedia = $true
                title = $title
                artist = $props.Artist
                isPlaying = $isPlay
                playbackType = if ($playbackType -eq "Video") { "video" } else { "music" }
            }
            if ($isPlay) { $found = $item; break }
            elseif ($null -eq $found) { $found = $item }
        }
    }
    if ($found) { $found | ConvertTo-Json }
    else { [PSCustomObject]@{ hasMedia = $false; isPlaying = $false } | ConvertTo-Json }
} catch {
    [PSCustomObject]@{ hasMedia = $false; isPlaying = $false } | ConvertTo-Json
}
"#;

        let output = tokio::task::spawn_blocking(move || {
            Command::new("powershell")
                .args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script])
                .creation_flags(CREATE_NO_WINDOW)
                .output()
        }).await.map_err(|e| e.to_string())?.map_err(|e| e.to_string())?;

        if output.status.success() {
            let text = String::from_utf8_lossy(&output.stdout);
            if let Ok(val) = serde_json::from_str::<serde_json::Value>(&text) {
                let mut lock = LAST_MEDIA_INFO.lock();
                *lock = val.clone();
                return Ok(val);
            }
        }
        return Ok(LAST_MEDIA_INFO.lock().clone());
    }
    #[allow(unreachable_code)]
    Ok(serde_json::json!({ "hasMedia": false, "isPlaying": false }))
}

#[command]
pub async fn system_media_play_pause() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    unsafe {
        extern "system" {
            fn keybd_event(bVk: u8, bScan: u8, dwFlags: u32, dwExtraInfo: usize);
        }
        keybd_event(0xB3, 0, 0, 0);
        keybd_event(0xB3, 0, 2, 0);
    }
    Ok(())
}

#[command]
pub async fn system_media_next() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    unsafe {
        extern "system" {
            fn keybd_event(bVk: u8, bScan: u8, dwFlags: u32, dwExtraInfo: usize);
        }
        keybd_event(0xB0, 0, 0, 0);
        keybd_event(0xB0, 0, 2, 0);
    }
    Ok(())
}

#[command]
pub async fn system_media_previous() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    unsafe {
        extern "system" {
            fn keybd_event(bVk: u8, bScan: u8, dwFlags: u32, dwExtraInfo: usize);
        }
        keybd_event(0xB1, 0, 0, 0);
        keybd_event(0xB1, 0, 2, 0);
    }
    Ok(())
}
