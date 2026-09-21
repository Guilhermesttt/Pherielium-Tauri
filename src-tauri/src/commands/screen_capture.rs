mod livekit_stub {
    #![allow(dead_code)]
    pub struct LiveKitPublishState;
    impl Default for LiveKitPublishState {
        fn default() -> Self {
            Self
        }
    }
    #[derive(Clone)]
    pub struct ScreenPublishConfig {
        pub livekit_url: String,
        pub livekit_token: String,
        pub room_name: String,
        pub target_label: String,
        pub target_kind: String,
    }
    pub fn stop_screen_publish() {}
    pub fn start_screen_publish(
        _config: ScreenPublishConfig,
        _fps: u32,
        _max_width: u32,
        _max_height: u32,
        on_state: impl Fn(bool) + Send + Sync + 'static,
    ) -> Result<(), String> {
        on_state(false);
        Err("Publicacao nativa LiveKit indisponivel neste build.".into())
    }
}
use livekit_stub as livekit_publish;
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::atomic::{AtomicU64, Ordering};
use tauri::{AppHandle, Emitter, Manager, State};

#[cfg(windows)]
#[path = "win_loopback.rs"]
mod win_loopback;

#[cfg(windows)]
mod win_conv {
    use windows::Win32::Foundation::{BOOL, HWND};

    pub fn hwnd_opt(value: impl IntoHwnd) -> Option<HWND> {
        value.into_hwnd()
    }

    pub fn gdi_ok(value: impl GdiStatus) -> bool {
        value.succeeded()
    }

    pub trait IntoHwnd {
        fn into_hwnd(self) -> Option<HWND>;
    }

    impl IntoHwnd for HWND {
        fn into_hwnd(self) -> Option<HWND> {
            (!self.is_invalid()).then_some(self)
        }
    }

    impl<E> IntoHwnd for Result<HWND, E> {
        fn into_hwnd(self) -> Option<HWND> {
            self.ok().filter(|hwnd| !hwnd.is_invalid())
        }
    }

    pub trait GdiStatus {
        fn succeeded(self) -> bool;
    }

    impl GdiStatus for BOOL {
        fn succeeded(self) -> bool {
            self.as_bool()
        }
    }

    impl<T, E> GdiStatus for Result<T, E> {
        fn succeeded(self) -> bool {
            matches!(self, Ok(_))
        }
    }
}

#[derive(Default)]
pub struct ScreenCaptureState {
    active: Mutex<bool>,
    target_id: Mutex<Option<String>>,
    generation: AtomicU64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScreenShareStartOptions {
    pub target_id: String,
    pub fps: Option<u32>,
    pub max_width: Option<u32>,
    pub max_height: Option<u32>,
    pub livekit_url: String,
    pub livekit_token: String,
    pub room_name: String,
}

#[cfg(windows)]
mod win_targets {
    use super::*;
    use windows::Win32::Foundation::{BOOL, HWND, LPARAM, RECT};
    use windows::Win32::Graphics::Dwm::{DwmGetWindowAttribute, DWMWA_CLOAKED};
    use windows::Win32::Graphics::Gdi::{
        EnumDisplayMonitors, GetMonitorInfoW, HMONITOR, MONITORINFOEXW,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        EnumWindows, GetAncestor, GetClassNameW, GetWindow, GetWindowLongPtrW, GetWindowRect,
        GetWindowTextLengthW, GetWindowTextW, IsIconic, IsWindowVisible, GA_ROOT, GWL_EXSTYLE,
        GW_OWNER, WS_EX_TOOLWINDOW,
    };
    use super::win_conv::{gdi_ok, hwnd_opt};

    const SKIP_CLASSES: &[&str] = &[
        "Shell_TrayWnd",
        "Shell_SecondaryTrayWnd",
        "Progman",
        "WorkerW",
        "NotifyIconOverflowWindow",
        "Windows.Internal.Shell.TabProxyWindow",
        "ForegroundStaging",
        "Xaml_WindowedPopupClass",
        "IME",
        "MSCTFIME UI",
        "GDI+ Hook Window Class",
        "DummyDWMListenerWindow",
        "EdgeUiInputTopWndClass",
        "TaskListThumbnailWnd",
        "TaskListOverlayWnd",
        "Mozilla_Status",
    ];

