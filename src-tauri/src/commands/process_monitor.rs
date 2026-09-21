//! Tauri commands: process monitoring
//! Substitui electron/games/game-process-monitor.cjs (~12 KB)

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use sysinfo::{ProcessRefreshKind, ProcessesToUpdate, RefreshKind, System};
use tauri::command;

/// Normalize a Windows path for case-insensitive comparison
fn normalize_path(p: &str) -> String {
    p.to_lowercase().replace('\\', "/").trim_matches('/').to_string()
}

/// Returns the subset of `executable_paths` that are currently running as processes.
#[command]
pub async fn process_detect_running(executable_paths: Vec<String>) -> Result<Vec<String>, String> {
    let refresh_kind = ProcessRefreshKind::new().with_exe(sysinfo::UpdateKind::Always);
    let mut sys = System::new_with_specifics(
        RefreshKind::new().with_processes(refresh_kind),
    );
    sys.refresh_processes_specifics(ProcessesToUpdate::All, true, refresh_kind);

    let normalized_targets: Vec<String> =
        executable_paths.iter().map(|p| normalize_path(p)).collect();

    let mut running = Vec::new();
    for process in sys.processes().values() {
        let exe_norm = process.exe().map(|exe| normalize_path(&exe.to_string_lossy()));
        let name_norm = normalize_path(&process.name().to_string_lossy());

        for (i, target) in normalized_targets.iter().enumerate() {
            let target_base = target.rsplit('/').next().unwrap_or(target);
            let matched = if let Some(ref exe) = exe_norm {
                exe.ends_with(target.as_str())
                    || exe == target
                    || exe.ends_with(&format!("/{target_base}"))
            } else {
                false
            } || name_norm == target_base
                || name_norm == *target;

            if matched {
                running.push(executable_paths[i].clone());
                break;
            }
        }
    }

    // Deduplicate
    running.sort();
    running.dedup();
    Ok(running)
}

/// Returns whether a single executable is currently running.
#[command]
pub async fn process_is_running(executable_path: String) -> Result<bool, String> {
    let paths = vec![executable_path];
    let running = process_detect_running(paths.clone()).await?;
    Ok(!running.is_empty())
}

/// Scans common Windows game directories for installed games.
///
/// Substitui game:scan-local do electron/main.cjs.
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScannedGame {
    pub name: String,
    pub path: String,
}

