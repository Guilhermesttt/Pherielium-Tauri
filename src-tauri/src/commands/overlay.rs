//! In-game overlay window — transparent fullscreen webview + event bridge.

use once_cell::sync::Lazy;
use parking_lot::Mutex;
use serde_json::{json, Map, Value};
use std::collections::VecDeque;
use std::str::FromStr;
use std::sync::atomic::{AtomicBool, AtomicIsize, Ordering};
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
    pub call_overlay_forced: bool,
}

impl Default for OverlayRuntime {
    fn default() -> Self {
        Self {
            ready: false,
            pending: VecDeque::new(),
            panel_open: false,
            panel_state: json!({}),
            call_overlay_forced: false,
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

/// HWND do jogo que tinha o foco quando o modo interativo abriu (para devolver ao fechar).
static PREV_FOREGROUND: AtomicIsize = AtomicIsize::new(0);
static INTERACTIVE_LOOP_RUNNING: AtomicBool = AtomicBool::new(false);

#[cfg(windows)]
fn overlay_hwnd(window: &tauri::WebviewWindow) -> Option<windows::Win32::Foundation::HWND> {
    window
        .hwnd()
        .ok()
        .map(|h| windows::Win32::Foundation::HWND(h.0))
}

/// Estado passivo = `WS_EX_NOACTIVATE`: clicar nos botões do notch (play/pause,
/// mutar, desligar) NÃO tira o foco do jogo. Estado interativo = estilo removido,
/// para o overlay poder receber foco e teclado (Esc, chat).
#[cfg(windows)]
fn set_overlay_noactivate(window: &tauri::WebviewWindow, noactivate: bool) {
    use windows::Win32::UI::WindowsAndMessaging::{
        GetWindowLongPtrW, SetWindowLongPtrW, GWL_EXSTYLE, WS_EX_NOACTIVATE,
    };
    if let Some(hwnd) = overlay_hwnd(window) {
        unsafe {
            let current = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
            let flag = WS_EX_NOACTIVATE.0 as isize;
            let next = if noactivate { current | flag } else { current & !flag };
            if next != current {
                SetWindowLongPtrW(hwnd, GWL_EXSTYLE, next);
            }
        }
    }
}

#[cfg(not(windows))]
fn set_overlay_noactivate(_window: &tauri::WebviewWindow, _noactivate: bool) {}

/// Traz `hwnd` ao primeiro plano contornando o foreground-lock do Windows:
/// anexa a fila de entrada da thread atual à da janela em foco (o jogo) durante
/// o `SetForegroundWindow`. Devolve se a janela realmente ficou em foco.
#[cfg(windows)]
fn force_foreground(hwnd: windows::Win32::Foundation::HWND) -> bool {
    use windows::Win32::System::Threading::{AttachThreadInput, GetCurrentThreadId};
    use windows::Win32::UI::WindowsAndMessaging::{
        BringWindowToTop, GetForegroundWindow, GetWindowThreadProcessId, SetForegroundWindow,
    };
    unsafe {
        let fg = GetForegroundWindow();
        if fg == hwnd {
            return true;
        }
        let current_tid = GetCurrentThreadId();
        let fg_tid = if fg.0.is_null() {
            0
        } else {
            GetWindowThreadProcessId(fg, None)
        };
        let attached = fg_tid != 0
            && fg_tid != current_tid
            && AttachThreadInput(current_tid, fg_tid, true).as_bool();
        let _ = BringWindowToTop(hwnd);
        let _ = SetForegroundWindow(hwnd);
        if attached {
            let _ = AttachThreadInput(current_tid, fg_tid, false);
        }
        GetForegroundWindow() == hwnd
    }
}

fn claim_overlay_foreground(window: &tauri::WebviewWindow) {
    let _ = window.show();
    let _ = window.set_always_on_top(true);

    #[cfg(windows)]
    {
        use windows::Win32::UI::WindowsAndMessaging::{
            ClipCursor, GetForegroundWindow, SetWindowPos, HWND_TOPMOST, SWP_NOMOVE, SWP_NOSIZE,
            SWP_SHOWWINDOW,
        };

        if let Some(hwnd) = overlay_hwnd(window) {
            unsafe {
                let fg = GetForegroundWindow();
                if fg != hwnd && !fg.0.is_null() {
                    PREV_FOREGROUND.store(fg.0 as isize, Ordering::SeqCst);
                }
                let _ = ClipCursor(None);
                if let Err(err) = SetWindowPos(
                    hwnd,
                    HWND_TOPMOST,
                    0,
                    0,
                    0,
                    0,
                    SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW,
                ) {
                    eprintln!("[overlay] SetWindowPos(TOPMOST) falhou: {err}");
                }
            }
            if !force_foreground(hwnd) {
                eprintln!("[overlay] Não foi possível assumir o foreground (foreground-lock do Windows).");
            }
        }
    }
    #[cfg(not(windows))]
    let _ = window.set_focus();
}

/// Devolve o foco ao jogo que estava ativo antes do modo interativo.
fn restore_previous_foreground() {
    #[cfg(windows)]
    {
        use windows::Win32::UI::WindowsAndMessaging::IsWindow;
        let prev = PREV_FOREGROUND.swap(0, Ordering::SeqCst);
        if prev != 0 {
            let hwnd = windows::Win32::Foundation::HWND(prev as *mut std::ffi::c_void);
            if unsafe { IsWindow(hwnd) }.as_bool() {
                let _ = force_foreground(hwnd);
            }
        }
    }
}

/// Enquanto o modo interativo está aberto, solta o cursor do jogo repetidamente:
/// muitos jogos re-aplicam `ClipCursor` a cada frame e prendiam o ponteiro fora do painel.
fn start_interactive_loop(app: &AppHandle) {
    if INTERACTIVE_LOOP_RUNNING.swap(true, Ordering::SeqCst) {
        return;
    }
    let app = app.clone();
    let spawned = std::thread::Builder::new()
        .name("overlay-interactive".into())
        .spawn(move || {
            while panel_is_open(&app) {
                #[cfg(windows)]
                unsafe {
                    let _ = windows::Win32::UI::WindowsAndMessaging::ClipCursor(None);
                }
                std::thread::sleep(std::time::Duration::from_millis(100));
            }
            INTERACTIVE_LOOP_RUNNING.store(false, Ordering::SeqCst);
        });
    if spawned.is_err() {
        INTERACTIVE_LOOP_RUNNING.store(false, Ordering::SeqCst);
    }
}

/// Só alterna o click-through. A captura de foreground/cursor é exclusiva do
/// modo interativo (`apply_panel_open`); antes cada re-afirmação do hit-test
/// (a cada ~600ms) reassumia o foreground e brigava com o jogo.
fn set_overlay_interactive(app: &AppHandle, interactive: bool) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(OVERLAY_LABEL) {
        window
            .set_ignore_cursor_events(!interactive)
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Única porta de entrada/saída do modo interativo (atalho, gamepad, ação `close`,
/// toasts que abrem o painel). Idempotente; devolve se o estado mudou.
/// `notify_front` = avisar o React (quando a origem foi o backend/atalho).
pub fn apply_panel_open(app: &AppHandle, open: bool, notify_front: bool) -> Result<bool, String> {
    let (changed, panel_state) = {
        let state = app
            .try_state::<Mutex<OverlayRuntime>>()
            .ok_or_else(|| "Estado do overlay indisponivel.".to_string())?;
        let mut runtime = state.lock();
        let changed = runtime.panel_open != open;
        runtime.panel_open = open;
        (changed, runtime.panel_state.clone())
    };
    if !changed {
        return Ok(false);
    }

    if open {
        let game_title = panel_state.get("gameTitle").and_then(|v| v.as_str());
        update_overlay_geometry_to_game(app, game_title);
        if let Some(window) = app.get_webview_window(OVERLAY_LABEL) {
            set_overlay_noactivate(&window, false);
            let _ = window.set_ignore_cursor_events(false);
            claim_overlay_foreground(&window);
        }
        start_interactive_loop(app);
        if notify_front {
            send_overlay_event(
                app,
                "overlay:panel-visibility",
                json!({ "open": true, "visible": true, "state": panel_state.clone() }),
            );
            send_overlay_event(app, "overlay:panel-state", panel_state);
        }
    } else {
        if let Some(window) = app.get_webview_window(OVERLAY_LABEL) {
            let _ = window.set_ignore_cursor_events(true);
            set_overlay_noactivate(&window, true);
            if notify_front {
                let _ = window.emit(
                    "overlay:panel-visibility",
                    json!({ "open": false, "visible": false }),
                );
            }
        }
        #[cfg(windows)]
        unsafe {
            // Libera qualquer clip residual antes de devolver o jogo.
            let _ = windows::Win32::UI::WindowsAndMessaging::ClipCursor(None);
        }
        restore_previous_foreground();
    }

    if let Some(main) = app.get_webview_window("main") {
        let _ = main.emit("overlay:panel-toggled", json!({ "open": open }));
    }
    Ok(true)
}

pub fn get_game_or_primary_monitor(app: &AppHandle, game_title: Option<&str>) -> Option<tauri::Monitor> {
    let mon_idx = super::screen_capture::find_game_or_active_monitor_index(game_title) as usize;
    if let Ok(monitors) = app.available_monitors() {
        if let Some(mon) = monitors.get(mon_idx) {
            return Some(mon.clone());
        }
    }
    app.primary_monitor().ok().flatten()
}

/// Último retângulo aplicado ao overlay (x, y, w, h em px físicos). Evita
/// `set_position`/`set_size` repetidos — cada um força relayout do WebView2 e
/// derruba o hover do notch (ex.: a cada "falando" durante uma chamada).
static LAST_OVERLAY_RECT: Lazy<Mutex<Option<(i32, i32, u32, u32)>>> = Lazy::new(|| Mutex::new(None));

/// Cobre o monitor dado com o overlay (mesmo cache de retângulo de `update_overlay_geometry_to_game`).
fn place_overlay_on_monitor(app: &AppHandle, monitor: &tauri::Monitor) {
    if let Some(win) = app.get_webview_window(OVERLAY_LABEL) {
        let pos = monitor.position();
        let size = monitor.size();
        let rect = (pos.x, pos.y, size.width, size.height);
        {
            let mut last = LAST_OVERLAY_RECT.lock();
            if *last == Some(rect) {
                return;
            }
            *last = Some(rect);
        }
        let _ = win.set_position(tauri::Position::Physical(*pos));
        let _ = win.set_size(tauri::Size::Physical(*size));
    }
}

pub fn update_overlay_geometry_to_game(app: &AppHandle, game_title: Option<&str>) {
    if let Some(target_mon) = get_game_or_primary_monitor(app, game_title) {
        if let Some(win) = app.get_webview_window(OVERLAY_LABEL) {
            let pos = target_mon.position();
            let size = target_mon.size();
            let rect = (pos.x, pos.y, size.width, size.height);
            {
                let mut last = LAST_OVERLAY_RECT.lock();
                if *last == Some(rect) {
                    return;
                }
                *last = Some(rect);
            }
            let _ = win.set_position(tauri::Position::Physical(*pos));
            let _ = win.set_size(tauri::Size::Physical(*size));
        }
    }
}

fn current_game_title(app: &AppHandle) -> Option<String> {
    app.try_state::<Mutex<OverlayRuntime>>().and_then(|state| {
        state
            .lock()
            .panel_state
            .get("gameTitle")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
    })
}

/// Reposiciona o overlay no monitor do jogo atual (usado ao iniciar um jogo).
/// Usa a mesma lógica de `update_overlay_geometry_to_game` — antes o game_watch
/// forçava o monitor primário e brigava com ela.
pub fn refresh_overlay_geometry(app: &AppHandle) {
    let title = current_game_title(app);
    update_overlay_geometry_to_game(app, title.as_deref());
}

pub fn ensure_overlay(app: &AppHandle) -> Result<tauri::WebviewWindow, String> {
    // Janela já existe: NÃO recalcula geometria aqui. Este caminho roda em todo
    // evento enviado ao overlay; a geometria é atualizada só nos pontos que
    // realmente mudam o monitor (início de jogo, troca de gameTitle, abrir painel).
    if let Some(existing) = app.get_webview_window(OVERLAY_LABEL) {
        return Ok(existing);
    }

    let game_title = current_game_title(app);

    let monitor = get_game_or_primary_monitor(app, game_title.as_deref())
        .ok_or_else(|| "Nenhum monitor encontrado.".to_string())?;
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
        .visible(true)
        .focused(false)
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
    *LAST_OVERLAY_RECT.lock() = Some((pos.x, pos.y, size.width, size.height));
    let _ = window.set_ignore_cursor_events(true);
    // Nasce passivo: não ativa nem rouba o foco do jogo ao ser clicado.
    set_overlay_noactivate(&window, true);
    let _ = window.show();

    Ok(window)
}

fn panel_is_open(app: &AppHandle) -> bool {
    app.try_state::<Mutex<OverlayRuntime>>()
        .map(|state| state.lock().panel_open)
        .unwrap_or(false)
}

// NOTA: o cursor watch (CURSOR_WATCH_ENABLED) é controlado SÓ pelo frontend via
// `overlay_set_cursor_watch`. Nenhum caminho do backend (toast expirando, fechar
// painel...) pode desligá-lo — isso deixava o overlay sem eventos `overlay:cursor`,
// a janela click-through e o notch sem hover durante chamadas.

pub fn send_overlay_event(app: &AppHandle, channel: &str, mut payload: Value) {
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
        let hub_visible = app
            .get_webview_window("main")
            .and_then(|main| main.is_visible().ok())
            .unwrap_or(true);
        if channel == "overlay:panel-state" {
            if let Some(obj) = payload.as_object_mut() {
                obj.insert("hubVisible".to_string(), Value::Bool(hub_visible));
            }
        }
        let call_active = payload
            .get("activeCall")
            .and_then(|call| call.get("active"))
            .and_then(Value::as_bool)
            .unwrap_or(false);
        let call_force = channel == "overlay:panel-state" && call_active && !hub_visible && !panel_open;
        if channel == "overlay:panel-state" {
            if let Some(state) = app.try_state::<Mutex<OverlayRuntime>>() {
                let mut runtime = state.lock();
                if call_force {
                    runtime.call_overlay_forced = true;
                } else if runtime.call_overlay_forced && (!call_active || hub_visible) && !panel_open {
                    runtime.call_overlay_forced = false;
                }
            }
        }
        // NÃO força set_ignore_cursor_events(true) aqui: este caminho roda em
        // TODA atualização de panel-state (ex.: activeCall.speaking muda a cada
        // ~350ms durante uma chamada) e derrubava a captura de cursor enquanto o
        // ponteiro estava sobre a Desktop Notch, impedindo-a de expandir. O
        // click-through é de responsabilidade do hit-test do frontend
        // (OverlayApp) e dos caminhos de ciclo de vida (init/fechar painel/idle).
        // Só mostra se estiver oculta: show() a cada evento reordena a janela.
        if !window.is_visible().unwrap_or(false) {
            let _ = window.show();
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
    if !game_title.is_empty() {
        merge_panel_state(&app, json!({ "gameTitle": game_title }));
        update_overlay_geometry_to_game(&app, Some(game_title));
    }
    send_overlay_event(
        &app,
        "overlay:social",
        json!({
            "kind": "game-start",
            "gameTitle": game_title,
            "title": "Divirta-se",
            "description": if game_title.is_empty() {
                "Preparando sessão de jogo…".to_string()
            } else {
                format!("Preparando {game_title}…")
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
    // Só reposiciona se o título mudou (o Home reenvia gameTitle em todo update,
    // inclusive a cada flip de "falando" durante uma chamada).
    if let Some(game_title) = patch.get("gameTitle").and_then(|v| v.as_str()) {
        if current_game_title(&app).as_deref() != Some(game_title) {
            update_overlay_geometry_to_game(&app, Some(game_title));
        }
    }
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
                let started = std::time::Instant::now();
                let mut trail: Vec<(f64, f64, f64)> = Vec::with_capacity(64);
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
                    // movimento recente: velocidade e inversões (tontura ao chacoalhar o mouse)
                    let now_ms = started.elapsed().as_secs_f64() * 1000.0;
                    trail.push((now_ms, x, y));
                    trail.retain(|s| now_ms - s.0 <= 600.0);
                    let (speed, reversals) = motion_metrics(&trail);
                    // botão esquerdo pressionado = possível arrasto de arquivo (dropzone do notch)
                    let dragging = unsafe {
                        (windows::Win32::UI::Input::KeyboardAndMouse::GetAsyncKeyState(
                            i32::from(windows::Win32::UI::Input::KeyboardAndMouse::VK_LBUTTON.0),
                        ) as u16
                            & 0x8000)
                            != 0
                    };
                    let _ = win.emit(
                        "overlay:cursor",
                        json!({ "x": x, "y": y, "speed": speed, "reversals": reversals, "dragging": dragging }),
                    );
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
/// Métricas de movimento do cursor numa janela curta de amostras `(t_ms, x, y)` (px CSS).
/// - velocidade (px/s) média nos últimos ~150 ms;
/// - inversões de direção ("chacoalhar"): quantas vezes o movimento mudou de sentido
///   (em x ou em y, o maior) ignorando tremidas menores que `MIN_STEP_PX`.
pub fn motion_metrics(samples: &[(f64, f64, f64)]) -> (f64, u32) {
    const SPEED_WINDOW_MS: f64 = 150.0;
    const MIN_STEP_PX: f64 = 4.0;
    if samples.len() < 2 {
        return (0.0, 0);
    }

    let t_last = samples[samples.len() - 1].0;
    let mut dist = 0.0;
    let mut t_first = t_last;
    for pair in samples.windows(2).rev() {
        if t_last - pair[0].0 > SPEED_WINDOW_MS {
            break;
        }
        dist += ((pair[1].1 - pair[0].1).powi(2) + (pair[1].2 - pair[0].2).powi(2)).sqrt();
        t_first = pair[0].0;
    }
    let dt = (t_last - t_first) / 1000.0;
    let speed = if dt > 0.0 { dist / dt } else { 0.0 };

    let flips = |axis: fn(&(f64, f64, f64)) -> f64| -> u32 {
        let mut last_sign = 0.0_f64;
        let mut count = 0;
        for pair in samples.windows(2) {
            let step = axis(&pair[1]) - axis(&pair[0]);
            if step.abs() < MIN_STEP_PX {
                continue;
            }
            let sign = step.signum();
            if last_sign != 0.0 && sign != last_sign {
                count += 1;
            }
            last_sign = sign;
        }
        count
    };
    (speed, flips(|s| s.1).max(flips(|s| s.2)))
}

/// Converte um ponto em px CSS da área cliente da janela principal para px CSS do overlay.
/// px de tela (físicos) = origem da área cliente + px CSS × escala; depois divide-se pela
/// escala do overlay e subtrai-se a origem dele. Retorna `(x, y, size)`.
fn client_to_overlay_css(
    client: (f64, f64),
    size: f64,
    main_inner_pos: (f64, f64),
    main_scale: f64,
    overlay_pos: (f64, f64),
    overlay_scale: f64,
) -> (f64, f64, f64) {
    let screen_x = main_inner_pos.0 + client.0 * main_scale;
    let screen_y = main_inner_pos.1 + client.1 * main_scale;
    (
        (screen_x - overlay_pos.0) / overlay_scale,
        (screen_y - overlay_pos.1) / overlay_scale,
        size * main_scale / overlay_scale,
    )
}

/// Intro de lançamento: a janela principal informa onde está o mascote (px CSS da área
/// cliente dela). Convertemos para as coordenadas do overlay (que pode estar em outro
/// monitor/escala) e emitimos `overlay:launch-handoff`; o overlay desenha o mascote nesse
/// ponto e o faz voar até o notch. Também posiciona o overlay no monitor da janela principal.
#[tauri::command]
pub fn overlay_launch_handoff(app: AppHandle, payload: Value) -> Result<Value, String> {
    let num = |key: &str| payload.get(key).and_then(Value::as_f64).unwrap_or(0.0);
    let (client_x, client_y, size) = (num("x"), num("y"), num("size"));

    let main = app
        .get_webview_window("main")
        .ok_or_else(|| "Janela principal indisponivel.".to_string())?;
    let main_scale = main.scale_factor().map_err(|e| e.to_string())?;
    let inner = main.inner_position().map_err(|e| e.to_string())?;

    // o overlay precisa cobrir o monitor onde o mascote está
    if let Ok(Some(monitor)) = main.current_monitor() {
        place_overlay_on_monitor(&app, &monitor);
    }
    let overlay = ensure_overlay(&app)?;
    let overlay_scale = overlay.scale_factor().map_err(|e| e.to_string())?;
    let overlay_pos = overlay.outer_position().map_err(|e| e.to_string())?;

    let (x, y, css_size) = client_to_overlay_css(
        (client_x, client_y),
        size,
        (f64::from(inner.x), f64::from(inner.y)),
        main_scale,
        (f64::from(overlay_pos.x), f64::from(overlay_pos.y)),
        overlay_scale,
    );
    let out = json!({
        "x": x,
        "y": y,
        "size": css_size,
        "id": format!("{}", std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0)),
    });
    send_overlay_event(&app, "overlay:launch-handoff", out.clone());
    Ok(out)
}

#[tauri::command]
pub fn overlay_set_cursor_watch(app: AppHandle, enabled: bool) -> Result<(), String> {
    ensure_cursor_watch(&app);
    CURSOR_WATCH_ENABLED.store(enabled, Ordering::SeqCst);
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
    let open = !panel_is_open(&app);
    apply_panel_open(&app, open, true)?;
    Ok(json!({ "open": open }))
}

/// O frontend informa que entrou/saiu do modo interativo (ex.: um toast de
/// conquista abriu o painel completo). Mantém `panel_open` do backend sincronizado
/// para captura de foreground/cursor e para o `toasts-cleared` não derrubar o painel.
#[tauri::command]
pub fn overlay_set_panel_open(app: AppHandle, open: bool) -> Result<Value, String> {
    apply_panel_open(&app, open, false)?;
    Ok(json!({ "open": panel_is_open(&app) }))
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

    let sound_theme = app
        .try_state::<Mutex<OverlayRuntime>>()
        .and_then(|state| {
            let rt = state.lock();
            rt.panel_state
                .get("settings")
                .and_then(|s| s.get("achievementSoundTheme"))
                .and_then(|t| t.as_str().map(|s| s.to_string()))
        });

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
            "soundTheme": sound_theme,
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
            // Fecha o modo interativo: solta cursor/foco e devolve o jogo.
            let _ = apply_panel_open(&app, false, true);
        }
        "toasts-cleared" => {
            // Intencionalmente sem efeito: o click-through em modo passivo é do
            // hit-test do frontend. Forçar `ignore=true` aqui derrubava a captura
            // enquanto o cursor estava parado sobre o notch (sem eventos novos de
            // cursor para recapturar), deixando-o preso/morto.
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
        match super::captures::capture_screen(app_handle.clone(), game_title, None) {
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
    if let Ok(window) = ensure_overlay(app) {
        let _ = window.show();
        let _ = window.set_ignore_cursor_events(true);
    }
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

#[cfg(test)]
mod handoff_tests {
    use super::client_to_overlay_css;

    #[test]
    fn same_monitor_same_scale_is_a_plain_offset() {
        // janela principal em (100,50) e overlay em (0,0), ambos escala 1
        let (x, y, size) = client_to_overlay_css((640.0, 400.0), 176.0, (100.0, 50.0), 1.0, (0.0, 0.0), 1.0);
        assert_eq!((x, y, size), (740.0, 450.0, 176.0));
    }

    #[test]
    fn overlay_origin_is_subtracted() {
        // overlay num monitor secundário que começa em x=1920
        let (x, y, _) = client_to_overlay_css((100.0, 100.0), 100.0, (2000.0, 40.0), 1.0, (1920.0, 0.0), 1.0);
        assert_eq!((x, y), (180.0, 140.0));
    }

    #[test]
    fn different_dpi_scales_are_normalised_to_overlay_css_pixels() {
        // principal a 150% (1.5) e overlay a 100%: 100 px CSS = 150 px físicos = 150 px CSS do overlay
        let (x, _, size) = client_to_overlay_css((100.0, 0.0), 100.0, (0.0, 0.0), 1.5, (0.0, 0.0), 1.0);
        assert_eq!(x, 150.0);
        assert_eq!(size, 150.0);
        // overlay a 200%: os mesmos 150 físicos = 75 px CSS
        let (x2, _, size2) = client_to_overlay_css((100.0, 0.0), 100.0, (0.0, 0.0), 1.5, (0.0, 0.0), 2.0);
        assert_eq!(x2, 75.0);
        assert_eq!(size2, 75.0);
    }
}

#[cfg(test)]
mod motion_tests {
    use super::motion_metrics;

    #[test]
    fn still_or_single_sample_has_no_motion() {
        assert_eq!(motion_metrics(&[]), (0.0, 0));
        assert_eq!(motion_metrics(&[(0.0, 10.0, 10.0)]), (0.0, 0));
        let (speed, flips) = motion_metrics(&[(0.0, 10.0, 10.0), (100.0, 10.0, 10.0)]);
        assert_eq!((speed, flips), (0.0, 0));
    }

    #[test]
    fn straight_line_has_speed_and_no_reversals() {
        // 100 px em 100 ms = 1000 px/s, sempre para a direita
        let samples: Vec<_> = (0..11).map(|i| (i as f64 * 10.0, i as f64 * 10.0, 50.0)).collect();
        let (speed, flips) = motion_metrics(&samples);
        assert!((speed - 1000.0).abs() < 1.0, "speed {speed}");
        assert_eq!(flips, 0);
    }

    #[test]
    fn shaking_the_mouse_counts_direction_changes() {
        // vai e volta 60 px a cada 40 ms: 6 meias-voltas = 5 inversões
        let mut samples = Vec::new();
        for i in 0..7 {
            let x = if i % 2 == 0 { 100.0 } else { 160.0 };
            samples.push((i as f64 * 40.0, x, 50.0));
        }
        let (speed, flips) = motion_metrics(&samples);
        assert_eq!(flips, 5);
        assert!(speed > 1000.0, "speed {speed}");
    }

    #[test]
    fn tiny_jitter_is_ignored() {
        let samples: Vec<_> = (0..10)
            .map(|i| (i as f64 * 10.0, 100.0 + if i % 2 == 0 { 0.0 } else { 2.0 }, 50.0))
            .collect();
        assert_eq!(motion_metrics(&samples).1, 0);
    }

    #[test]
    fn reversals_on_the_y_axis_count_too() {
        let mut samples = Vec::new();
        for i in 0..5 {
            let y = if i % 2 == 0 { 20.0 } else { 80.0 };
            samples.push((i as f64 * 50.0, 100.0, y));
        }
        assert_eq!(motion_metrics(&samples).1, 3);
    }
}