    fn hwnd_to_id(hwnd: HWND) -> isize {
        unsafe { core::mem::transmute::<HWND, isize>(hwnd) }
    }

    fn class_name(hwnd: HWND) -> String {
        unsafe {
            let mut buf = [0u16; 256];
            let len = GetClassNameW(hwnd, &mut buf);
            if len <= 0 {
                return String::new();
            }
            String::from_utf16_lossy(&buf[..len as usize])
        }
    }

    fn is_cloaked(hwnd: HWND) -> bool {
        unsafe {
            let mut cloaked: u32 = 0;
            let cloaked_ok = gdi_ok(DwmGetWindowAttribute(
                hwnd,
                DWMWA_CLOAKED,
                &mut cloaked as *mut u32 as *mut core::ffi::c_void,
                std::mem::size_of::<u32>() as u32,
            ));
            cloaked_ok && cloaked != 0
        }
    }

    fn should_skip_window(hwnd: HWND, title: &str) -> bool {
        let title = title.trim();
        if title.is_empty() {
            return true;
        }
        let lower = title.to_ascii_lowercase();
        if lower.contains("pherielium overlay")
            || lower == "program manager"
            || lower.contains("nvidia geforce overlay")
            || lower.contains("microsoft text input application")
        {
            return true;
        }
        let class = class_name(hwnd);
        if SKIP_CLASSES.iter().any(|skip| class.eq_ignore_ascii_case(skip)) {
            return true;
        }
        unsafe {
            if !gdi_ok(IsWindowVisible(hwnd)) || is_cloaked(hwnd) {
                return true;
            }
            if hwnd_opt(GetAncestor(hwnd, GA_ROOT)) != Some(hwnd) {
                return true;
            }
            if hwnd_opt(GetWindow(hwnd, GW_OWNER)).is_some() {
                return true;
            }
            let ex = GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as u32;
            if ex & WS_EX_TOOLWINDOW.0 != 0 {
                return true;
            }
            let mut rect = RECT::default();
            if !gdi_ok(GetWindowRect(hwnd, &mut rect)) {
                return true;
            }
            let width = rect.right - rect.left;
            let height = rect.bottom - rect.top;
            if !gdi_ok(IsIconic(hwnd)) && (width < 160 || height < 100) {
                return true;
            }
        }
        false
    }

    struct WindowCollector {
        items: Vec<Value>,
    }

    unsafe extern "system" fn enum_windows_proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let collector = &mut *(lparam.0 as *mut WindowCollector);
        let len = GetWindowTextLengthW(hwnd);
        if len > 0 {
            let mut buffer = vec![0u16; (len + 1) as usize];
            let read = GetWindowTextW(hwnd, &mut buffer);
            if read > 0 {
                let title = String::from_utf16_lossy(&buffer[..read as usize]);
                if !should_skip_window(hwnd, &title) {
                    collector.items.push(json!({
                        "id": format!("window:{}", hwnd_to_id(hwnd)),
                        "name": title.trim(),
                        "kind": "window",
                        "thumbnail": "",
                        "appIcon": null,
                    }));
                }
            }
        }
        BOOL(1)
    }

    struct MonitorCollector {
        items: Vec<Value>,
        index: u32,
    }

    unsafe extern "system" fn enum_monitors_proc(
        monitor: HMONITOR,
        _hdc: windows::Win32::Graphics::Gdi::HDC,
        _rect: *mut RECT,
        lparam: LPARAM,
    ) -> BOOL {
        let collector = &mut *(lparam.0 as *mut MonitorCollector);
        let mut info = MONITORINFOEXW::default();
        info.monitorInfo.cbSize = std::mem::size_of::<MONITORINFOEXW>() as u32;
        if gdi_ok(GetMonitorInfoW(monitor, &mut info.monitorInfo)) {
            let id = collector.index;
            collector.index += 1;
            let area = info.monitorInfo.rcMonitor;
            let width = (area.right - area.left).max(0);
            let height = (area.bottom - area.top).max(0);
            let name = if width > 0 && height > 0 {
                format!("Tela {} · {width}×{height}", id + 1)
            } else {
                format!("Tela {}", id + 1)
            };
            collector.items.push(json!({
                "id": format!("screen:{id}"),
                "name": name,
                "kind": "display",
                "thumbnail": "",
                "appIcon": null,
            }));
        }
        BOOL(1)
    }

