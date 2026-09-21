//! Tauri commands: game launching and executable selection
//! Substitui a lógica de launch do electron/main.cjs

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::{command, AppHandle, Manager};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GameLaunchProfile {
    #[serde(default)]
    pub launch_args: Vec<String>,
    #[serde(default)]
    pub working_dir: Option<String>,
    #[serde(default)]
    pub env_vars: Option<std::collections::HashMap<String, String>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LaunchOptions {
    #[serde(default)]
    pub hide_launcher: bool,
}

#[command]
pub async fn launcher_open_executable(
    app: AppHandle,
    path: String,
    profile: Option<GameLaunchProfile>,
    opts: Option<LaunchOptions>,
) -> Result<(), String> {
    let exe = PathBuf::from(&path);
    if !exe.exists() {
        return Err(format!("Executable not found: {path}"));
    }

    let mut cmd = tokio::process::Command::new(&exe);

    // Set working directory to the executable's parent
    if let Some(ref p) = profile {
        if let Some(ref wd) = p.working_dir {
            cmd.current_dir(wd);
        } else if let Some(parent) = exe.parent() {
            cmd.current_dir(parent);
        }
        if let Some(ref env_vars) = p.env_vars {
            for (k, v) in env_vars {
                cmd.env(k, v);
            }
        }
        cmd.args(&p.launch_args);
    } else if let Some(parent) = exe.parent() {
        cmd.current_dir(parent);
    }

    // Detach from the launcher process on Windows
    #[cfg(target_os = "windows")]
    {
        const DETACHED_PROCESS: u32 = 0x00000008;
        const CREATE_NEW_PROCESS_GROUP: u32 = 0x00000200;
        cmd.creation_flags(DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP);
    }

    cmd.spawn().map_err(|e| format!("Failed to launch: {e}"))?;

    // Automatically set game watch target and start achievement watcher for local games
    if let Some(target_name) = exe.file_name().map(|f| f.to_string_lossy().to_string()) {
        if let Some(state) = app.try_state::<crate::commands::game_watch::GameWatchState>() {
            let _ = crate::commands::game_watch::game_watch_set_target(state, Some(target_name.clone()));
        }
        let game_dir = exe.parent();
        let app_id = game_dir.and_then(crate::commands::emulator_detector::detect_game_app_id);
        let game_id = app_id.as_ref().map(|id| format!("steam_{id}")).unwrap_or(target_name);
        crate::commands::achievement_watcher::start_achievement_watcher(
            app.clone(),
            game_id,
            app_id,
            Some(path.clone()),
        );
    }

    // Optionally minimize the launcher window
    if let Some(opts) = opts {
        if opts.hide_launcher {
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.minimize();
            }
        }
    }

    Ok(())
}

#[command]
pub async fn launcher_select_executable(app: AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;

    let path = app
        .dialog()
        .file()
        .add_filter("Executable", &["exe", "bat", "cmd", "lnk"])
        .blocking_pick_file();

    Ok(path.and_then(|p| p.into_path().ok()).map(|p| p.to_string_lossy().to_string()))
}
