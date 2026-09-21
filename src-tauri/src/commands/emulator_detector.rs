//! Emulator detector for local game achievements.
//! Ports the complete adapter pattern from Checkpoint---Launcher's emulator-detector.cjs to Rust.
//! Supports RUNE, Goldberg V1, Goldberg SocialClub, TENOKE, CODEX / Generic INI.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EmulatorType {
    Rune,
    GoldbergV1,
    GoldbergSocialClub,
    Tenoke,
    GenericIni,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DetectedEmulator {
    pub emulator_type: EmulatorType,
    pub save_path: PathBuf,
    pub watch_dir: PathBuf,
    pub app_id: String,
    pub game_dir: Option<PathBuf>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AchievementState {
    pub earned: bool,
    pub earned_time: i64,
}

// ─── App ID Detection ────────────────────────────────────────────────────────

pub fn detect_game_app_id(game_dir: &Path) -> Option<String> {
    let candidates = [
        game_dir.join("steam_appid.txt"),
        game_dir.join("steam_settings").join("steam_appid.txt"),
        game_dir.join("steam_emu.ini"),
        game_dir.join("tenoke.ini"),
        game_dir.join("ALI213.ini"),
    ];

    for candidate in &candidates {
        if let Ok(content) = std::fs::read_to_string(candidate) {
            let trimmed = content.trim();
            if candidate.extension().and_then(|e| e.to_str()) == Some("txt") {
                if trimmed.chars().all(|c| c.is_ascii_digit()) && !trimmed.is_empty() {
                    return Some(trimmed.to_string());
                }
            } else {
                for line in trimmed.lines() {
                    let line_trimmed = line.trim();
                    if let Some(rest) = line_trimmed.strip_prefix("AppId")
                        .or_else(|| line_trimmed.strip_prefix("appid"))
                        .or_else(|| line_trimmed.strip_prefix("AppID"))
                    {
                        let rest = rest.trim();
                        if let Some(val) = rest.strip_prefix('=') {
                            let val = val.trim();
                            if val.chars().all(|c| c.is_ascii_digit()) && !val.is_empty() {
                                return Some(val.to_string());
                            }
                        }
                    }
                }
            }
        }
    }

    None
}

// ─── Emulator Detection & Path Resolution ───────────────────────────────────

fn get_public_documents() -> PathBuf {
    if let Ok(public) = std::env::var("PUBLIC") {
        PathBuf::from(public).join("Documents")
    } else {
        PathBuf::from(r"C:\Users\Public\Documents")
    }
}

fn get_appdata_roaming() -> PathBuf {
    dirs::config_dir()
        .or_else(dirs::data_dir)
        .unwrap_or_else(|| PathBuf::from(r"C:\Users\Default\AppData\Roaming"))
}

fn get_appdata_local() -> PathBuf {
    dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from(r"C:\Users\Default\AppData\Local"))
}

