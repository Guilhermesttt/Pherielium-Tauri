use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager,
};

pub fn show_main_window(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_focus();
    }
}

pub fn create_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let handle = app.handle();

    let open_i = MenuItem::with_id(handle, "open", "Abrir Pherielium", true, None::<&str>)?;
    let quit_i = MenuItem::with_id(handle, "quit", "Sair", true, None::<&str>)?;
    let menu = Menu::with_items(handle, &[&open_i, &quit_i])?;

    let icon = app
        .default_window_icon()
        .cloned()
        .or_else(|| tauri::image::Image::from_bytes(include_bytes!("../icons/icon.png")).ok());

    let mut builder = TrayIconBuilder::with_id("main_tray")
        .tooltip("Pherielium")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| {
            match event.id.as_ref() {
                "open" => {
                    show_main_window(app);
                }
                "quit" => {
                    app.exit(0);
                }
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            match event {
                TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    ..
                } => {
                    show_main_window(tray.app_handle());
                }
                TrayIconEvent::DoubleClick {
                    button: MouseButton::Left,
                    ..
                } => {
                    show_main_window(tray.app_handle());
                }
                _ => {}
            }
        });

    if let Some(icon) = icon {
        builder = builder.icon(icon);
    }

    builder.build(app)?;

    Ok(())
}
