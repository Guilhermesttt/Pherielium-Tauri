//! Game process detection + overlay window positioning.

use crate::commands::process_identity::{
    find_process_by_exact_path, find_process_in_directory, normalize_path, paths_match_exact,
    process_exe_within_dir, process_start_time_ms,
};
use parking_lot::Mutex;
use serde_json::json;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};
use sysinfo::{ProcessesToUpdate, ProcessRefreshKind, RefreshKind, System};
use tauri::{AppHandle, Emitter, Manager, State};

/// After launch, exact-path is prioritized for this long before directory scan.
pub const LAUNCH_DIRECTORY_GRACE_SECS: u64 = 3;

#[derive(Default)]
pub struct GameWatchState {
    target_executable: Mutex<Option<String>>,
    target_dir: Mutex<Option<PathBuf>>,
    target_set_at: Mutex<Option<Instant>>,
    target_is_directory: Mutex<bool>,
    active: Mutex<bool>,
    /// When true, hide the hub on game start and show it only after a confirmed exit.
    restore_launcher: Mutex<bool>,
}

fn resolve_target_dir(executable: &str) -> Option<PathBuf> {
    let clean = executable.trim_matches('"').trim_matches('\'');
    let path = PathBuf::from(clean);
    if path.is_dir() {
        Some(path)
    } else if path.is_absolute() {
        path.parent().map(|parent| parent.to_path_buf())
    } else {
        None
    }
}

fn emit_started(
    app: &AppHandle,
    requested_executable: &str,
    matched_path: &str,
    pid: u32,
    process_start_time_ms: Option<u64>,
) {
    let _ = app.emit(
        "game-watch:started",
        json!({
            "executable": requested_executable,
            "matchedPath": matched_path,
            "pid": pid,
            "processStartTimeMs": process_start_time_ms,
        }),
    );
}

pub fn ensure_overlay_fullscreen(app: &AppHandle) {
    // Usa o monitor do jogo (mesma lógica do overlay.rs) em vez de forçar o
    // primário, que brigava com a escolha por título de janela.
    super::overlay::refresh_overlay_geometry(app);
}

#[tauri::command]
pub fn game_watch_set_target(
    state: State<'_, GameWatchState>,
    executable: Option<String>,
) -> Result<(), String> {
    let cleaned = executable
        .as_ref()
        .map(|value| value.trim_matches('"').trim_matches('\'').trim().to_string())
        .filter(|value| !value.is_empty());
    let normalized = cleaned.as_ref().map(|value| normalize_path(value));
    let is_directory = cleaned
        .as_ref()
        .map(|value| Path::new(value).is_dir())
        .unwrap_or(false);
    let dir = cleaned
        .as_ref()
        .and_then(|value| resolve_target_dir(value));
    *state.target_executable.lock() = normalized;
    *state.target_dir.lock() = dir;
    *state.target_set_at.lock() = Some(Instant::now());
    *state.target_is_directory.lock() = is_directory;
    *state.active.lock() = true;
    Ok(())
}

#[tauri::command]
pub fn game_watch_stop(state: State<'_, GameWatchState>) -> Result<(), String> {
    *state.target_executable.lock() = None;
    *state.target_dir.lock() = None;
    *state.target_set_at.lock() = None;
    *state.target_is_directory.lock() = false;
    *state.active.lock() = false;
    Ok(())
}

fn should_restore_launcher(app: &AppHandle) -> bool {
    app.try_state::<GameWatchState>()
        .map(|state| *state.restore_launcher.lock())
        .unwrap_or(false)
}

pub fn reveal_main_window(app: &AppHandle) {
    if !should_restore_launcher(app) {
        return;
    }
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
    if let Some(state) = app.try_state::<GameWatchState>() {
        *state.restore_launcher.lock() = false;
    }
}

pub fn conceal_main_window(app: &AppHandle) {
    if let Some(state) = app.try_state::<GameWatchState>() {
        *state.restore_launcher.lock() = true;
    }
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
}