#[command]
pub async fn game_scan_local() -> Result<Vec<ScannedGame>, String> {
    let mut results = Vec::new();

    let scan_dirs = get_scan_dirs();

    for dir in &scan_dirs {
        let dir_path = Path::new(dir);
        if !dir_path.exists() {
            continue;
        }

        if let Ok(entries) = std::fs::read_dir(dir_path) {
            for entry in entries.flatten() {
                let entry_path = entry.path();
                if !entry_path.is_dir() {
                    continue;
                }

                // Look for an executable in the top-level game folder
                if let Ok(sub_entries) = std::fs::read_dir(&entry_path) {
                    for sub in sub_entries.flatten() {
                        let sub_path = sub.path();
                        if sub_path.extension().map_or(false, |e| e == "exe") {
                            let name = entry_path
                                .file_name()
                                .map(|n| n.to_string_lossy().to_string())
                                .unwrap_or_default();
                            let path = sub_path.to_string_lossy().to_string();
                            // Skip common utility executables
                            let exe_name = sub_path
                                .file_name()
                                .map(|n| n.to_string_lossy().to_lowercase())
                                .unwrap_or_default();
                            if is_likely_game_exe(&exe_name, &name) {
                                results.push(ScannedGame { name, path });
                                break;
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(results)
}

fn get_scan_dirs() -> Vec<String> {
    let mut dirs = Vec::new();

    // Common Windows game directories
    let common_dirs = [
        r"C:\Program Files\Steam\steamapps\common",
        r"C:\Program Files (x86)\Steam\steamapps\common",
        r"C:\Program Files\Epic Games",
        r"C:\Program Files (x86)\Epic Games",
        r"C:\Games",
        r"D:\Games",
        r"D:\SteamLibrary\steamapps\common",
        r"E:\Games",
        r"E:\SteamLibrary\steamapps\common",
    ];

    for d in &common_dirs {
        if Path::new(d).exists() {
            dirs.push(d.to_string());
        }
    }

    // Try to read Steam library folders from config
    let steam_config_paths = [
        r"C:\Program Files\Steam\steamapps\libraryfolders.vdf",
        r"C:\Program Files (x86)\Steam\steamapps\libraryfolders.vdf",
    ];

    for cfg in &steam_config_paths {
        if let Ok(content) = std::fs::read_to_string(cfg) {
            for line in content.lines() {
                let line = line.trim();
                if line.contains("\"path\"") {
                    if let Some(start) = line.rfind('"') {
                        if let Some(end) = line[..start].rfind('"') {
                            let path = line[end + 1..start].replace("\\\\", "\\");
                            let common = format!("{path}\\steamapps\\common");
                            if Path::new(&common).exists() && !dirs.contains(&common) {
                                dirs.push(common);
                            }
                        }
                    }
                }
            }
        }
    }

    dirs
}

fn is_likely_game_exe(exe_name: &str, game_name: &str) -> bool {
    // Skip known utility executables
    let skip = [
        "unins", "uninstall", "setup", "install", "redist", "vcredist",
        "directx", "crashreport", "crash_report", "dxsetup", "ue4", "ue5",
        "dotnetfx", "dotnet", "cleanup", "launcher", "_commonredist",
    ];
    for s in &skip {
        if exe_name.contains(s) {
            return false;
        }
    }

    // Prefer exe names that resemble the game name
    let game_lower = game_name.to_lowercase().replace(' ', "");
    let exe_stem = exe_name.trim_end_matches(".exe");
    exe_stem.contains(&game_lower[..game_lower.len().min(5)])
        || game_lower.contains(exe_stem)
        || exe_stem.len() > 3 // any exe with a meaningful name
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalSteamGame {
    pub appid: String,
    pub name: String,
    pub installdir: String,
    pub executable_path: Option<String>,
    pub size_gb: f64,
    pub last_played: i64,
}

fn extract_vdf_str<'a>(content: &'a str, key: &str) -> Option<&'a str> {
    let key_pattern = format!("\"{key}\"");
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with(&key_pattern) {
            let rest = trimmed[key_pattern.len()..].trim();
            if rest.starts_with('"') && rest.len() >= 2 {
                let rest_no_quote = &rest[1..];
                if let Some(end) = rest_no_quote.find('"') {
                    return Some(&rest_no_quote[..end]);
                }
            }
        }
    }
    None
}

fn get_all_steam_libraries() -> Vec<PathBuf> {
    let mut libraries: Vec<PathBuf> = Vec::new();
    let mut candidate_roots: Vec<PathBuf> = vec![
        PathBuf::from(r"C:\Program Files (x86)\Steam"),
        PathBuf::from(r"C:\Program Files\Steam"),
    ];

    for drive in b'C'..=b'Z' {
        let drive_char = drive as char;
        candidate_roots.push(PathBuf::from(format!(r"{drive_char}:\Steam")));
        candidate_roots.push(PathBuf::from(format!(r"{drive_char}:\SteamLibrary")));
    }

    for root in &candidate_roots {
        if root.exists() && !libraries.contains(root) {
            libraries.push(root.clone());
        }
        let vdf_path = root.join("steamapps").join("libraryfolders.vdf");
        if let Ok(content) = std::fs::read_to_string(&vdf_path) {
            for line in content.lines() {
                let trimmed = line.trim();
                if trimmed.starts_with("\"path\"") {
                    let rest = trimmed["\"path\"".len()..].trim();
                    if rest.starts_with('"') && rest.len() >= 2 {
                        let rest_no_quote = &rest[1..];
                        if let Some(end) = rest_no_quote.find('"') {
                            let raw_path = &rest_no_quote[..end];
                            let cleaned = raw_path.replace(r"\\", r"\");
                            let p = PathBuf::from(cleaned);
                            if p.exists() && !libraries.contains(&p) {
                                libraries.push(p);
                            }
                        }
                    }
                }
            }
        }
    }

    libraries
}

#[command]
pub async fn steam_scan_installed_games() -> Result<Vec<LocalSteamGame>, String> {
    let mut games: Vec<LocalSteamGame> = Vec::new();
    let mut seen_appids = std::collections::HashSet::new();

    let libraries = get_all_steam_libraries();

    for lib in libraries {
        let steamapps = lib.join("steamapps");
        if !steamapps.exists() {
            continue;
        }

        let entries = match std::fs::read_dir(&steamapps) {
            Ok(e) => e,
            Err(_) => continue,
        };

        for entry in entries.flatten() {
            let file_name = entry.file_name().to_string_lossy().to_string();
            if !file_name.starts_with("appmanifest_") || !file_name.ends_with(".acf") {
                continue;
            }

            let content = match std::fs::read_to_string(entry.path()) {
                Ok(c) => c,
                Err(_) => continue,
            };

            let appid = match extract_vdf_str(&content, "appid") {
                Some(id) if !id.trim().is_empty() => id.trim().to_string(),
                _ => continue,
            };

            // Skip known utility / redistributable apps
            if appid == "228980" || appid == "250820" || appid == "1007" {
                continue;
            }

            if seen_appids.contains(&appid) {
                continue;
            }

            let name = match extract_vdf_str(&content, "name") {
                Some(n) if !n.trim().is_empty() => n.trim().to_string(),
                _ => continue,
            };

            if name.starts_with("Proton ") || name.starts_with("Steam Linux Runtime") {
                continue;
            }

            let installdir = extract_vdf_str(&content, "installdir")
                .unwrap_or_default()
                .trim()
                .to_string();

            let size_bytes: u64 = extract_vdf_str(&content, "SizeOnDisk")
                .and_then(|s| s.parse::<u64>().ok())
                .unwrap_or(0);
            let size_gb = (size_bytes as f64) / 1_073_741_824.0;

            let last_played: i64 = extract_vdf_str(&content, "LastPlayed")
                .and_then(|s| s.parse::<i64>().ok())
                .unwrap_or(0);

            // Locate executable inside steamapps/common/{installdir}
            let mut executable_path: Option<String> = None;
            if !installdir.is_empty() {
                let common_game_dir = steamapps.join("common").join(&installdir);
                if common_game_dir.exists() {
                    if let Ok(game_entries) = std::fs::read_dir(&common_game_dir) {
                        for ge in game_entries.flatten() {
                            let p = ge.path();
                            if p.is_file() && p.extension().map_or(false, |e| e == "exe") {
                                let exe_name = p.file_name().map(|n| n.to_string_lossy().to_lowercase()).unwrap_or_default();
                                if is_likely_game_exe(&exe_name, &name) {
                                    executable_path = Some(p.to_string_lossy().to_string());
                                    break;
                                }
                            }
                        }
                    }
                }
            }

            seen_appids.insert(appid.clone());
            games.push(LocalSteamGame {
                appid,
                name,
                installdir,
                executable_path,
                size_gb,
                last_played,
            });
        }
    }

    Ok(games)
}

