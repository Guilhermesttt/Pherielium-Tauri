//! In-game overlay window — transparent fullscreen webview + event bridge.

use once_cell::sync::Lazy;
use parking_lot::Mutex;
use serde_json::{json, Map, Value};
use std::collections::VecDeque;
use std::str::FromStr;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

const OVERLAY_LABEL: &str = "overlay";

static CURSOR_WATCH_ENABLED: AtomicBool = AtomicBool::new(false);
static CURSOR_WATCH_STARTED: AtomicBool = AtomicBool::new(false);
static CAPTURE_SHORTCUT_KEY: Lazy<Mutex<String>> = Lazy::new(|| Mutex::new("F8".into()));
static OVERLAY_SHORTCUT_KEY: Lazy<Mutex<String>> = Lazy::new(|| Mutex::new("Ctrl+Shift+O".into()));

const DEFAULT_CAPTURE_SHORTCUT: &str = "F8";
const DEFAULT_OVERLAY_SHORTCUT: &str = "Ctrl+Shift+O";

pub struct OverlayRuntime {
    pub ready: bool,
    pub pending: VecDeque<(String, Value)>,
    pub panel_open: bool,
    pub panel_state: Value,
}

impl Default for OverlayRuntime {
    fn default() -> Self {
        Self {
            ready: false,
            pending: VecDeque::new(),
            panel_open: false,
            panel_state: json!({}),
        }
    }
}

fn merge_json_values(base: &mut Value, patch: Value) {
    match (base, patch) {
        (Value::Object(base_map), Value::Object(patch_map)) => {
            for (key, patch_val) in patch_map {
                match base_map.get_mut(&key) {
                    Some(existing) if existing.is_object() && patch_val.is_object() => {
                        merge_json_values(existing, patch_val);
                    }
                    _ => {
                        base_map.insert(key, patch_val);
                    }
                }
            }
        }
        (slot, patch) => {
            *slot = patch;
        }
    }
}

fn overlay_url(_app: &AppHandle) -> Result<WebviewUrl, String> {
    if cfg!(debug_assertions) {
        if let Ok(dev_url) = std::env::var("TAURI_DEV_URL") {
            let base = dev_url.trim_end_matches('/');
            return Ok(WebviewUrl::External(
                format!("{base}/overlay.html")
                    .parse()
                    .map_err(|e| format!("URL overlay invalida: {e}"))?,
            ));
        }
    }
    Ok(WebviewUrl::App("overlay.html".into()))
}

fn set_overlay_interactive(app: &AppHandle, interactive: bool) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(OVERLAY_LABEL) {
        window
            .set_ignore_cursor_events(!interactive)
            .map_err(|e| e.to_string())?;
        if interactive {
            let _ = window.show();
            let _ = window.set_always_on_top(true);
        }
    }
    Ok(())
}

pub fn ensure_overlay(app: &AppHandle) -> Result<tauri::WebviewWindow, String> {
    if let Some(existing) = app.get_webview_window(OVERLAY_LABEL) {
        return Ok(existing);
    }

    let monitor = app
        .primary_monitor()
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Monitor primario nao encontrado.".to_string())?;
    let size = monitor.size();
    let pos = monitor.position();

    let app_handle = app.clone();
    let label = OVERLAY_LABEL.to_string();

    let window = WebviewWindowBuilder::new(app, OVERLAY_LABEL, overlay_url(app)?)
        .title("Pherielium Overlay")
        .transparent(true)
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .visible(false)
        .resizable(false)
        .shadow(false)
        .position(pos.x as f64, pos.y as f64)
        .inner_size(size.width as f64, size.height as f64)
        .on_page_load(move |_webview, _payload| {
            if let Some(state) = app_handle.try_state::<Mutex<OverlayRuntime>>() {
                let mut runtime = state.lock();
                runtime.ready = true;
                while let Some((channel, payload)) = runtime.pending.pop_front() {
                    if let Some(win) = app_handle.get_webview_window(&label) {
                        let _ = win.emit(&channel, payload);
                    }
                }
            }
        })
        .build()
        .map_err(|e| format!("Falha ao criar overlay: {e}"))?;

    let _ = window.set_position(tauri::Position::Physical(*pos));
    let _ = window.set_size(tauri::Size::Physical(*size));
    let _ = window.set_ignore_cursor_events(true);

    Ok(window)
}

