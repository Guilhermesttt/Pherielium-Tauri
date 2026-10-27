pub mod commands;
mod events;
mod store;
mod tray;
mod utils;

use commands::controller_config::{
    controller_profile_clear_game, controller_profile_get, controller_profile_list_games,
    controller_profile_reset_global, controller_profile_resolve, controller_profile_save,
    controller_curve_preview, controller_driver_status, controller_trigger_preview,
    hidhide_status, vigem_status,
};
use commands::audio_capture::{
    desktop_audio_capabilities, desktop_audio_selftest, desktop_audio_start, desktop_audio_stop, stream_debug_set,
    CaptureManager,
};
use commands::virtual_pad::{
    virtual_pad_attach, virtual_pad_detach, virtual_pad_is_attached, virtual_pad_update,
};
use commands::{
    achievement_watcher::*,
    achievements::*,
    auth::*,
    captures::*,
    emulator_detector::*,
    epic::*,
    game_watch::*,
    hardware::*,
    launcher::*,
    library::*,
    nexus::*,
    nexus_download::*,
    script_log::*,
    secure_storage::*,
    overlay::*,
    process_monitor::*,
    ptt::*,
    screen_capture::*,
    system::*,
    system_perf::*,
};

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // ── Plugins ────────────────────────────────────────────────────────
        // Instância única vem primeiro: um link nxm:// aberto no navegador chega a esta
        // instância (via deep-link) em vez de abrir um segundo Pherielium.
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            // o deep-link não entrega `nxm` (esquema dinâmico): lê o link direto dos argumentos
            commands::nexus_download::handle_nxm_args(app, &argv);
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_process::init())
        // ── States ─────────────────────────────────────────────────────────
        .manage(parking_lot::Mutex::new(OverlayRuntime::default()))
        .manage(GameWatchState::default())
        .manage(AchievementWatcherState::default())
        .manage(ScreenCaptureState::default())
        .manage(CaptureManager::default())
        .manage(EpicLoginState::default())
        // ── Lifecycle Setup ────────────────────────────────────────────────
        .setup(|app| {
            #[cfg(desktop)]
            {
                if let Some(main_win) = app.get_webview_window("main") {
                    if let Some(icon) = app.default_window_icon() {
                        let _ = main_win.set_icon(icon.clone());
                    } else if let Ok(icon) = tauri::image::Image::from_bytes(include_bytes!("../icons/icon.png")) {
                        let _ = main_win.set_icon(icon);
                    }

                    let win_clone = main_win.clone();
                    let app_handle = app.handle().clone();
                    main_win.on_window_event(move |event| {
                        if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                            use tauri::Emitter;
                            use tauri_plugin_store::StoreExt;
                            let store = app_handle.store("settings.json").ok();
                            let min_to_tray = store
                                .as_ref()
                                .and_then(|s| s.get("minimize_to_tray"))
                                .and_then(|v| v.as_bool())
                                .unwrap_or(true);
                            let confirm_before_exit = store
                                .as_ref()
                                .and_then(|s| s.get("confirm_before_exit"))
                                .and_then(|v| v.as_bool())
                                .unwrap_or(false);

                            if min_to_tray {
                                api.prevent_close();
                                let _ = win_clone.hide();
                            } else if confirm_before_exit {
                                api.prevent_close();
                                let _ = app_handle.emit("system:exit-confirmation-requested", ());
                            }
                        }
                    });
                }
                if let Err(e) = tray::create_tray(app) {
                    eprintln!("[Tray] Falha ao criar ícone da bandeja: {e}");
                }
            }
            // Links nxm:// (instalação automática de mods): os que chegam com o app aberto e o que
            // abriu o app. O protocolo só é registrado quando a pessoa pede (nexus_nxm_register).
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                let handle = app.handle().clone();
                app.deep_link().on_open_url(move |event| {
                    for url in event.urls() {
                        commands::nexus_download::handle_nxm_url(&handle, url.as_str());
                    }
                });
                if let Ok(Some(urls)) = app.deep_link().get_current() {
                    for url in urls {
                        commands::nexus_download::handle_nxm_url(app.handle(), url.as_str());
                    }
                }
                // app fechado quando o link chegou: o Windows o abre com o link como argumento
                let launch_args: Vec<String> = std::env::args().collect();
                commands::nexus_download::handle_nxm_args(app.handle(), &launch_args);
            }
            commands::overlay::init(app.handle());
            commands::overlay::register_overlay_shortcut(app.handle());
            commands::game_watch::start_game_watch(app.handle().clone());
            Ok(())
        })
        // ── Commands ───────────────────────────────────────────────────────
        .invoke_handler(tauri::generate_handler![
            // Library
            library_list,
            library_create,
            library_update,
            library_delete,
            library_delete_by_launcher,
            library_bulk_upsert,
            library_record_session,
            session_open,
            session_heartbeat,
            session_close,
            session_recover_orphans,
            library_get_summary,
            library_needs_legacy_import,
            library_import_legacy,
            library_mark_summary_synced,
            library_clear_steam_id,
            steam_fetch_public_library,
            steam_fetch_player_achievements_batch,
            steam_search_store,
            steam_fetch_app_details,
            // Launcher
            launcher_open_executable,
            launcher_select_executable,
            launcher_select_folder,
            // Process monitor
            process_detect_running,
            process_detect_running_details,
            process_is_running,
            process_is_pid_running,
            game_scan_local,
            steam_scan_installed_games,
            // Achievements
            achievement_get_definitions,
            achievement_save_definitions,
            achievement_get_progress,
            achievement_unlock,
            achievement_get_local_state,
            achievement_get_library_summary,
            achievement_get_diagnostics,
            emulator_detect_for_game,
            detect_app_id_from_path,
            // Epic
            epic_get_status,
            epic_list_library,
            epic_logout,
            epic_validate_session,
            epic_get_achievements,
            epic_authenticate,
            epic_search_store,
            epic_open_login_window,
            epic_capture_auth_code,
            epic_fetch_store_details,
            epic_resolve_watch_target,
            // Nexus
            nexus_get_status,
            nexus_connect_personal_key,
            nexus_validate_connection,
            nexus_disconnect,
            secure_storage_get,
            secure_storage_set,
            secure_storage_remove,
            nexus_get_mod_catalog,
            nexus_get_mod_details,
            nexus_get_mod_files,
            nexus_select_game_directory,
            nexus_get_download_state,
            nexus_list_downloads,
            nexus_pause_download,
            nexus_resume_download,
            nexus_cancel_download,
            mods_check_script_log,
            nexus_prepare_free_download,
            nexus_install_downloaded_mod,
            nexus_adopt_installed_mod,
            nexus_remove_installed_mod,
            nexus_nxm_status,
            nexus_nxm_register,
            nexus_nxm_unregister,
            nexus_list_downloaded_files,
            nexus_open_download_location,
            // Hardware
            controller_get_battery,
            // System & Window
            system_open_external,
            system_open_path,
            system_copy_to_clipboard,
            system_show_battery_warning,
            system_request_app_quit,
            system_confirm_app_quit,
            system_set_open_at_login,
            system_is_fullscreen_active,
            system_get_media_info,
            controller_profile_resolve,
            controller_profile_get,
            controller_profile_save,
            controller_profile_clear_game,
            controller_profile_reset_global,
            controller_profile_list_games,
            controller_curve_preview,
            controller_trigger_preview,
            vigem_status,
            hidhide_status,
            controller_driver_status,
            virtual_pad_attach,
            virtual_pad_detach,
            virtual_pad_is_attached,
            virtual_pad_update,
            desktop_audio_capabilities,
            desktop_audio_selftest,
            system_media_play_pause,
            system_media_set_playing,
            system_media_next,
            system_media_previous,
            window_set_behavior,
            window_fullscreen_toggle,
            window_fullscreen_set,
            window_fullscreen_get,
            window_show,
            window_minimize,
            window_maximize_toggle,
            window_is_maximized,
            window_close,
            // Auth
            auth_start_google_browser,
            auth_poll_google_status,
            auth_start_linked_account_browser,
            app_get_version,
            // Overlay
            overlay_ensure,
            overlay_show_game_start,
            overlay_show_social,
            overlay_dismiss_notification,
            overlay_update_panel,
            overlay_notify_unlock,
            overlay_test_welcome,
            overlay_test_achievement,
            overlay_panel_action,
            overlay_set_ignore_cursor_events,
            overlay_set_cursor_watch,
            overlay_toggle_panel,
            overlay_set_panel_open,
            overlay_launch_handoff,
            overlay_audio_level_start,
            capture_import_files,
            overlay_audio_level_stop,
            launcher_hide_main,
            overlay_get_panel_state,
            overlay_get_capture_shortcut,
            overlay_set_capture_shortcut,
            overlay_get_overlay_shortcut,
            overlay_set_overlay_shortcut,
            overlay_prefs_get,
            overlay_prefs_set,
            // Performance Monitor
            system_perf_snapshot,
            // Captures
            list_recent_captures,
            open_captures_folder,
            get_captures_dir,
            capture_screen,
            get_capture_full_image,
            delete_capture,
            // Game Watch
            game_watch_set_target,
            game_watch_stop,
            // Screen Share & Native Frame Grab
            screen_share_list_targets,
            screen_share_check_permissions,
            screen_share_request_permission,
            screen_share_start,
            screen_share_start_frames,
            screen_share_stop,
            screen_share_status,
            desktop_audio_start,
            desktop_audio_stop,
            stream_debug_set,
            capture_target_jpeg,
            // Push-to-Talk
            ptt_register,
            ptt_unregister,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