    pub fn list_targets() -> Vec<Value> {
        let mut windows = WindowCollector { items: Vec::new() };
        unsafe {
            let _ = EnumWindows(
                Some(enum_windows_proc),
                LPARAM(&mut windows as *mut _ as isize),
            );
        }

        let mut monitors = MonitorCollector {
            items: Vec::new(),
            index: 0,
        };
        unsafe {
            let _ = EnumDisplayMonitors(
                None,
                None,
                Some(enum_monitors_proc),
                LPARAM(&mut monitors as *mut _ as isize),
            );
        }

        let mut all = monitors.items;
        all.extend(windows.items);
        all
    }

    pub fn is_supported() -> bool {
        true
    }

    pub fn has_permission() -> bool {
        true
    }

    pub fn request_permission() {}
}

#[cfg(not(windows))]
mod win_targets {
    pub fn list_targets() -> Vec<serde_json::Value> {
        Vec::new()
    }
    pub fn is_supported() -> bool {
        false
    }
    pub fn has_permission() -> bool {
        false
    }
    pub fn request_permission() {}
}

#[tauri::command]
pub fn screen_share_check_permissions() -> Result<Value, String> {
    Ok(json!({
        "supported": win_targets::is_supported(),
        "hasPermission": win_targets::has_permission(),
    }))
}

#[tauri::command]
pub fn screen_share_request_permission() -> Result<Value, String> {
    win_targets::request_permission();
    Ok(json!({ "requested": true, "hasPermission": win_targets::has_permission() }))
}

#[tauri::command]
pub fn screen_share_list_targets() -> Result<Value, String> {
    Ok(json!(win_targets::list_targets()))
}

#[tauri::command]
pub fn screen_share_status(state: State<'_, ScreenCaptureState>) -> Result<Value, String> {
    Ok(json!({
        "active": *state.active.lock(),
        "targetId": state.target_id.lock().clone(),
    }))
}

#[tauri::command]
pub fn screen_share_stop(app: AppHandle, state: State<'_, ScreenCaptureState>) -> Result<Value, String> {
    livekit_publish::stop_screen_publish();
    state.generation.fetch_add(1, Ordering::SeqCst);
    *state.active.lock() = false;
    *state.target_id.lock() = None;
    let _ = app.emit("screen-share:state", json!({ "active": false }));
    Ok(json!({ "active": false }))
}