fn panel_is_open(app: &AppHandle) -> bool {
    app.try_state::<Mutex<OverlayRuntime>>()
        .map(|state| state.lock().panel_open)
        .unwrap_or(false)
}

fn restore_overlay_click_through(app: &AppHandle) {
    let _ = set_overlay_interactive(app, false);
    CURSOR_WATCH_ENABLED.store(false, Ordering::SeqCst);
}

/// Esconde o overlay quando nao ha painel aberto (toasts/atualizacoes nao mantem a janela por cima).
fn hide_overlay_if_idle(app: &AppHandle) {
    if panel_is_open(app) {
        return;
    }
    restore_overlay_click_through(app);
    if let Some(window) = app.get_webview_window(OVERLAY_LABEL) {
        let _ = window.hide();
    }
}

pub fn send_overlay_event(app: &AppHandle, channel: &str, payload: Value) {
    let _ = ensure_overlay(app);

    if let Some(state) = app.try_state::<Mutex<OverlayRuntime>>() {
        let mut runtime = state.lock();
        if !runtime.ready {
            runtime.pending.push_back((channel.to_string(), payload));
            if runtime.pending.len() > 100 {
                runtime.pending.pop_front();
            }
            return;
        }
    }

    if let Some(window) = app.get_webview_window(OVERLAY_LABEL) {
        let panel_open = panel_is_open(app);
        // Nao chamar show() em toda atualizacao de painel — isso roubava o mouse
        // mesmo com o overlay "fechado" visualmente.
        let should_show = match channel {
            "overlay:panel-state" => panel_open,
            "overlay:panel-visibility" => payload
                .get("open")
                .or_else(|| payload.get("visible"))
                .and_then(Value::as_bool)
                .unwrap_or(false),
            "overlay:social" | "achievement:unlock" | "overlay:play-sound" => true,
            "overlay:cursor" => false,
            _ => false,
        };

        if should_show {
            let _ = window.show();
            // Toasts: janela visivel mas click-through ate o frontend pedir interacao.
            if !panel_open {
                let _ = window.set_ignore_cursor_events(true);
            }
        }

        let _ = window.emit(channel, payload);
    }
}

fn merge_panel_state(app: &AppHandle, patch: Value) -> Value {
    if let Some(state) = app.try_state::<Mutex<OverlayRuntime>>() {
        let mut runtime = state.lock();
        merge_json_values(&mut runtime.panel_state, patch);
        return runtime.panel_state.clone();
    }
    patch
}

#[tauri::command]
pub fn overlay_ensure(app: AppHandle) -> Result<(), String> {
    ensure_overlay(&app).map(|_| ())
}

#[tauri::command]
pub fn overlay_show_game_start(app: AppHandle, payload: Value) -> Result<(), String> {
    let game_title = payload
        .get("gameTitle")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim();
    send_overlay_event(
        &app,
        "overlay:social",
        json!({
            "kind": "game-start",
            "title": "Divirta-se",
            "description": if game_title.is_empty() {
                "O overlay está ativo enquanto você joga.".to_string()
            } else {
                format!("Jogando {game_title}")
            },
        }),
    );
    Ok(())
}

#[tauri::command]
pub fn overlay_show_social(app: AppHandle, payload: Value) -> Result<(), String> {
    let event_payload = payload.get("payload").cloned().unwrap_or(payload);
    send_overlay_event(&app, "overlay:social", event_payload);
    Ok(())
}

#[tauri::command]
pub fn overlay_dismiss_notification(app: AppHandle, payload: Option<Value>) -> Result<(), String> {
    let data = payload.unwrap_or(json!({}));
    send_overlay_event(
        &app,
        "overlay:social",
        json!({
            "kind": "dismiss",
            "notificationId": data.get("id").and_then(|v| v.as_str()).map(|s| s.to_string()),
            "dismissAll": data.get("dismissAll").and_then(|v| v.as_bool()).unwrap_or(false),
        }),
    );
    Ok(())
}

#[tauri::command]
pub fn overlay_update_panel(app: AppHandle, payload: Value) -> Result<(), String> {
    let patch = payload.get("payload").cloned().unwrap_or(payload);
    let merged = merge_panel_state(&app, patch);
    send_overlay_event(&app, "overlay:panel-state", merged);
    Ok(())
}

