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
    // Chamada direta ao GSMTC (milissegundos); a leitura espera o WinRT, então roda fora do runtime.
    let info = tokio::task::spawn_blocking(super::media_session::info)
        .await
        .map_err(|e| e.to_string())?;
    if info["hasMedia"] == true {
        *LAST_MEDIA_INFO.lock() = info.clone();
    }
    Ok(info)
}

/// Capa grande demais não vale a pena trafegar em base64 pelo IPC a cada troca de faixa.
const MAX_THUMBNAIL_BASE64_LEN: usize = 3_000_000;

/// Transforma a capa em base64 em `data:` URL, reconhecendo o formato pelos
/// primeiros bytes (o Windows entrega JPEG, PNG, WebP ou GIF conforme o app). `None` = vazio,
/// grande demais ou formato desconhecido.
fn thumbnail_data_url(base64: &str) -> Option<String> {
    let b64 = base64.trim();
    if b64.is_empty() || b64.len() > MAX_THUMBNAIL_BASE64_LEN {
        return None;
    }
    let mime = if b64.starts_with("/9j/") {
        "image/jpeg"
    } else if b64.starts_with("iVBOR") {
        "image/png"
    } else if b64.starts_with("UklGR") {
        "image/webp"
    } else if b64.starts_with("R0lGOD") {
        "image/gif"
    } else {
        return None;
    };
    // só caracteres de base64: nada de texto de erro do PowerShell virando URL
    if !b64.bytes().all(|c| c.is_ascii_alphanumeric() || matches!(c, b'+' | b'/' | b'=')) {
        return None;
    }
    Some(format!("data:{mime};base64,{b64}"))
}

/// Capa (ou miniatura do vídeo) da mídia em reprodução, como `data:` URL; vazio se o app não fornece.
///
/// Fica fora de `system_get_media_info` porque é pesada: o front pede uma vez por faixa, e não a cada
/// consulta de 1,5 s. Escolhe a mesma sessão que aquela (a que está tocando, senão a primeira).
#[command]
pub async fn system_get_media_thumbnail() -> Result<String, String> {
    use base64::Engine;
    let bytes = tokio::task::spawn_blocking(super::media_session::thumbnail_bytes)
        .await
        .map_err(|e| e.to_string())?;
    Ok(bytes
        .and_then(|b| thumbnail_data_url(&base64::engine::general_purpose::STANDARD.encode(b)))
        .unwrap_or_default())
}

#[cfg(test)]
mod thumbnail_tests {
    use super::thumbnail_data_url;

    #[test]
    fn recognises_image_formats_by_their_first_bytes() {
        assert_eq!(thumbnail_data_url("/9j/4AAQ").as_deref(), Some("data:image/jpeg;base64,/9j/4AAQ"));
        assert!(thumbnail_data_url("iVBORw0KGgo=").unwrap().starts_with("data:image/png;"));
        assert!(thumbnail_data_url("UklGRiQAAAB").unwrap().starts_with("data:image/webp;"));
        assert!(thumbnail_data_url("R0lGODlh").unwrap().starts_with("data:image/gif;"));
    }

    #[test]
    fn rejects_empty_unknown_and_non_base64_output() {
        assert!(thumbnail_data_url("").is_none());
        assert!(thumbnail_data_url("  \r\n").is_none());
        assert!(thumbnail_data_url("QUJD").is_none()); // base64 válido, mas não é imagem
        assert!(thumbnail_data_url("/9j/ erro do powershell").is_none());
    }

    #[test]
    fn trims_the_trailing_newline_powershell_adds() {
        assert_eq!(thumbnail_data_url("/9j/4AAQ\r\n").as_deref(), Some("data:image/jpeg;base64,/9j/4AAQ"));
    }

    /// DIAGNÓSTICO NO HARDWARE: com algo tocando no Windows (Spotify, YouTube no navegador...), mostra
    /// se a capa chega. `cargo test --lib thumbnail_on_this_machine -- --ignored --nocapture`
    #[test]
    #[ignore = "depende de uma mídia tocando nesta máquina"]
    fn thumbnail_on_this_machine() {
        let url = tauri::async_runtime::block_on(super::system_get_media_thumbnail()).expect("comando");
        println!("capa: {} caracteres, começa com {:?}", url.len(), url.chars().take(40).collect::<String>());
        assert!(!url.is_empty(), "nenhuma capa: nada tocando ou o app não fornece imagem");
    }

    #[test]
    fn rejects_oversized_covers() {
        let huge = format!("/9j/{}", "A".repeat(3_000_001));
        assert!(thumbnail_data_url(&huge).is_none());
    }
}

/// Liga ou desliga a reprodução na MESMA sessão de mídia que `system_get_media_info`
/// reporta, pelo controle de transporte do Windows.
///
/// A tecla global `VK_MEDIA_PLAY_PAUSE` (`system_media_play_pause`) é um toggle
/// cego: vai para quem tiver o foco de mídia no momento e não diz se funcionou.
/// Quando não chegava ao app certo, o notch invertia o próprio estado e passava a
/// mandar o comando contrário no clique seguinte — daí o "não despausa".
///
/// Aqui o alvo é explícito (`TryPlayAsync` / `TryPauseAsync`, nunca toggle), então
/// repetir o comando é idempotente, e o retorno diz se a sessão aceitou.
#[command]
pub async fn system_media_set_playing(playing: bool) -> Result<bool, String> {
    let accepted = tokio::task::spawn_blocking(move || super::media_session::set_playing(playing))
        .await
        .map_err(|e| e.to_string())?;
    Ok(accepted.unwrap_or(false))
}

#[command]
pub async fn system_media_play_pause() -> Result<(), String> {
    press_media_key(0xB3);
    Ok(())
}

/// Tecla de mídia global do Windows (`VK_MEDIA_*`): vai para quem tiver o foco de mídia.
fn press_media_key(_vk: u8) {
    #[cfg(target_os = "windows")]
    // SAFETY: `keybd_event` só injeta uma tecla; não toca em memória do app.
    unsafe {
        extern "system" {
            fn keybd_event(bVk: u8, bScan: u8, dwFlags: u32, dwExtraInfo: usize);
        }
        keybd_event(_vk, 0, 0, 0);
        keybd_event(_vk, 0, 2, 0);
    }
}

#[command]
pub async fn system_media_next() -> Result<(), String> {
    // Direto na sessão que está tocando; sem sessão (ou se ela recusar), cai na tecla de mídia global.
    let handled = tokio::task::spawn_blocking(|| super::media_session::skip(true))
        .await
        .map_err(|e| e.to_string())?;
    if handled != Some(true) {
        press_media_key(0xB0);
    }
    Ok(())
}

#[command]
pub async fn system_media_previous() -> Result<(), String> {
    // Direto na sessão que está tocando; sem sessão (ou se ela recusar), cai na tecla de mídia global.
    let handled = tokio::task::spawn_blocking(|| super::media_session::skip(false))
        .await
        .map_err(|e| e.to_string())?;
    if handled != Some(true) {
        press_media_key(0xB1);
    }
    Ok(())
}
