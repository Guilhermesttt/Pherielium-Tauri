//! Game process detection + overlay window positioning.

use parking_lot::Mutex;
use serde_json::json;
use std::time::Duration;
use sysinfo::{ProcessesToUpdate, ProcessRefreshKind, RefreshKind, System};
use tauri::{AppHandle, Emitter, Manager, State};

#[derive(Default)]
pub struct GameWatchState {
    target_executable: Mutex<Option<String>>,
    active: Mutex<bool>,
}

fn normalize_executable(value: &str) -> String {
    value.trim().replace('/', "\\").to_lowercase()
}

fn executable_basename(value: &str) -> String {
    let normalized = normalize_executable(value);
    normalized
        .rsplit(['\\', '/'])
        .next()
        .unwrap_or(normalized.as_str())
        .to_string()
}

fn find_target_pid(system: &System, target: &str) -> Option<sysinfo::Pid> {
    let wanted = executable_basename(target);
    system.processes().iter().find_map(|(&pid, process)| {
        if executable_basename(&process.name().to_string_lossy()) == wanted {
            Some(pid)
        } else {
            None
        }
    })
}

pub fn ensure_overlay_fullscreen(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("overlay") {
        if let Ok(Some(monitor)) = app.primary_monitor() {
            let size = monitor.size();
            let pos = monitor.position();
            let _ = window.set_position(tauri::Position::Physical(*pos));
            let _ = window.set_size(tauri::Size::Physical(*size));
        }
    }
}

#[tauri::command]
pub fn game_watch_set_target(
    state: State<'_, GameWatchState>,
    executable: Option<String>,
) -> Result<(), String> {
    let normalized = executable
        .map(|value| executable_basename(&value))
        .filter(|value| !value.is_empty());
    *state.target_executable.lock() = normalized;
    *state.active.lock() = true;
    Ok(())
}

#[tauri::command]
pub fn game_watch_stop(state: State<'_, GameWatchState>) -> Result<(), String> {
    *state.target_executable.lock() = None;
    *state.active.lock() = false;
    Ok(())
}

pub fn reveal_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

pub fn conceal_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
}

pub fn start_game_watch(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let refresh_kind = ProcessRefreshKind::new().with_exe(sysinfo::UpdateKind::Always);
        let mut system = System::new_with_specifics(
            RefreshKind::new().with_processes(refresh_kind),
        );
        let mut was_running = false;
        let mut last_target: Option<String> = None;
        let mut tracked_pid: Option<sysinfo::Pid> = None;

        loop {
            // Adaptive sleep: 1000ms while running smoothly, 500ms when waiting for game to launch
            let sleep_ms = if was_running { 1000 } else { 500 };
            tokio::time::sleep(Duration::from_millis(sleep_ms)).await;

            let Some(state) = app.try_state::<GameWatchState>() else {
                continue;
            };
            let target = state.target_executable.lock().clone();
            let active = *state.active.lock();
            if !active || target.is_none() {
                if was_running {
                    was_running = false;
                    reveal_main_window(&app);
                    let _ = app.emit(
                        "game-watch:ended",
                        json!({ "executable": last_target }),
                    );
                }
                last_target = None;
                tracked_pid = None;
                continue;
            }
            let target = target.unwrap();
            last_target = Some(target.clone());

            let is_running = if let Some(pid) = tracked_pid {
                system.refresh_processes_specifics(ProcessesToUpdate::Some(&[pid]), true, refresh_kind);
                if let Some(proc) = system.process(pid) {
                    executable_basename(&proc.name().to_string_lossy()) == executable_basename(&target)
                } else {
                    tracked_pid = None;
                    false
                }
            } else {
                system.refresh_processes_specifics(ProcessesToUpdate::All, true, refresh_kind);
                if let Some(pid) = find_target_pid(&system, &target) {
                    tracked_pid = Some(pid);
                    true
                } else {
                    false
                }
            };

            if !is_running {
                if was_running {
                    was_running = false;
                    tracked_pid = None;
                    crate::commands::achievement_watcher::stop_all_achievement_watchers(&app);
                    reveal_main_window(&app);
                    let _ = app.emit("game-watch:ended", json!({ "executable": target }));
                }
                continue;
            }

            if !was_running {
                was_running = true;
                conceal_main_window(&app);
                ensure_overlay_fullscreen(&app);
                let _ = app.emit("game-watch:started", json!({ "executable": target }));
            }
        }
    });
}