#[tauri::command]
pub fn overlay_set_ignore_cursor_events(app: AppHandle, ignore: bool) -> Result<(), String> {
    set_overlay_interactive(&app, !ignore)
}

fn ensure_cursor_watch(app: &AppHandle) {
    if CURSOR_WATCH_STARTED.swap(true, Ordering::SeqCst) {
        return;
    }
    let app = app.clone();
    let _ = std::thread::Builder::new()
        .name("overlay-cursor-watch".into())
        .spawn(move || {
            #[cfg(windows)]
            {
                use windows::Win32::Foundation::POINT;
                use windows::Win32::UI::WindowsAndMessaging::GetCursorPos;

                let mut last = (i32::MIN, i32::MIN);
                loop {
                    std::thread::sleep(std::time::Duration::from_millis(12));
                    if !CURSOR_WATCH_ENABLED.load(Ordering::Relaxed) {
                        continue;
                    }
                    let Some(win) = app.get_webview_window(OVERLAY_LABEL) else {
                        continue;
                    };
                    let mut pt = POINT::default();
                    if unsafe { GetCursorPos(&mut pt) }.is_err() {
                        continue;
                    }
                    if pt.x == last.0 && pt.y == last.1 {
                        continue;
                    }
                    last = (pt.x, pt.y);

                    let Ok(pos) = win.outer_position() else {
                        continue;
                    };
                    let Ok(scale) = win.scale_factor() else {
                        continue;
                    };
                    let x = (f64::from(pt.x) - f64::from(pos.x)) / scale;
                    let y = (f64::from(pt.y) - f64::from(pos.y)) / scale;
                    let _ = win.emit("overlay:cursor", json!({ "x": x, "y": y }));
                }
            }
            #[cfg(not(windows))]
            {
                loop {
                    std::thread::sleep(std::time::Duration::from_secs(60));
                }
            }
        });
}

/// When enabled, emits `overlay:cursor` with CSS-pixel coords relative to the overlay window.
/// Used for selective click-through: only capture cursor over interactive toast hitboxes.
#[tauri::command]
pub fn overlay_set_cursor_watch(app: AppHandle, enabled: bool) -> Result<(), String> {
    ensure_cursor_watch(&app);
    CURSOR_WATCH_ENABLED.store(enabled, Ordering::SeqCst);
    if !enabled {
        // Restore click-through when watch stops (panel closed / toasts gone).
        let _ = set_overlay_interactive(&app, false);
    }
    Ok(())
}

#[tauri::command]
pub fn overlay_get_panel_state(app: AppHandle) -> Result<Value, String> {
    if let Some(state) = app.try_state::<Mutex<OverlayRuntime>>() {
        Ok(state.lock().panel_state.clone())
    } else {
        Ok(json!({}))
    }
}

#[tauri::command]
pub fn overlay_toggle_panel(app: AppHandle) -> Result<Value, String> {
    let (open, panel_state) = {
        let state = app
            .try_state::<Mutex<OverlayRuntime>>()
            .ok_or_else(|| "Estado do overlay indisponivel.".to_string())?;
        let mut runtime = state.lock();
        runtime.panel_open = !runtime.panel_open;
        (runtime.panel_open, runtime.panel_state.clone())
    };

    if open {
        if let Some(window) = app.get_webview_window(OVERLAY_LABEL) {
            let _ = window.show();
        }
        send_overlay_event(
            &app,
            "overlay:panel-visibility",
            json!({ "open": true, "visible": true, "state": panel_state.clone() }),
        );
        send_overlay_event(
            &app,
            "overlay:panel-state",
            panel_state,
        );
    } else {
        restore_overlay_click_through(&app);
        if let Some(window) = app.get_webview_window(OVERLAY_LABEL) {
            let _ = window.emit(
                "overlay:panel-visibility",
                json!({ "open": false, "visible": false }),
            );
        }
        // Sem toasts ativos o frontend manda toasts-cleared; se o painel fechou sem toast, libera ja.
        hide_overlay_if_idle(&app);
    }

    if let Some(main) = app.get_webview_window("main") {
        let _ = main.emit("overlay:panel-toggled", json!({ "open": open }));
    }

    Ok(json!({ "open": open }))
}

