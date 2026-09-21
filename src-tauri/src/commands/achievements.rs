//! Tauri commands: achievements
//! Substitui electron/achievements/achievement-bridge.cjs + achievement-summary.cjs

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use tauri::command;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AchievementDefinition {
    pub id: String,
    pub name: String,
    pub description: String,
    #[serde(default)]
    pub icon: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AchievementProgress {
    pub game_id: String,
    pub unlocked_achievements: HashMap<String, UnlockedAchievement>,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UnlockedAchievement {
    pub id: String,
    pub name: String,
    pub description: String,
    pub icon: String,
    pub unlocked_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AchievementLibrarySummary {
    pub by_game_id: HashMap<String, AchievementCount>,
    pub by_steam_app_id: HashMap<String, AchievementCount>,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AchievementCount {
    pub total: i64,
    pub unlocked: i64,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AchievementState {
    pub earned: bool,
    pub earned_time: i64,
}

// ── Local save-file paths ────────────────────────────────────────────────────

fn achievement_dir() -> PathBuf {
    dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("Pherielium")
        .join("achievements")
}

fn definitions_path(game_id: &str) -> PathBuf {
    achievement_dir().join(format!("{game_id}_definitions.json"))
}

fn progress_path(game_id: &str) -> PathBuf {
    achievement_dir().join(format!("{game_id}_progress.json"))
}

// ── Commands ─────────────────────────────────────────────────────────────────

#[command]
pub async fn achievement_get_definitions(
    game_id: String,
) -> Result<Option<serde_json::Value>, String> {
    let path = definitions_path(&game_id);
    if !path.exists() {
        return Ok(None);
    }
    let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let val: serde_json::Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    Ok(Some(val))
}

#[command]
pub async fn achievement_save_definitions(
    game_id: String,
    definitions: Vec<AchievementDefinition>,
    steam_app_id: Option<String>,
) -> Result<bool, String> {
    std::fs::create_dir_all(achievement_dir()).map_err(|e| e.to_string())?;
    let val = serde_json::json!({ "definitions": definitions, "steamAppId": steam_app_id });
    std::fs::write(definitions_path(&game_id), serde_json::to_string_pretty(&val).unwrap())
        .map_err(|e| e.to_string())?;
    Ok(true)
}

#[command]
pub async fn achievement_get_progress(
    game_id: String,
) -> Result<Option<AchievementProgress>, String> {
    let path = progress_path(&game_id);
    if !path.exists() {
        return Ok(None);
    }
    let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let progress: AchievementProgress = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    Ok(Some(progress))
}

#[command]
pub async fn achievement_unlock(
    app: tauri::AppHandle,
    game_id: String,
    achievement_id: String,
) -> Result<serde_json::Value, String> {
    let path = progress_path(&game_id);
    let mut progress: AchievementProgress = if path.exists() {
        let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).unwrap_or_else(|_| AchievementProgress {
            game_id: game_id.clone(),
            unlocked_achievements: HashMap::new(),
            updated_at: now_iso(),
        })
    } else {
        AchievementProgress {
            game_id: game_id.clone(),
            unlocked_achievements: HashMap::new(),
            updated_at: now_iso(),
        }
    };

    let duplicate = progress.unlocked_achievements.contains_key(&achievement_id);
    if !duplicate {
        let now_str = now_iso();
        progress.unlocked_achievements.insert(
            achievement_id.clone(),
            UnlockedAchievement {
                id: achievement_id.clone(),
                name: achievement_id.clone(),
                description: String::new(),
                icon: String::new(),
                unlocked_at: now_str.clone(),
            },
        );
        progress.updated_at = now_str.clone();
        std::fs::create_dir_all(achievement_dir()).map_err(|e| e.to_string())?;
        std::fs::write(&path, serde_json::to_string_pretty(&progress).unwrap())
            .map_err(|e| e.to_string())?;

        let unlock_payload = serde_json::json!({
            "gameId": game_id,
            "achievementId": achievement_id,
            "name": achievement_id,
            "title": achievement_id,
            "description": "Conquista desbloqueada!",
            "icon": "",
            "iconPath": "",
            "unlockedAt": now_str,
            "tier": "gold"
        });

        use tauri::Emitter;
        let _ = app.emit("achievement:realtime-unlock", unlock_payload.clone());
        crate::commands::overlay::send_overlay_event(&app, "achievement:unlock", unlock_payload);
    }

    Ok(serde_json::json!({ "duplicate": duplicate }))
}

#[command]
pub async fn achievement_get_local_state(
    app_id: String,
) -> Result<HashMap<String, AchievementState>, String> {
    // Uses emulator_detector supporting RUNE, Goldberg V1, Goldberg SocialClub, TENOKE, CODEX/INI
    let result = crate::commands::emulator_detector::read_retroactive_saves(&app_id, None);
    let mapped = result
        .into_iter()
        .map(|(k, s)| (k, AchievementState { earned: s.earned, earned_time: s.earned_time }))
        .collect();
    Ok(mapped)
}

#[command]
pub async fn achievement_get_library_summary() -> Result<AchievementLibrarySummary, String> {
    let dir = achievement_dir();
    let mut by_game_id = HashMap::new();
    let mut by_steam_app_id = HashMap::new();

    if let Ok(entries) = std::fs::read_dir(&dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            let name = path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();

            if name.ends_with("_definitions.json") {
                let game_id = name.trim_end_matches("_definitions.json").to_string();
                if let Ok(content) = std::fs::read_to_string(&path) {
                    if let Ok(val) = serde_json::from_str::<serde_json::Value>(&content) {
                        let total = val["definitions"].as_array().map(|a| a.len() as i64).unwrap_or(0);
                        let steam_app_id = val["steamAppId"].as_str().map(|s| s.to_string());

                        // Count unlocked from progress file
                        let progress_p = progress_path(&game_id);
                        let unlocked = if progress_p.exists() {
                            std::fs::read_to_string(&progress_p)
                                .ok()
                                .and_then(|c| serde_json::from_str::<AchievementProgress>(&c).ok())
                                .map(|p| p.unlocked_achievements.len() as i64)
                                .unwrap_or(0)
                        } else {
                            0
                        };

                        by_game_id.insert(game_id.clone(), AchievementCount { total, unlocked });
                        if let Some(sid) = steam_app_id {
                            by_steam_app_id.insert(sid, AchievementCount { total, unlocked });
                        }
                    }
                }
            }
        }
    }

    Ok(AchievementLibrarySummary {
        by_game_id,
        by_steam_app_id,
        updated_at: now_iso(),
    })
}

#[command]
pub async fn achievement_get_diagnostics(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let watcher_keys = crate::commands::achievement_watcher::get_active_watcher_keys(&app);
    Ok(serde_json::json!({
        "bridgePort": 0,
        "watcherKeys": watcher_keys,
        "monitoredGameKeys": [],
        "pendingRescanKeys": [],
        "overlayReady": true,
        "overlayDisplayId": null,
        "overlayVisible": false
    }))
}



// ── Helper ────────────────────────────────────────────────────────────────────

fn now_iso() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    format!("{}Z", secs) // simplified
}