#[tauri::command]
pub fn screen_share_start_frames(
    app: AppHandle,
    state: State<'_, ScreenCaptureState>,
    target_id: String,
    fps: Option<u32>,
    max_width: Option<u32>,
    max_height: Option<u32>,
    with_audio: Option<bool>,
) -> Result<Value, String> {
    if !win_targets::is_supported() {
        return Err("Captura nativa indisponivel nesta plataforma.".into());
    }

    let targets = win_targets::list_targets();
    if !targets
        .iter()
        .any(|t| t.get("id").and_then(|v| v.as_str()) == Some(target_id.as_str()))
    {
        return Err("Target de captura nao encontrado.".to_string());
    }

    livekit_publish::stop_screen_publish();
    let generation = state.generation.fetch_add(1, Ordering::SeqCst) + 1;
    *state.active.lock() = true;
    *state.target_id.lock() = Some(target_id.clone());

    let fps = fps.unwrap_or(30).clamp(10, 60);
    let max_w = max_width.unwrap_or(1920);
    let max_h = max_height.unwrap_or(1080);
    let app_handle = app.clone();
    let capture_id = target_id.clone();

    std::thread::Builder::new()
        .name("screen-share-frames".into())
        .spawn(move || {
            let interval = std::time::Duration::from_millis((1000 / fps).max(8) as u64);
            loop {
                let Some(capture_state) = app_handle.try_state::<ScreenCaptureState>() else {
                    break;
                };
                let still_active = *capture_state.active.lock()
                    && capture_state.generation.load(Ordering::SeqCst) == generation;
                drop(capture_state);
                if !still_active {
                    break;
                }

                let started = std::time::Instant::now();
                match grab_target_bgra_scaled(&capture_id, Some(max_w), Some(max_h)) {
                    Ok((w, h, bgra)) => {
                        let quality = if max_w <= 1280 { 56 } else { 62 };
                        if let Ok(jpeg) = encode_jpeg_b64(&bgra, w, h, max_w, max_h, quality) {
                            let _ = app_handle.emit(
                                "screen-share:frame",
                                json!({
                                    "jpeg": jpeg,
                                    "width": w,
                                    "height": h,
                                }),
                            );
                        }
                    }
                    Err(err) => {
                        eprintln!("[screen-share] Falha ao capturar frame: {err}");
                    }
                }

                let elapsed = started.elapsed();
                if elapsed < interval {
                    std::thread::sleep(interval - elapsed);
                }
            }
        })
        .map_err(|e| format!("Falha ao iniciar captura nativa: {e}"))?;

    let mut audio = false;
    let mut sample_rate = 0u32;
    let mut channels = 0u16;
    if with_audio.unwrap_or(true) {
        #[cfg(windows)]
        {
            match win_loopback::start(app.clone(), generation) {
                Ok(info) => {
                    audio = true;
                    sample_rate = info.sample_rate;
                    channels = info.channels;
                }
                Err(err) => {
                    eprintln!("[screen-share] Loopback WASAPI indisponivel: {err}");
                }
            }
        }
    }

    let _ = app.emit(
        "screen-share:state",
        json!({
            "active": true,
            "targetId": target_id,
            "audio": audio,
        }),
    );
    Ok(json!({
        "active": true,
        "targetId": target_id,
        "audio": audio,
        "sampleRate": sample_rate,
        "channels": channels,
    }))
}

#[tauri::command]
pub fn screen_share_start(
    app: AppHandle,
    state: State<'_, ScreenCaptureState>,
    options: ScreenShareStartOptions,
) -> Result<Value, String> {
    if !win_targets::is_supported() {
        return Err("Captura nativa indisponivel nesta plataforma.".into());
    }

    let targets = win_targets::list_targets();
    if !targets.iter().any(|t| t.get("id").and_then(|v| v.as_str()) == Some(options.target_id.as_str())) {
        return Err("Target de captura nao encontrado.".to_string());
    }

    livekit_publish::stop_screen_publish();
    *state.active.lock() = true;
    *state.target_id.lock() = Some(options.target_id.clone());

    let app_handle = app.clone();
    let target_id = options.target_id.clone();

    livekit_publish::start_screen_publish(
        livekit_publish::ScreenPublishConfig {
            livekit_url: options.livekit_url,
            livekit_token: options.livekit_token,
            room_name: options.room_name,
            target_label: target_id.clone(),
            target_kind: if target_id.starts_with("screen:") {
                "display".to_string()
            } else {
                "window".to_string()
            },
        },
        options.fps.unwrap_or(30),
        options.max_width.unwrap_or(1920),
        options.max_height.unwrap_or(1080),
        move |active| {
            if let Some(state) = app_handle.try_state::<ScreenCaptureState>() {
                *state.active.lock() = active;
                if !active {
                    *state.target_id.lock() = None;
                }
            }
            let _ = app_handle.emit("screen-share:state", json!({ "active": active }));
        },
    )?;

    let _ = app.emit(
        "screen-share:state",
        json!({
            "active": true,
            "targetId": options.target_id,
        }),
    );

    Ok(json!({ "active": true, "targetId": options.target_id }))
}

/// BGRA pixels of a monitor/window/`desktop` target. Used by JPEG share frames and screenshots.
pub fn grab_target_bgra(target_id: &str) -> Result<(u32, u32, Vec<u8>), String> {
    grab_target_bgra_scaled(target_id, None, None)
}