#[tauri::command]
pub fn overlay_notify_unlock(app: AppHandle, payload: Value) -> Result<Value, String> {
    let event_payload = payload.get("payload").cloned().unwrap_or(payload);
    send_overlay_event(&app, "achievement:unlock", event_payload.clone());
    Ok(json!({ "shown": true }))
}

#[tauri::command]
pub fn overlay_test_welcome(app: AppHandle) -> Result<(), String> {
    send_overlay_event(
        &app,
        "overlay:social",
        json!({
            "kind": "game-start",
            "title": "Divirta-se",
            "description": "O overlay está ativo enquanto você joga.",
        }),
    );
    Ok(())
}

#[tauri::command]
pub fn overlay_test_achievement(app: AppHandle, tier: Option<String>) -> Result<(), String> {
    let tier = tier.unwrap_or_else(|| "gold".to_string());
    let (name, description, percent) = match tier.as_str() {
        "platinum" => (
            "Trofeu de Platina Desbloqueado",
            "Voce completou 100% das conquistas deste jogo.",
            3,
        ),
        "silver" => (
            "Trofeu de Prata Conquistado",
            "Excelente progresso em sua jornada.",
            35,
        ),
        "bronze" => (
            "Primeiro Abate",
            "Teste visual do overlay do Phellerium.",
            75,
        ),
        _ => (
            "Trofeu de Ouro Conquistado",
            "Conquista de alto valor desbloqueada.",
            12,
        ),
    };

    send_overlay_event(
        &app,
        "achievement:unlock",
        json!({
            "title": name,
            "description": description,
            "percent": percent,
            "gameTitle": "Pherielium Lab",
            "tier": tier,
            "xpGained": match tier.as_str() {
                "platinum" => 90,
                "gold" => 60,
                "silver" => 30,
                "bronze" => 15,
                _ => 50,
            },
            "isTest": true,
        }),
    );
    Ok(())
}

#[tauri::command]
pub fn overlay_panel_action(app: AppHandle, action: Value) -> Result<Value, String> {
    let kind = action
        .get("kind")
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim();

    match kind {
        "close" => {
            if let Some(state) = app.try_state::<Mutex<OverlayRuntime>>() {
                state.lock().panel_open = false;
            }
            restore_overlay_click_through(&app);
            if let Some(window) = app.get_webview_window(OVERLAY_LABEL) {
                let _ = window.set_ignore_cursor_events(true);
                // Mantem a janela se ainda houver toast; o frontend manda toasts-cleared depois.
                let _ = window.emit(
                    "overlay:panel-visibility",
                    json!({ "open": false, "visible": false }),
                );
            }
            if let Some(main) = app.get_webview_window("main") {
                let _ = main.emit("overlay:panel-toggled", json!({ "open": false }));
            }
        }
        "toasts-cleared" => {
            // Espelha o Electron: limpar toasts restaura passagem de cliques / esconde idle.
            hide_overlay_if_idle(&app);
        }
        _ => {}
    }

    if let Some(main) = app.get_webview_window("main") {
        let _ = main.emit("overlay:panel-action", action.clone());
    }
    Ok(action)
}

pub fn register_overlay_shortcut(app: &AppHandle) {
    let prefs = read_overlay_prefs();
    if let Some(spec) = prefs.get("overlayShortcut").and_then(Value::as_str) {
        *OVERLAY_SHORTCUT_KEY.lock() = spec.to_string();
    }
    if let Some(spec) = prefs.get("captureShortcut").and_then(Value::as_str) {
        *CAPTURE_SHORTCUT_KEY.lock() = spec.to_string();
    }
    register_overlay_toggle_shortcut(app);
    register_capture_shortcut(app);
}

fn shortcut_from_spec(spec: &str) -> Result<Shortcut, String> {
    let trimmed = spec.trim();
    if trimmed.is_empty() {
        return Err("Atalho vazio.".into());
    }
    Shortcut::from_str(trimmed).map_err(|e| format!("Atalho inválido ({trimmed}): {e}"))
}

fn unregister_spec(app: &AppHandle, spec: &str) {
    if let Ok(shortcut) = shortcut_from_spec(spec) {
        let _ = app.global_shortcut().unregister(shortcut);
    }
}