pub fn detect_emulator(game_dir: Option<&Path>, app_id: &str) -> Option<DetectedEmulator> {
    if app_id.is_empty() {
        return None;
    }

    // 1. Check existing save files across known locations (scan first)
    if let Some(scanned) = scan_existing_emulator_save(app_id, game_dir) {
        return Some(scanned);
    }

    // 2. Fallback: check game folder markers to anticipate new saves
    if let Some(dir) = game_dir {
        // RUNE check
        if dir.join("RUNE.ini").exists() || dir.join("rune.ini").exists() {
            let public_docs = get_public_documents();
            let watch_dir = public_docs.join("Steam").join("RUNE").join(app_id);
            let save_path = watch_dir.join("achievements.ini");
            return Some(DetectedEmulator {
                emulator_type: EmulatorType::Rune,
                save_path,
                watch_dir,
                app_id: app_id.to_string(),
                game_dir: Some(dir.to_path_buf()),
            });
        }

        // Goldberg SocialClub check
        if dir.join("socialclub_emu.ini").exists()
            || dir.join("socialclub.dll").exists()
            || dir.join("GTA5.exe").exists()
            || dir.join("RDR2.exe").exists()
        {
            let watch_dir = get_appdata_roaming().join("Goldberg Socialclub Emu Saves").join(app_id);
            let save_path = watch_dir.join("achievements.json");
            return Some(DetectedEmulator {
                emulator_type: EmulatorType::GoldbergSocialClub,
                save_path,
                watch_dir,
                app_id: app_id.to_string(),
                game_dir: Some(dir.to_path_buf()),
            });
        }

        // TENOKE check
        if dir.join("tenoke.ini").exists() {
            let watch_dir = get_appdata_local().join("TENOKE").join(app_id);
            let save_path = watch_dir.join("achievements.json");
            return Some(DetectedEmulator {
                emulator_type: EmulatorType::Tenoke,
                save_path,
                watch_dir,
                app_id: app_id.to_string(),
                game_dir: Some(dir.to_path_buf()),
            });
        }

        // Goldberg V1 check
        if dir.join("steam_settings").exists() {
            let roaming = get_appdata_roaming();
            let gse = roaming.join("GSE Saves").join(app_id);
            let classic = roaming.join("Goldberg SteamEmu Saves").join(app_id);
            let watch_dir = if gse.exists() { gse } else { classic };
            let save_path = watch_dir.join("achievements.json");
            return Some(DetectedEmulator {
                emulator_type: EmulatorType::GoldbergV1,
                save_path,
                watch_dir,
                app_id: app_id.to_string(),
                game_dir: Some(dir.to_path_buf()),
            });
        }

        // Generic INI check
        if dir.join("steam_emu.ini").exists() || dir.join("ALI213.ini").exists() {
            let public_docs = get_public_documents();
            let codex_path = public_docs.join("Steam").join("CODEX").join(app_id).join("remote").join("achievements.ini");
            let rune_path = public_docs.join("Steam").join("RUNE").join(app_id).join("remote").join("achievements.ini");
            let save_path = if rune_path.exists() {
                rune_path
            } else {
                codex_path
            };
            let watch_dir = save_path.parent().unwrap_or(dir).to_path_buf();
            return Some(DetectedEmulator {
                emulator_type: EmulatorType::GenericIni,
                save_path,
                watch_dir,
                app_id: app_id.to_string(),
                game_dir: Some(dir.to_path_buf()),
            });
        }
    }

    None
}

/// Scans existing save paths on the filesystem for a given appId.
pub fn scan_existing_emulator_save(app_id: &str, game_dir: Option<&Path>) -> Option<DetectedEmulator> {
    let public_docs = get_public_documents();
    let roaming = get_appdata_roaming();
    let local = get_appdata_local();

    let candidates: Vec<(EmulatorType, PathBuf)> = vec![
        // RUNE classic
        (
            EmulatorType::Rune,
            public_docs.join("Steam").join("RUNE").join(app_id).join("achievements.ini"),
        ),
        // RUNE remote
        (
            EmulatorType::Rune,
            public_docs.join("Steam").join("RUNE").join(app_id).join("remote").join("achievements.ini"),
        ),
        // Goldberg GSE
        (
            EmulatorType::GoldbergV1,
            roaming.join("GSE Saves").join(app_id).join("achievements.json"),
        ),
        // Goldberg Classic
        (
            EmulatorType::GoldbergV1,
            roaming.join("Goldberg SteamEmu Saves").join(app_id).join("achievements.json"),
        ),
        // Goldberg Public
        (
            EmulatorType::GoldbergV1,
            public_docs.join("Goldberg SteamEmu Saves").join(app_id).join("achievements.json"),
        ),
        // Goldberg SocialClub
        (
            EmulatorType::GoldbergSocialClub,
            roaming.join("Goldberg Socialclub Emu Saves").join(app_id).join("achievements.json"),
        ),
        // TENOKE
        (
            EmulatorType::Tenoke,
            local.join("TENOKE").join(app_id).join("achievements.json"),
        ),
        // CODEX
        (
            EmulatorType::GenericIni,
            public_docs.join("Steam").join("CODEX").join(app_id).join("remote").join("achievements.ini"),
        ),
        // SKIDROW AppData
        (
            EmulatorType::GoldbergV1,
            local.join("SKIDROW").join(app_id).join("achievements.json"),
        ),
    ];

    for (emu_type, save_path) in candidates {
        if save_path.exists() {
            let watch_dir = save_path.parent().unwrap_or(&save_path).to_path_buf();
            return Some(DetectedEmulator {
                emulator_type: emu_type,
                save_path,
                watch_dir,
                app_id: app_id.to_string(),
                game_dir: game_dir.map(PathBuf::from),
            });
        }
    }

    // Check game_dir local configs if present
    if let Some(dir) = game_dir {
        let local_ini = dir.join("steam_emu.ini");
        if local_ini.exists() {
            return Some(DetectedEmulator {
                emulator_type: EmulatorType::GenericIni,
                save_path: local_ini.clone(),
                watch_dir: dir.to_path_buf(),
                app_id: app_id.to_string(),
                game_dir: Some(dir.to_path_buf()),
            });
        }
    }

    None
}