pub fn grab_target_bgra_scaled(
    target_id: &str,
    max_width: Option<u32>,
    max_height: Option<u32>,
) -> Result<(u32, u32, Vec<u8>), String> {
    #[cfg(windows)]
    {
        win_grab::grab_target_bgra(target_id, max_width, max_height)
    }
    #[cfg(not(windows))]
    {
        let _ = (target_id, max_width, max_height);
        Err("Captura de tela nativa so esta disponivel no Windows.".into())
    }
}

#[tauri::command]
pub fn capture_target_jpeg(
    target_id: String,
    max_width: Option<u32>,
    max_height: Option<u32>,
) -> Result<String, String> {
    let max_w = max_width.unwrap_or(1280);
    let max_h = max_height.unwrap_or(720);
    let (w, h, bgra) = grab_target_bgra_scaled(&target_id, Some(max_w), Some(max_h))?;
    let quality = if max_w <= 400 { 42 } else { 52 };
    encode_jpeg_b64(&bgra, w, h, max_w, max_h, quality)
}

pub fn encode_jpeg_b64(
    bgra: &[u8],
    width: u32,
    height: u32,
    max_w: u32,
    max_h: u32,
    quality: u8,
) -> Result<String, String> {
    let mut rgb = Vec::with_capacity((width * height * 3) as usize);
    for px in bgra.chunks_exact(4) {
        rgb.extend_from_slice(&[px[2], px[1], px[0]]);
    }
    let mut img = image::RgbImage::from_raw(width, height, rgb)
        .ok_or_else(|| "Falha ao montar o frame capturado.".to_string())?;
    if width > max_w || height > max_h {
        let scale = (max_w as f32 / width as f32).min(max_h as f32 / height as f32).max(0.05);
        let nw = (width as f32 * scale).round().max(2.0) as u32;
        let nh = (height as f32 * scale).round().max(2.0) as u32;
        img = image::imageops::resize(&img, nw, nh, image::imageops::FilterType::Triangle);
    }
    let mut buf = Vec::new();
    let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut buf, quality);
    encoder
        .encode(
            img.as_raw(),
            img.width(),
            img.height(),
            image::ExtendedColorType::Rgb8,
        )
        .map_err(|e| format!("Falha ao compactar JPEG: {e}"))?;
    Ok(B64.encode(&buf))
}

#[cfg(windows)]
mod win_grab {
    // GDI BitBlt/GetWindowDC only — PrintWindow is gated behind extra windows crate features.
    use windows::Win32::Foundation::{BOOL, HWND, LPARAM, RECT};
    use windows::Win32::Graphics::Gdi::{
        BitBlt, CreateCompatibleBitmap, CreateCompatibleDC, DeleteDC, DeleteObject, GetDC,
        GetDIBits, GetMonitorInfoW, GetWindowDC, ReleaseDC, SelectObject, SetStretchBltMode,
        StretchBlt, BITMAPINFO, BITMAPINFOHEADER, COLORONCOLOR, DIB_RGB_COLORS, HDC, HGDIOBJ,
        HMONITOR, MONITORINFOEXW, SRCCOPY,
    };
    use super::win_conv::gdi_ok;
    use windows::Win32::UI::WindowsAndMessaging::{
        GetSystemMetrics, GetWindowRect, SM_CXVIRTUALSCREEN, SM_CYVIRTUALSCREEN,
        SM_XVIRTUALSCREEN, SM_YVIRTUALSCREEN,
    };

    #[link(name = "user32")]
    extern "system" {
        fn PrintWindow(hwnd: *mut core::ffi::c_void, hdc_blt: *mut core::ffi::c_void, flags: u32) -> i32;
    }

    fn as_gdiobj(hbmp: windows::Win32::Graphics::Gdi::HBITMAP) -> HGDIOBJ {
        unsafe { core::mem::transmute(hbmp) }
    }