fn register_overlay_toggle_shortcut(app: &AppHandle) {
    let spec = OVERLAY_SHORTCUT_KEY.lock().clone();
    let Ok(shortcut) = shortcut_from_spec(&spec) else {
        eprintln!("[overlay] Atalho do overlay inválido: {spec}");
        return;
    };
    let app_handle = app.clone();
    if let Err(err) = app.global_shortcut().on_shortcut(shortcut, move |_app, _shortcut, event| {
        if event.state() == ShortcutState::Pressed {
            let _ = overlay_toggle_panel(app_handle.clone());
        }
    }) {
        eprintln!("[overlay] Falha ao registrar atalho do overlay {spec}: {err}");
    }
}

pub fn register_capture_shortcut(app: &AppHandle) {
    let key = CAPTURE_SHORTCUT_KEY.lock().clone();
    let Ok(shortcut) = shortcut_from_spec(&key) else {
        eprintln!("[overlay] Atalho de captura inválido: {key}");
        return;
    };
    let app_handle = app.clone();

    if let Err(err) = app.global_shortcut().on_shortcut(shortcut, move |_app, _shortcut, event| {
        if event.state() != ShortcutState::Pressed {
            return;
        }
        let game_title = app_handle.try_state::<Mutex<OverlayRuntime>>().and_then(|state| {
            state
                .lock()
                .panel_state
                .get("gameTitle")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
        });
        match super::captures::capture_screen(game_title) {
            Ok(item) => {
                send_overlay_event(
                    &app_handle,
                    "overlay:social",
                    json!({
                        "kind": "capture",
                        "title": "Captura salva",
                        "description": item.name,
                        "screenshotUrl": item.url,
                    }),
                );
                send_overlay_event(
                    &app_handle,
                    "overlay:play-sound",
                    json!({ "sound": "screenshot" }),
                );
            }
            Err(err) => {
                send_overlay_event(
                    &app_handle,
                    "overlay:social",
                    json!({
                        "kind": "error",
                        "title": "Captura falhou",
                        "description": err,
                    }),
                );
            }
        }
    }) {
        eprintln!("[overlay] Falha ao registrar atalho de captura {key}: {err}");
    }
}

#[tauri::command]
pub fn overlay_get_capture_shortcut() -> Result<String, String> {
    Ok(CAPTURE_SHORTCUT_KEY.lock().clone())
}

#[tauri::command]
pub fn overlay_set_capture_shortcut(app: AppHandle, key: String) -> Result<String, String> {
    let normalized = key.trim().to_string();
    shortcut_from_spec(&normalized)?;
    overlay_prefs_set(app, json!({ "captureShortcut": normalized }))?;
    Ok(normalized)
}

#[tauri::command]
pub fn overlay_get_overlay_shortcut() -> Result<String, String> {
    Ok(OVERLAY_SHORTCUT_KEY.lock().clone())
}

#[tauri::command]
pub fn overlay_set_overlay_shortcut(app: AppHandle, shortcut: String) -> Result<String, String> {
    let normalized = shortcut.trim().to_string();
    shortcut_from_spec(&normalized)?;
    overlay_prefs_set(app, json!({ "overlayShortcut": normalized }))?;
    Ok(normalized)
}

pub fn init(app: &AppHandle) {
    let _ = ensure_overlay(app);
}

#[allow(dead_code)]
pub fn show_splash(app: &AppHandle) -> Result<(), String> {
    if app.get_webview_window("splash").is_some() {
        return Ok(());
    }

    let splash_url = if cfg!(debug_assertions) {
        if let Ok(dev_url) = std::env::var("TAURI_DEV_URL") {
            WebviewUrl::External(
                format!("{}/splash.html", dev_url.trim_end_matches('/'))
                    .parse()
                    .map_err(|e| format!("URL splash invalida: {e}"))?,
            )
        } else {
            WebviewUrl::App("splash.html".into())
        }
    } else {
        WebviewUrl::App("splash.html".into())
    };

    let _splash = WebviewWindowBuilder::new(app, "splash", splash_url)
        .title("Pherielium")
        .inner_size(360.0, 400.0)
        .center()
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .resizable(false)
        .skip_taskbar(true)
        .on_page_load(move |webview, _payload| {
            let _ = webview.eval("window.startSplashAppearance?.();");
        })
        .build()
        .map_err(|e| format!("Falha ao criar splash: {e}"))?;

    if let Some(main) = app.get_webview_window("main") {
        let _ = main.hide();
    }

    let app_transition = app.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(4500)).await;
        if let Some(splash_win) = app_transition.get_webview_window("splash") {
            let _ = splash_win.eval(
                "document.getElementById('splashCard')?.classList.add('fading-out');",
            );
            tokio::time::sleep(std::time::Duration::from_millis(450)).await;
            let _ = splash_win.close();
        }
        if let Some(main) = app_transition.get_webview_window("main") {
            let _ = main.show();
            let _ = main.set_focus();
        }
    });

    Ok(())
}