// ─── Parsers ─────────────────────────────────────────────────────────────────

fn parse_bool_like(s: &str) -> Option<bool> {
    match s.trim().to_lowercase().as_str() {
        "1" | "true" | "yes" | "y" | "on" => Some(true),
        "0" | "false" | "no" | "n" | "off" => Some(false),
        _ => None,
    }
}

/// Parses JSON achievements (Goldberg, GSE, Tenoke).
pub fn parse_json_achievements(content: &str) -> HashMap<String, AchievementState> {
    let mut result = HashMap::new();
    let cleaned = content.trim_start_matches('\u{feff}');
    let Ok(val) = serde_json::from_str::<serde_json::Value>(cleaned) else {
        return result;
    };

    let target_obj = if let Some(ach) = val.get("achievements").and_then(|v| v.as_object()) {
        ach
    } else if let Some(obj) = val.as_object() {
        obj
    } else {
        return result;
    };

    for (key, entry) in target_obj {
        if key.is_empty() {
            continue;
        }

        if let Some(b) = entry.as_bool() {
            result.insert(key.clone(), AchievementState { earned: b, earned_time: 0 });
            continue;
        }
        if let Some(n) = entry.as_i64() {
            result.insert(key.clone(), AchievementState { earned: n > 0, earned_time: 0 });
            continue;
        }

        if let Some(obj) = entry.as_object() {
            let earned = obj.get("earned")
                .or_else(|| obj.get("achieved"))
                .or_else(|| obj.get("unlocked"))
                .and_then(|v| {
                    v.as_bool().or_else(|| v.as_str().and_then(parse_bool_like))
                })
                .unwrap_or(false);

            let earned_time = obj.get("earned_time")
                .or_else(|| obj.get("earnedTime"))
                .or_else(|| obj.get("unlock_time"))
                .or_else(|| obj.get("unlockTime"))
                .and_then(|v| v.as_i64())
                .unwrap_or(0);

            result.insert(key.clone(), AchievementState { earned, earned_time });
        }
    }

    result
}

/// Parses INI achievements (RUNE, CODEX, Generic INI).
pub fn parse_ini_achievements(content: &str) -> HashMap<String, AchievementState> {
    let mut result: HashMap<String, AchievementState> = HashMap::new();
    let mut time_map: HashMap<String, i64> = HashMap::new();
    let mut current_section = String::new();
    let mut section_entries: HashMap<String, HashMap<String, String>> = HashMap::new();

    let cleaned = content.trim_start_matches('\u{feff}');

    for line in cleaned.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with(';') || trimmed.starts_with('#') {
            continue;
        }

        if trimmed.starts_with('[') && trimmed.ends_with(']') {
            current_section = trimmed[1..trimmed.len() - 1].trim().to_string();
            continue;
        }

        if let Some((k, v)) = trimmed.split_once('=') {
            let key = k.trim().to_string();
            let val = v.trim().to_string();
            section_entries
                .entry(current_section.clone())
                .or_default()
                .insert(key, val);
        }
    }

    // Step 1: Named sections where section name = achievement ID (e.g. [ACH_KILL_100])
    for (sec_name, map) in &section_entries {
        let sec_lower = sec_name.to_lowercase();
        if sec_lower.is_empty()
            || sec_lower == "achievements"
            || sec_lower == "steamachievements"
            || sec_lower == "userstats"
        {
            continue;
        }

        let earned = map.iter()
            .find(|(k, _)| {
                let kl = k.to_lowercase();
                kl == "achieved" || kl == "earned" || kl == "unlocked" || kl == "isachieved"
            })
            .and_then(|(_, v)| parse_bool_like(v))
            .unwrap_or(false);

        let unlock_time = map.iter()
            .find(|(k, _)| {
                let kl = k.to_lowercase();
                kl == "unlocktime" || kl == "unlocktimestamp" || kl == "unlockedat" || kl == "earned_time"
            })
            .and_then(|(_, v)| v.parse::<i64>().ok())
            .unwrap_or(0);

        result.insert(sec_name.clone(), AchievementState { earned, earned_time: unlock_time });
    }

    // Step 2: Flat [Achievements] or [SteamAchievements] section
    for (sec_name, map) in &section_entries {
        let sec_lower = sec_name.to_lowercase();
        if sec_lower != "achievements" && sec_lower != "steamachievements" {
            continue;
        }

        // Collect timestamps first (KEY_TIME = unix)
        for (k, v) in map {
            if let Some(base_key) = k.strip_suffix("_TIME").or_else(|| k.strip_suffix("_time")) {
                if let Ok(ts) = v.parse::<i64>() {
                    time_map.insert(base_key.to_lowercase(), ts);
                }
            }
        }

        for (k, v) in map {
            if k.to_lowercase() == "count" || k.ends_with("_TIME") || k.ends_with("_time") {
                continue;
            }

            if let Some(b) = parse_bool_like(v) {
                let ts = time_map.get(&k.to_lowercase()).copied().unwrap_or(0);
                result.insert(k.clone(), AchievementState { earned: b, earned_time: ts });
                continue;
            }

            // Indexed format: Achievement0=ACH_ID
            if k.to_lowercase().starts_with("achievement") && k[11..].chars().all(|c| c.is_ascii_digit()) {
                let ach_id = v.trim();
                if !ach_id.is_empty() && !result.contains_key(ach_id) {
                    result.insert(ach_id.to_string(), AchievementState { earned: true, earned_time: 0 });
                }
            }
        }
    }

    result
}