    fn scaled_size(w: i32, h: i32, max_w: Option<u32>, max_h: Option<u32>) -> (i32, i32) {
        let Some(max_w) = max_w else {
            return (w, h);
        };
        let Some(max_h) = max_h else {
            return (w, h);
        };
        if w as u32 <= max_w && h as u32 <= max_h {
            return (w, h);
        }
        let scale = (max_w as f32 / w as f32).min(max_h as f32 / h as f32).min(1.0);
        (
            (w as f32 * scale).round().max(2.0) as i32,
            (h as f32 * scale).round().max(2.0) as i32,
        )
    }

    unsafe fn grab_rect(
        hdc_src: HDC,
        x: i32,
        y: i32,
        w: i32,
        h: i32,
        max_w: Option<u32>,
        max_h: Option<u32>,
    ) -> Result<(u32, u32, Vec<u8>), String> {
        if w <= 0 || h <= 0 {
            return Err("Regiao de captura invalida.".into());
        }
        let (dest_w, dest_h) = scaled_size(w, h, max_w, max_h);
        let hdc_mem = CreateCompatibleDC(hdc_src);
        if hdc_mem.is_invalid() {
            return Err("Falha ao criar DC de captura.".into());
        }
        let hbmp = CreateCompatibleBitmap(hdc_src, dest_w, dest_h);
        if hbmp.is_invalid() {
            let _ = DeleteDC(hdc_mem);
            return Err("Falha ao criar bitmap de captura.".into());
        }
        let old = SelectObject(hdc_mem, as_gdiobj(hbmp));
        let blit_ok = if dest_w == w && dest_h == h {
            gdi_ok(BitBlt(hdc_mem, 0, 0, w, h, hdc_src, x, y, SRCCOPY))
        } else {
            let _ = SetStretchBltMode(hdc_mem, COLORONCOLOR);
            gdi_ok(StretchBlt(hdc_mem, 0, 0, dest_w, dest_h, hdc_src, x, y, w, h, SRCCOPY))
        };
        if !blit_ok {
            SelectObject(hdc_mem, old);
            let _ = DeleteObject(as_gdiobj(hbmp));
            let _ = DeleteDC(hdc_mem);
            return Err("BitBlt falhou ao copiar a tela.".into());
        }

        let mut info = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: dest_w,
                biHeight: -dest_h,
                biPlanes: 1,
                biBitCount: 32,
                biCompression: 0,
                ..Default::default()
            },
            ..Default::default()
        };
        let mut buf = vec![0u8; (dest_w * dest_h * 4) as usize];
        let copied = GetDIBits(
            hdc_mem,
            hbmp,
            0,
            dest_h as u32,
            Some(buf.as_mut_ptr() as *mut _),
            &mut info,
            DIB_RGB_COLORS,
        );
        SelectObject(hdc_mem, old);
        let _ = DeleteObject(as_gdiobj(hbmp));
        let _ = DeleteDC(hdc_mem);
        if copied == 0 {
            return Err("GetDIBits falhou.".into());
        }
        Ok((dest_w as u32, dest_h as u32, buf))
    }

    unsafe fn grab_window(
        hwnd: HWND,
        max_w: Option<u32>,
        max_h: Option<u32>,
    ) -> Result<(u32, u32, Vec<u8>), String> {
        let mut rect = RECT::default();
        GetWindowRect(hwnd, &mut rect).map_err(|e| format!("GetWindowRect: {e}"))?;
        let w = (rect.right - rect.left).max(1);
        let h = (rect.bottom - rect.top).max(1);
        let hdc_win = GetWindowDC(hwnd);
        if hdc_win.is_invalid() {
            return Err("Nao foi possivel obter o DC da janela.".into());
        }

        let can_print = (w as i64).saturating_mul(h as i64) <= 1920 * 1080;
        if can_print {
            let hdc_print = CreateCompatibleDC(hdc_win);
            if !hdc_print.is_invalid() {
                let hbmp = CreateCompatibleBitmap(hdc_win, w, h);
                if !hbmp.is_invalid() {
                    let old = SelectObject(hdc_print, as_gdiobj(hbmp));
                    // PW_RENDERFULLCONTENT (2) captures DWM-composited clients, not just GDI.
                    let printed = PrintWindow(
                        unsafe { core::mem::transmute::<HWND, *mut core::ffi::c_void>(hwnd) },
                        unsafe { core::mem::transmute::<HDC, *mut core::ffi::c_void>(hdc_print) },
                        2,
                    ) != 0;
                    let printed_result = if printed {
                        grab_rect(hdc_print, 0, 0, w, h, max_w, max_h).ok()
                    } else {
                        None
                    };
                    SelectObject(hdc_print, old);
                    let _ = DeleteObject(as_gdiobj(hbmp));
                    let _ = DeleteDC(hdc_print);
                    if let Some(frame) = printed_result {
                        let _ = ReleaseDC(hwnd, hdc_win);
                        return Ok(frame);
                    }
                } else {
                    let _ = DeleteDC(hdc_print);
                }
            }
        }

        let result = grab_rect(hdc_win, 0, 0, w, h, max_w, max_h);
        let _ = ReleaseDC(hwnd, hdc_win);
        result
    }

    struct MonitorPick {
        index: u32,
        wanted: u32,
        rect: Option<RECT>,
    }

    unsafe extern "system" fn pick_monitor(
        monitor: HMONITOR,
        _hdc: HDC,
        _rect: *mut RECT,
        lparam: LPARAM,
    ) -> BOOL {
        let pick = &mut *(lparam.0 as *mut MonitorPick);
        if pick.index == pick.wanted {
            let mut info = MONITORINFOEXW::default();
            info.monitorInfo.cbSize = std::mem::size_of::<MONITORINFOEXW>() as u32;
            if gdi_ok(GetMonitorInfoW(monitor, &mut info.monitorInfo)) {
                pick.rect = Some(info.monitorInfo.rcMonitor);
            }
        }
        pick.index += 1;
        BOOL(1)
    }

    pub fn grab_target_bgra(
        target_id: &str,
        max_w: Option<u32>,
        max_h: Option<u32>,
    ) -> Result<(u32, u32, Vec<u8>), String> {
        unsafe {
            if target_id == "desktop" || target_id.is_empty() {
                let hdc = GetDC(HWND::default());
                if hdc.is_invalid() {
                    return Err("Nao foi possivel obter o DC da area de trabalho.".into());
                }
                let x = GetSystemMetrics(SM_XVIRTUALSCREEN);
                let y = GetSystemMetrics(SM_YVIRTUALSCREEN);
                let w = GetSystemMetrics(SM_CXVIRTUALSCREEN);
                let h = GetSystemMetrics(SM_CYVIRTUALSCREEN);
                let result = grab_rect(hdc, x, y, w, h, max_w, max_h);
                let _ = ReleaseDC(HWND::default(), hdc);
                return result;
            }

            if let Some(rest) = target_id.strip_prefix("screen:") {
                let wanted = rest.parse::<u32>().map_err(|_| "Monitor invalido.".to_string())?;
                let mut pick = MonitorPick {
                    index: 0,
                    wanted,
                    rect: None,
                };
                let _ = windows::Win32::Graphics::Gdi::EnumDisplayMonitors(
                    None,
                    None,
                    Some(pick_monitor),
                    LPARAM(&mut pick as *mut _ as isize),
                );
                let rect = pick.rect.ok_or_else(|| "Monitor nao encontrado.".to_string())?;
                let hdc = GetDC(HWND::default());
                if hdc.is_invalid() {
                    return Err("Nao foi possivel obter o DC da tela.".into());
                }
                let result = grab_rect(
                    hdc,
                    rect.left,
                    rect.top,
                    rect.right - rect.left,
                    rect.bottom - rect.top,
                    max_w,
                    max_h,
                );
                let _ = ReleaseDC(HWND::default(), hdc);
                return result;
            }

            if let Some(rest) = target_id.strip_prefix("window:") {
                let hwnd_val = rest.parse::<isize>().map_err(|_| "Janela invalida.".to_string())?;
                let hwnd = HWND(hwnd_val as *mut _);
                return grab_window(hwnd, max_w, max_h);
            }

            Err("Target de captura desconhecido.".into())
        }
    }
}
