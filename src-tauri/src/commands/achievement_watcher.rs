//! Realtime Achievement Watcher for local game emulators.
//! Watches the emulator save file while a game is running and emits unlock events in real time.

use crate::commands::emulator_detector::{
    detect_emulator, detect_game_app_id, read_achievements_from_emulator,
    read_goldberg_settings_achievements, DetectedEmulator,
};
use crate::commands::overlay::send_overlay_event;
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, SystemTime};
use tauri::{AppHandle, Emitter, Manager};

#[derive(Default)]
pub struct AchievementWatcherState {
    active_watchers: Mutex<HashMap<String, Arc<AtomicBool>>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct SimpleDefinition {
    pub name: String,
    pub description: String,
    pub icon: String,
}

fn achievement_dir() -> PathBuf {
    dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("Pherielium")
        .join("achievements")
}

fn progress_path(game_id: &str) -> PathBuf {
    achievement_dir().join(format!("{game_id}_progress.json"))
}

fn definitions_path(game_id: &str) -> PathBuf {
    achievement_dir().join(format!("{game_id}_definitions.json"))
}

fn now_iso() -> String {
    use std::time::UNIX_EPOCH;
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    format!("{secs}Z")
}

fn load_definitions_for_game(
    game_id: &str,
    game_dir: Option<&Path>,
) -> HashMap<String, SimpleDefinition> {
    let mut map = HashMap::new();

    // 1. Try local definitions file
    let def_p = definitions_path(game_id);
    if def_p.exists() {
        if let Ok(content) = std::fs::read_to_string(&def_p) {
            if let Ok(val) = serde_json::from_str::<serde_json::Value>(&content) {
                if let Some(list) = val.get("definitions").and_then(|v| v.as_array()) {
                    for item in list {
                        let id = item.get("id").and_then(|v| v.as_str()).unwrap_or("").trim();
                        if id.is_empty() {
                            continue;
                        }
                        let name = item.get("name").and_then(|v| v.as_str()).unwrap_or(id).to_string();
                        let description = item.get("description").and_then(|v| v.as_str()).unwrap_or("").to_string();
                        let icon = item.get("icon").and_then(|v| v.as_str()).unwrap_or("").to_string();
                        map.insert(id.to_string(), SimpleDefinition { name, description, icon });
                    }
                }
            }
        }
    }

    // 2. Fallback: Goldberg steam_settings/achievements.json
    if map.is_empty() {
        if let Some(dir) = game_dir {
            if let Some(goldberg_defs) = read_goldberg_settings_achievements(dir) {
                for gd in goldberg_defs {
                    map.insert(
                        gd.id.clone(),
                        SimpleDefinition {
                            name: gd.name,
                            description: gd.description,
                            icon: gd.icon,
                        },
                    );
                }
            }
        }
    }

    map
}

fn record_local_achievement_unlock(
    game_id: &str,
    ach_id: &str,
    name: &str,
    description: &str,
    icon: &str,
    unlocked_at: &str,
) -> Result<(), String> {
    let dir = achievement_dir();
    let _ = std::fs::create_dir_all(&dir);
    let p_path = progress_path(game_id);

    let mut data: serde_json::Value = if p_path.exists() {
        std::fs::read_to_string(&p_path)
            .ok()
            .and_then(|c| serde_json::from_str(&c).ok())
            .unwrap_or_else(|| json!({ "gameId": game_id, "unlockedAchievements": {} }))
    } else {
        json!({ "gameId": game_id, "unlockedAchievements": {} })
    };

    if let Some(obj) = data.as_object_mut() {
        let unlocks = obj
            .entry("unlockedAchievements")
            .or_insert_with(|| json!({}));

        if let Some(u_obj) = unlocks.as_object_mut() {
            u_obj.insert(
                ach_id.to_string(),
                json!({
                    "id": ach_id,
                    "name": name,
                    "description": description,
                    "icon": icon,
                    "unlockedAt": unlocked_at,
                }),
            );
        }
        obj.insert("updatedAt".to_string(), json!(unlocked_at));
    }

    if let Ok(serialized) = serde_json::to_string_pretty(&data) {
        let _ = std::fs::write(&p_path, serialized);
    }

    Ok(())
}

pub fn start_achievement_watcher(
    app: AppHandle,
    game_id: String,
    provided_app_id: Option<String>,
    executable_path: Option<String>,
) {
    let Some(state) = app.try_state::<AchievementWatcherState>() else {
        return;
    };

    let watcher_key = game_id.clone();
    stop_achievement_watcher(&app, &watcher_key);

    let cancel_flag = Arc::new(AtomicBool::new(false));
    state.active_watchers.lock().insert(watcher_key.clone(), cancel_flag.clone());

    let app_clone = app.clone();
    let game_id_clone = game_id.clone();

    tauri::async_runtime::spawn(async move {
        let game_dir: Option<PathBuf> = executable_path
            .as_ref()
            .map(PathBuf::from)
            .and_then(|p| p.parent().map(|p| p.to_path_buf()));

        let app_id = provided_app_id
            .filter(|id| !id.trim().is_empty())
            .or_else(|| game_dir.as_deref().and_then(detect_game_app_id));

        let Some(app_id) = app_id else {
            eprintln!("[AchievementWatcher] Não foi possível identificar appId para {game_id_clone}");
            return;
        };

        // 1. Re-scan loop: check up to 30 seconds (15 attempts x 2000ms)
        let mut detected: Option<DetectedEmulator> = None;
        for _ in 1..=15 {
            if cancel_flag.load(Ordering::Relaxed) {
                return;
            }

            if let Some(emu) = detect_emulator(game_dir.as_deref(), &app_id) {
                if emu.save_path.exists() {
                    detected = Some(emu);
                    break;
                }
            }

            tokio::time::sleep(Duration::from_millis(2000)).await;
        }

        let Some(emulator) = detected else {
            eprintln!("[AchievementWatcher] Nenhum save de emulador detectado para appId {app_id} (game {game_id_clone})");
            return;
        };

        eprintln!(
            "[AchievementWatcher] Monitorando conquistas: {:?} em {:?}",
            emulator.emulator_type, emulator.save_path
        );

        // 2. Read initial state
        let mut last_state = read_achievements_from_emulator(&emulator);
        let mut last_mtime = std::fs::metadata(&emulator.save_path)
            .and_then(|m| m.modified())
            .unwrap_or(SystemTime::UNIX_EPOCH);

        // 3. Polling loop: check modification time every 1000ms
        while !cancel_flag.load(Ordering::Relaxed) {
            tokio::time::sleep(Duration::from_millis(1000)).await;

            if cancel_flag.load(Ordering::Relaxed) {
                break;
            }

            let Ok(metadata) = std::fs::metadata(&emulator.save_path) else {
                continue;
            };

            let Ok(mtime) = metadata.modified() else {
                continue;
            };

            if mtime <= last_mtime {
                continue;
            }

            last_mtime = mtime;

            let new_state = read_achievements_from_emulator(&emulator);
            let mut newly_unlocked = Vec::new();

            for (id, current) in &new_state {
                let previously_earned = last_state.get(id).map(|s| s.earned).unwrap_or(false);
                if current.earned && !previously_earned {
                    newly_unlocked.push((id.clone(), current.earned_time));
                }
            }

            if !newly_unlocked.is_empty() {
                let definitions = load_definitions_for_game(&game_id_clone, game_dir.as_deref());

                for (ach_id, _earned_time) in newly_unlocked {
                    let unlock_time_str = now_iso();

                    let (name, description, icon) = if let Some(def) = definitions.get(&ach_id) {
                        (def.name.clone(), def.description.clone(), def.icon.clone())
                    } else {
                        (ach_id.clone(), "Conquista desbloqueada!".to_string(), String::new())
                    };

                    let _ = record_local_achievement_unlock(
                        &game_id_clone,
                        &ach_id,
                        &name,
                        &description,
                        &icon,
                        &unlock_time_str,
                    );

                    let unlock_payload = json!({
                        "gameId": game_id_clone,
                        "achievementId": ach_id,
                        "name": name,
                        "title": name,
                        "description": description,
                        "icon": icon,
                        "iconPath": icon,
                        "unlockedAt": unlock_time_str,
                        "tier": "gold"
                    });

                    // Emit to main renderer window
                    let _ = app_clone.emit("achievement:realtime-unlock", unlock_payload.clone());

                    // Emit to overlay window
                    send_overlay_event(&app_clone, "achievement:unlock", unlock_payload);
                }
            }

            last_state = new_state;
        }

        eprintln!("[AchievementWatcher] Watcher finalizado para {game_id_clone}");
    });
}

pub fn stop_achievement_watcher(app: &AppHandle, watcher_key: &str) {
    if let Some(state) = app.try_state::<AchievementWatcherState>() {
        if let Some(flag) = state.active_watchers.lock().remove(watcher_key) {
            flag.store(true, Ordering::Relaxed);
        }
    }
}

pub fn stop_all_achievement_watchers(app: &AppHandle) {
    if let Some(state) = app.try_state::<AchievementWatcherState>() {
        let mut map = state.active_watchers.lock();
        for (_, flag) in map.drain() {
            flag.store(true, Ordering::Relaxed);
        }
    }
}

pub fn get_active_watcher_keys(app: &AppHandle) -> Vec<String> {
    if let Some(state) = app.try_state::<AchievementWatcherState>() {
        state.active_watchers.lock().keys().cloned().collect()
    } else {
        Vec::new()
    }
}
