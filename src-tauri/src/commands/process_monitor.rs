//! Tauri commands: process monitoring
//! Substitui electron/games/game-process-monitor.cjs (~12 KB)

use crate::commands::process_identity::{
    find_process_by_exact_path, find_process_in_directory, normalize_path, process_start_time_ms,
};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use sysinfo::{ProcessRefreshKind, ProcessesToUpdate, RefreshKind, System};
use tauri::command;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunningProcessMatch {
    pub requested_path: String,
    pub matched_path: String,
    pub pid: u32,
    pub process_start_time_ms: Option<u64>,
}

fn collect_running_matches(
    system: &System,
    executable_paths: &[String],
) -> Vec<RunningProcessMatch> {
    let mut matches = Vec::new();

    for target in executable_paths {
        let normalized_target = normalize_path(target);
        if normalized_target.is_empty() {
            continue;
        }

        if let Some((pid, matched_path)) = find_process_by_exact_path(system, target) {
            let process = system.process(pid);
            matches.push(RunningProcessMatch {
                requested_path: target.clone(),
                matched_path: matched_path.to_string_lossy().to_string(),
                pid: pid.as_u32(),
                process_start_time_ms: process.and_then(process_start_time_ms),
            });
            continue;
        }

        let target_path = PathBuf::from(target.trim_matches('"').trim_matches('\''));
        let target_dir = if target_path.is_dir() {
            Some(target_path.clone())
        } else {
            target_path.parent().map(|parent| parent.to_path_buf())
        };

        if let Some(dir) = target_dir {
            if let Some((pid, matched_path)) = find_process_in_directory(system, &dir) {
                let process = system.process(pid);
                matches.push(RunningProcessMatch {
                    requested_path: target.clone(),
                    matched_path: matched_path.to_string_lossy().to_string(),
                    pid: pid.as_u32(),
                    process_start_time_ms: process.and_then(process_start_time_ms),
                });
            }
        }
    }

    matches.sort_by(|a, b| a.requested_path.cmp(&b.requested_path));
    matches.dedup_by(|a, b| a.requested_path == b.requested_path);
    matches
}

fn refresh_processes(system: &mut System, refresh_kind: ProcessRefreshKind) {
    system.refresh_processes_specifics(ProcessesToUpdate::All, true, refresh_kind);
}

/// Returns the subset of `executable_paths` that are currently running as processes.
#[command]
pub async fn process_detect_running(executable_paths: Vec<String>) -> Result<Vec<String>, String> {
    let refresh_kind = ProcessRefreshKind::new().with_exe(sysinfo::UpdateKind::Always);
    let mut sys = System::new_with_specifics(RefreshKind::new().with_processes(refresh_kind));
    refresh_processes(&mut sys, refresh_kind);

    let matches = collect_running_matches(&sys, &executable_paths);
    Ok(matches.into_iter().map(|item| item.requested_path).collect())
}

#[command]
pub async fn process_detect_running_details(
    executable_paths: Vec<String>,
) -> Result<Vec<RunningProcessMatch>, String> {
    let refresh_kind = ProcessRefreshKind::new().with_exe(sysinfo::UpdateKind::Always);
    let mut sys = System::new_with_specifics(RefreshKind::new().with_processes(refresh_kind));
    refresh_processes(&mut sys, refresh_kind);
    Ok(collect_running_matches(&sys, &executable_paths))
}

/// Returns whether a single executable is currently running.
#[command]
pub async fn process_is_running(executable_path: String) -> Result<bool, String> {
    let refresh_kind = ProcessRefreshKind::new().with_exe(sysinfo::UpdateKind::Always);
    let mut sys = System::new_with_specifics(RefreshKind::new().with_processes(refresh_kind));
    refresh_processes(&mut sys, refresh_kind);
    Ok(find_process_by_exact_path(&sys, &executable_path).is_some())
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
    score_game_exe(exe_name, game_name) > 0
}

fn score_game_exe(exe_name: &str, game_name: &str) -> i32 {
    let exe_lower = exe_name.to_lowercase();
    let skip = [
        "unins", "uninstall", "setup", "install", "redist", "vcredist",
        "directx", "crashreport", "crash_report", "dxsetup", "ue4prereq",
        "dotnetfx", "dotnet", "cleanup", "_commonredist", "vc_redist",
        "unitycrashhandler", "crashpad", "notification_helper", "cefsharp",
        "blender", "physx", "easyanticheat", "eac_launcher", "beclient",
        "battleye", "pbsvc", "redistributable",
    ];
    for s in &skip {
        if exe_lower.contains(s) {
            return -100;
        }
    }

    let exe_stem = exe_lower.trim_end_matches(".exe");
    if exe_stem.len() <= 2 {
        return -50;
    }

    let game_compact = game_name
        .to_lowercase()
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .collect::<String>();
    let exe_compact = exe_stem
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .collect::<String>();

    let mut score = 10;

    if exe_compact == game_compact {
        score += 100;
    } else if !game_compact.is_empty()
        && (exe_compact.contains(&game_compact) || game_compact.contains(&exe_compact))
    {
        score += 60;
    } else if game_compact.len() >= 4 {
        let prefix = &game_compact[..game_compact.len().min(5)];
        if exe_compact.contains(prefix) {
            score += 35;
        }
    }

    if exe_stem.contains("shipping") || exe_stem.contains("win64") || exe_stem.contains("win32") {
        score += 40;
    }
    if exe_stem.contains("launcher") || exe_stem.contains("bootstrap") || exe_stem == "unity" {
        score -= 40;
    }
    if exe_stem == "unityplayer" || exe_stem == "gamelauncher" {
        score -= 20;
    }

    score
}

fn find_best_game_exe(game_dir: &Path, game_name: &str) -> Option<PathBuf> {
    let mut candidates: Vec<(i32, PathBuf)> = Vec::new();
    collect_exe_candidates(game_dir, game_name, 0, 3, &mut candidates);
    candidates.sort_by(|a, b| b.0.cmp(&a.0).then_with(|| a.1.cmp(&b.1)));
    candidates.into_iter().map(|(_, path)| path).next()
}

fn collect_exe_candidates(
    dir: &Path,
    game_name: &str,
    depth: u32,
    max_depth: u32,
    out: &mut Vec<(i32, PathBuf)>,
) {
    let entries = match std::fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() && path.extension().map_or(false, |ext| ext == "exe") {
            let exe_name = path
                .file_name()
                .map(|name| name.to_string_lossy().to_lowercase())
                .unwrap_or_default();
            let score = score_game_exe(&exe_name, game_name);
            if score > 0 {
                out.push((score - (depth as i32 * 2), path));
            }
            continue;
        }

        if depth >= max_depth || !path.is_dir() {
            continue;
        }

        let dir_name = path
            .file_name()
            .map(|name| name.to_string_lossy().to_lowercase())
            .unwrap_or_default();
        if matches!(
            dir_name.as_str(),
            "_commonredist"
                | "directx"
                | "redist"
                | "redistributables"
                | "support"
                | "__macosx"
                | ".git"
        ) {
            continue;
        }

        collect_exe_candidates(&path, game_name, depth + 1, max_depth, out);
    }
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

            // Locate executable inside steamapps/common/{installdir} (incl. subpastas)
            let mut executable_path: Option<String> = None;
            if !installdir.is_empty() {
                let common_game_dir = steamapps.join("common").join(&installdir);
                if common_game_dir.exists() {
                    executable_path = find_best_game_exe(&common_game_dir, &name)
                        .map(|path| path.to_string_lossy().to_string());
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