fn overlay_prefs_path() -> Result<std::path::PathBuf, String> {
    Ok(crate::utils::path::pherielium_user_data_dir()?.join("overlay-prefs.json"))
}

fn default_overlay_prefs() -> Value {
    json!({
        "achievements": true,
        "social": true,
        "fluidAnimations": true,
        "highContrast": false,
        "muteAll": false,
        "perfMonitor": false,
        "captureShortcut": DEFAULT_CAPTURE_SHORTCUT,
        "overlayShortcut": DEFAULT_OVERLAY_SHORTCUT,
    })
}

fn read_overlay_prefs() -> Value {
    let Ok(path) = overlay_prefs_path() else {
        return default_overlay_prefs();
    };
    let Ok(raw) = std::fs::read_to_string(path) else {
        return default_overlay_prefs();
    };
    let parsed: Value = serde_json::from_str(&raw).unwrap_or_else(|_| default_overlay_prefs());
    let mut merged = default_overlay_prefs();
    merge_json_values(&mut merged, parsed);
    merged
}

fn write_overlay_prefs(prefs: &Value) -> Result<(), String> {
    let path = overlay_prefs_path()?;
    let encoded = serde_json::to_string_pretty(prefs).map_err(|e| e.to_string())?;
    std::fs::write(path, encoded).map_err(|e| format!("Falha ao salvar overlay-prefs: {e}"))
}

#[tauri::command]
pub fn overlay_prefs_get() -> Result<Value, String> {
    Ok(read_overlay_prefs())
}

#[tauri::command]
pub fn overlay_prefs_set(app: AppHandle, prefs: Value) -> Result<Value, String> {
    let previous = read_overlay_prefs();
    let mut merged = previous.clone();
    merge_json_values(&mut merged, prefs);

    let overlay_spec = merged
        .get("overlayShortcut")
        .and_then(Value::as_str)
        .unwrap_or(DEFAULT_OVERLAY_SHORTCUT);
    let capture_spec = merged
        .get("captureShortcut")
        .and_then(Value::as_str)
        .unwrap_or(DEFAULT_CAPTURE_SHORTCUT);
    shortcut_from_spec(overlay_spec)?;
    shortcut_from_spec(capture_spec)?;
    if overlay_spec.eq_ignore_ascii_case(capture_spec) {
        return Err("O atalho do overlay e o de captura precisam ser diferentes.".into());
    }

    write_overlay_prefs(&merged)?;

    let prev_overlay = previous
        .get("overlayShortcut")
        .and_then(Value::as_str)
        .unwrap_or(DEFAULT_OVERLAY_SHORTCUT);
    let prev_capture = previous
        .get("captureShortcut")
        .and_then(Value::as_str)
        .unwrap_or(DEFAULT_CAPTURE_SHORTCUT);

    if prev_overlay != overlay_spec {
        unregister_spec(&app, prev_overlay);
        *OVERLAY_SHORTCUT_KEY.lock() = overlay_spec.to_string();
        register_overlay_toggle_shortcut(&app);
    }
    if prev_capture != capture_spec {
        unregister_spec(&app, prev_capture);
        *CAPTURE_SHORTCUT_KEY.lock() = capture_spec.to_string();
        register_capture_shortcut(&app);
    }

    let _ = app.emit("overlay:prefs", merged.clone());
    Ok(merged)
}

#[allow(dead_code)]
fn empty_object() -> Map<String, Value> {
    Map::new()
}