/// Reads achievement states from a detected emulator.
pub fn read_achievements_from_emulator(detected: &DetectedEmulator) -> HashMap<String, AchievementState> {
    if !detected.save_path.exists() {
        return HashMap::new();
    }

    let Ok(content) = std::fs::read_to_string(&detected.save_path) else {
        return HashMap::new();
    };

    match detected.emulator_type {
        EmulatorType::GoldbergV1 | EmulatorType::GoldbergSocialClub | EmulatorType::Tenoke => {
            parse_json_achievements(&content)
        }
        EmulatorType::Rune | EmulatorType::GenericIni => {
            parse_ini_achievements(&content)
        }
    }
}

/// Retroactively reads achievements for an appId across all emulator save locations.
pub fn read_retroactive_saves(app_id: &str, game_dir: Option<&Path>) -> HashMap<String, AchievementState> {
    if let Some(detected) = scan_existing_emulator_save(app_id, game_dir) {
        return read_achievements_from_emulator(&detected);
    }
    HashMap::new()
}

// ─── Goldberg Settings Definitions ──────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GoldbergAchievementDefinition {
    pub id: String,
    pub name: String,
    pub description: String,
    pub icon: String,
}

pub fn read_goldberg_settings_achievements(game_dir: &Path) -> Option<Vec<GoldbergAchievementDefinition>> {
    let candidates = [
        game_dir.join("steam_settings").join("achievements.json"),
        game_dir.parent().map(|p| p.join("steam_settings").join("achievements.json")).unwrap_or_default(),
    ];

    for file_path in &candidates {
        if !file_path.exists() {
            continue;
        }
        let Ok(content) = std::fs::read_to_string(file_path) else {
            continue;
        };
        let Ok(val) = serde_json::from_str::<serde_json::Value>(&content) else {
            continue;
        };

        let list = val.as_array()
            .or_else(|| val.get("achievements").and_then(|v| v.as_array()));

        if let Some(items) = list {
            let mut result = Vec::new();
            for item in items {
                let id = item.get("name")
                    .or_else(|| item.get("id"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .trim();

                if id.is_empty() {
                    continue;
                }

                let name = item.get("display_name")
                    .and_then(|v| {
                        if let Some(s) = v.as_str() {
                            Some(s.to_string())
                        } else if let Some(obj) = v.as_object() {
                            obj.get("english").or_else(|| obj.get("default")).and_then(|s| s.as_str()).map(String::from)
                        } else {
                            None
                        }
                    })
                    .unwrap_or_else(|| id.to_string());

                let description = item.get("description")
                    .and_then(|v| {
                        if let Some(s) = v.as_str() {
                            Some(s.to_string())
                        } else if let Some(obj) = v.as_object() {
                            obj.get("english").or_else(|| obj.get("default")).and_then(|s| s.as_str()).map(String::from)
                        } else {
                            None
                        }
                    })
                    .unwrap_or_default();

                let icon = item.get("icon")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();

                result.push(GoldbergAchievementDefinition {
                    id: id.to_string(),
                    name,
                    description,
                    icon,
                });
            }

            if !result.is_empty() {
                return Some(result);
            }
        }
    }

    None
}

#[tauri::command]
pub fn emulator_detect_for_game(
    game_dir: Option<String>,
    app_id: String,
) -> Result<Option<DetectedEmulator>, String> {
    let dir_buf = game_dir.map(PathBuf::from);
    Ok(detect_emulator(dir_buf.as_deref(), &app_id))
}
