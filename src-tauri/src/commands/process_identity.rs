//! Shared executable path normalization and strict process identity matching.

use std::path::{Path, PathBuf};
use sysinfo::{Pid, Process, System};

/// Normalize a Windows path for case-insensitive comparison.
pub fn normalize_path(value: &str) -> String {
    value
        .trim_matches('"')
        .trim_matches('\'')
        .trim()
        .to_lowercase()
        .replace('\\', "/")
        .trim_matches('/')
        .to_string()
}

pub fn executable_basename(value: &str) -> String {
    let normalized = normalize_path(value);
    normalized
        .rsplit('/')
        .next()
        .unwrap_or(normalized.as_str())
        .to_string()
}

/// Strict full-path equality — never match by executable name alone.
pub fn paths_match_exact(process_exe: Option<&Path>, target_path: &str) -> bool {
    let Some(exe) = process_exe else {
        return false;
    };
    normalize_path(&exe.to_string_lossy()) == normalize_path(target_path)
}

/// True when the process executable lives inside `target_dir` (launcher → game handoff).
pub fn process_exe_within_dir(process_exe: Option<&Path>, target_dir: &Path) -> bool {
    let Some(exe) = process_exe else {
        return false;
    };
    let normalized_exe = normalize_path(&exe.to_string_lossy());
    let normalized_dir = normalize_path(&target_dir.to_string_lossy());
    if normalized_dir.is_empty() {
        return false;
    }
    normalized_exe.starts_with(&format!("{normalized_dir}/"))
        || normalized_exe == normalized_dir
}

pub fn process_start_time_ms(process: &Process) -> Option<u64> {
    let seconds = process.start_time();
    if seconds == 0 {
        return None;
    }
    seconds.checked_mul(1000)
}

pub fn find_process_by_exact_path(system: &System, target_path: &str) -> Option<(Pid, PathBuf)> {
    let normalized_target = normalize_path(target_path);
    if normalized_target.is_empty() {
        return None;
    }

    system.processes().iter().find_map(|(&pid, process)| {
        process.exe().and_then(|exe| {
            if normalize_path(&exe.to_string_lossy()) == normalized_target {
                Some((pid, exe.to_path_buf()))
            } else {
                None
            }
        })
    })
}

/// Prefer the newest non-launcher executable inside the game directory.
pub fn find_process_in_directory(system: &System, target_dir: &Path) -> Option<(Pid, PathBuf)> {
    let normalized_dir = normalize_path(&target_dir.to_string_lossy());
    if normalized_dir.is_empty() {
        return None;
    }

    let mut candidates: Vec<(u64, Pid, PathBuf)> = Vec::new();

    for (&pid, process) in system.processes() {
        let Some(exe) = process.exe() else {
            continue;
        };
        if !process_exe_within_dir(Some(exe), target_dir) {
            continue;
        }

        let basename = executable_basename(&exe.to_string_lossy());
        let stem = basename.trim_end_matches(".exe");
        if stem.contains("unins")
            || stem.contains("setup")
            || stem.contains("redist")
            || stem.contains("eac_launcher")
            || stem.contains("easyanticheat")
        {
            continue;
        }

        let start_ms = process_start_time_ms(process).unwrap_or(0);
        candidates.push((start_ms, pid, exe.to_path_buf()));
    }

    candidates.sort_by(|a, b| b.0.cmp(&a.0).then_with(|| a.2.cmp(&b.2)));
    candidates.into_iter().next().map(|(_, pid, path)| (pid, path))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_path_strips_quotes_and_unifies_slashes() {
        assert_eq!(
            normalize_path(r#""C:\Games\Foo\bar.exe""#),
            "c:/games/foo/bar.exe"
        );
        assert_eq!(
            normalize_path("C:/Games/Foo/bar.exe"),
            "c:/games/foo/bar.exe"
        );
    }

    #[test]
    fn same_name_in_different_folders_do_not_match() {
        let left = normalize_path(r"C:\Games\Alpha\game.exe");
        let right = normalize_path(r"D:\Library\Beta\game.exe");
        assert_ne!(left, right);
        assert!(!paths_match_exact(
            Some(Path::new(r"C:\Games\Alpha\game.exe")),
            r"D:\Library\Beta\game.exe",
        ));
        assert!(paths_match_exact(
            Some(Path::new(r"C:\Games\Alpha\game.exe")),
            r"C:\Games\Alpha\game.exe",
        ));
    }

    #[test]
    fn directory_match_supports_launcher_to_game_handoff() {
        let game_dir = Path::new(r"C:\Games\Sample");
        assert!(process_exe_within_dir(
            Some(Path::new(r"C:\Games\Sample\Binaries\Win64\Game.exe")),
            game_dir,
        ));
        assert!(!process_exe_within_dir(
            Some(Path::new(r"C:\Games\Other\Game.exe")),
            game_dir,
        ));
    }
}