pub fn set_restore_launcher(app: &AppHandle, restore: bool) {
    if let Some(state) = app.try_state::<GameWatchState>() {
        *state.restore_launcher.lock() = restore;
    }
}

fn locate_target_process(
    system: &System,
    target_path: &str,
    target_dir: Option<&Path>,
    tracked_pid: Option<sysinfo::Pid>,
    allow_directory_fallback: bool,
) -> Option<(sysinfo::Pid, PathBuf, Option<u64>)> {
    if let Some(pid) = tracked_pid {
        if let Some(process) = system.process(pid) {
            let exe = process.exe()?.to_path_buf();
            if paths_match_exact(Some(&exe), target_path)
                || target_dir.map_or(false, |dir| process_exe_within_dir(Some(&exe), dir))
            {
                return Some((pid, exe, process_start_time_ms(process)));
            }
        }
        return None;
    }

    if let Some((pid, matched_path)) = find_process_by_exact_path(system, target_path) {
        let start_ms = system
            .process(pid)
            .and_then(process_start_time_ms);
        return Some((pid, matched_path, start_ms));
    }

    if allow_directory_fallback {
        if let Some(dir) = target_dir {
            if let Some((pid, matched_path)) = find_process_in_directory(system, dir) {
                let start_ms = system
                    .process(pid)
                    .and_then(process_start_time_ms);
                return Some((pid, matched_path, start_ms));
            }
        }
    }

    None
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
            let sleep_ms = if was_running { 1000 } else { 500 };
            tokio::time::sleep(Duration::from_millis(sleep_ms)).await;

            let Some(state) = app.try_state::<GameWatchState>() else {
                continue;
            };
            let target = state.target_executable.lock().clone();
            let target_dir = state.target_dir.lock().clone();
            let target_set_at = *state.target_set_at.lock();
            let target_is_directory = *state.target_is_directory.lock();
            let active = *state.active.lock();
            let allow_directory_fallback = if target_is_directory {
                true
            } else {
                target_set_at
                    .map(|set_at| set_at.elapsed() >= Duration::from_secs(LAUNCH_DIRECTORY_GRACE_SECS))
                    .unwrap_or(false)
            };
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

            let mut pid_refresh_buf = [sysinfo::Pid::from(0_usize); 1];
            let processes_to_update = if let Some(pid) = tracked_pid {
                pid_refresh_buf[0] = pid;
                ProcessesToUpdate::Some(&pid_refresh_buf[..])
            } else {
                ProcessesToUpdate::All
            };
            system.refresh_processes_specifics(processes_to_update, true, refresh_kind);

            let mut located = locate_target_process(
                &system,
                &target,
                target_dir.as_deref(),
                tracked_pid,
                allow_directory_fallback,
            );

            if located.is_none() && tracked_pid.is_some() {
                tracked_pid = None;
                system.refresh_processes_specifics(ProcessesToUpdate::All, true, refresh_kind);
                located = locate_target_process(
                    &system,
                    &target,
                    target_dir.as_deref(),
                    None,
                    allow_directory_fallback,
                );
            }

            if let Some((pid, matched_path, start_ms)) = located {
                tracked_pid = Some(pid);
                handoff_grace_ticks = 0;

                if !was_running {
                    was_running = true;
                    conceal_main_window(&app);
                    ensure_overlay_fullscreen(&app);
                    emit_started(
                        &app,
                        &target,
                        &matched_path.to_string_lossy(),
                        pid.as_u32(),
                        start_ms,
                    );
                }
                continue;
            }

            if !was_running {
                continue;
            }

            // Launcher helpers/bootstrappers die before the real game exe. Wait ~15s before ending,
            // preventing the window from bouncing open/shut prematurely while the game loads.
            if handoff_grace_ticks < 15 {
                handoff_grace_ticks += 1;
                continue;
            }

            was_running = false;
            tracked_pid = None;
            handoff_grace_ticks = 0;
            crate::commands::achievement_watcher::stop_all_achievement_watchers(&app);
            reveal_main_window(&app);
            let _ = app.emit("game-watch:ended", json!({ "executable": target }));
        }
    });
}
