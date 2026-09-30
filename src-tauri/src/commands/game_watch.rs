//! Game process detection + overlay window positioning.

use parking_lot::Mutex;
use serde_json::json;
use std::path::PathBuf;
use std::time::Duration;
use sysinfo::{ProcessesToUpdate, ProcessRefreshKind, RefreshKind, System};
use tauri::{AppHandle, Emitter, Manager, State};

#[derive(Default)]
pub struct GameWatchState {
    target_executable: Mutex<Option<String>>,
    target_dir: Mutex<Option<PathBuf>>,
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
    let wanted_stem = wanted.trim_end_matches(".exe");
    system.processes().iter().find_map(|(&pid, process)| {
        let name = executable_basename(&process.name().to_string_lossy());
        let name_stem = name.trim_end_matches(".exe");
        if name.eq_ignore_ascii_case(&wanted)
            || (!wanted_stem.is_empty() && name_stem.eq_ignore_ascii_case(wanted_stem))
        {
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
    let dir = executable.as_ref().and_then(|val| {
        let clean = val.trim_matches('"').trim_matches('\'');
        let p = PathBuf::from(clean);
        if p.is_dir() {
            Some(p)
        } else if p.is_absolute() {
            p.parent().map(|d| d.to_path_buf())
        } else {
            None
        }
    });
    let normalized = executable
        .as_ref()
        .map(|value| executable_basename(value.trim_matches('"').trim_matches('\'')))
        .filter(|value| !value.is_empty());
    *state.target_executable.lock() = normalized;
    *state.target_dir.lock() = dir;
    *state.active.lock() = true;
    Ok(())
}

#[tauri::command]
pub fn game_watch_stop(state: State<'_, GameWatchState>) -> Result<(), String> {
    *state.target_executable.lock() = None;
    *state.target_dir.lock() = None;
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
        let mut handoff_grace_ticks: u32 = 0;

        loop {
            // Adaptive sleep: 1000ms while running smoothly, 500ms when waiting for game to launch
            let sleep_ms = if was_running { 1000 } else { 500 };
            tokio::time::sleep(Duration::from_millis(sleep_ms)).await;

            let Some(state) = app.try_state::<GameWatchState>() else {
                continue;
            };
            let target = state.target_executable.lock().clone();
            let target_dir = state.target_dir.lock().clone();
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
                handoff_grace_ticks = 0;
                continue;
            }
            let target = target.unwrap();
            last_target = Some(target.clone());

            let mut is_running = if let Some(pid) = tracked_pid {
                system.refresh_processes_specifics(ProcessesToUpdate::Some(&[pid]), true, refresh_kind);
                if let Some(proc) = system.process(pid) {
                    let proc_name = executable_basename(&proc.name().to_string_lossy());
                    let proc_stem = proc_name.trim_end_matches(".exe");
                    let target_name = executable_basename(&target);
                    let target_stem = target_name.trim_end_matches(".exe");
                    proc_name.eq_ignore_ascii_case(&target_name)
                        || (!target_stem.is_empty() && proc_stem.eq_ignore_ascii_case(target_stem))
                        || target_dir.as_ref().map_or(false, |dir| {
                            proc.exe().map_or(false, |exe| exe.starts_with(dir))
                        })
                } else {
                    tracked_pid = None;
                    false
                }
            } else {
                system.refresh_processes_specifics(ProcessesToUpdate::All, true, refresh_kind);
                if let Some(pid) = find_target_pid(&system, &target) {
                    tracked_pid = Some(pid);
                    true
                } else if let Some(ref dir) = target_dir {
                    if let Some((&pid, _)) = system.processes().iter().find(|(_, proc)| {
                        proc.exe().map_or(false, |exe| exe.starts_with(dir))
                    }) {
                        tracked_pid = Some(pid);
                        true
                    } else {
                        false
                    }
                } else {
                    false
                }
            };

            // If the launcher just exited but was_running was true, give a grace period
            // to detect the actual game process spawned in the game directory (e.g. launcher.exe -> game.exe)
            if !is_running && was_running && target_dir.is_some() {
                if handoff_grace_ticks < 20 {
                    handoff_grace_ticks += 1;
                    system.refresh_processes_specifics(ProcessesToUpdate::All, true, refresh_kind);
                    if let Some(ref dir) = target_dir {
                        if let Some((&pid, _)) = system.processes().iter().find(|(_, proc)| {
                            proc.exe().map_or(false, |exe| exe.starts_with(dir))
                        }) {
                            tracked_pid = Some(pid);
                            handoff_grace_ticks = 0;
                            is_running = true;
                        } else {
                            // Still within grace period, keep was_running alive
                            continue;
                        }
                    }
                }
            }

            if !is_running {
                if was_running {
                    was_running = false;
                    tracked_pid = None;
                    handoff_grace_ticks = 0;
                    crate::commands::achievement_watcher::stop_all_achievement_watchers(&app);
                    reveal_main_window(&app);
                    let _ = app.emit("game-watch:ended", json!({ "executable": target }));
                }
                continue;
            }

            handoff_grace_ticks = 0;

            if !was_running {
                was_running = true;
                conceal_main_window(&app);
                ensure_overlay_fullscreen(&app);
                let _ = app.emit("game-watch:started", json!({ "executable": target }));
            }
        }
    });
}
