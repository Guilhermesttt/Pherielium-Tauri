//! Tauri commands: Epic Games integration
//! Supports local manifest reading, automatic Legendary CLI installation & auth,
//! in-app Epic OAuth webview capture, library syncing, and store details.

use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::Arc;
use std::time::Duration;

#[cfg(windows)]
use std::os::windows::process::CommandExt;
use tauri::{command, AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder};

const LEGENDARY_VERSION: &str = "0.21.0";
const LEGENDARY_DOWNLOAD_URL: &str =
    "https://github.com/legendary-gl/legendary/releases/download/0.21.0/legendary_windows_x64.exe";
const LEGENDARY_SHA256: &str =
    "4c01a14c0acb0c46069b197ae7212ea4ea6b861661126ca0593cdac31658fb01";
const LEGENDARY_SIZE: u64 = 17_610_944;
const EPIC_OAUTH_URL: &str =
    "https://www.epicgames.com/id/login?redirectUrl=https%3A%2F%2Fwww.epicgames.com%2Fid%2Fapi%2Fredirect%3FclientId%3D34a02cf8f4414e29b15921876da36f9a%26responseType%3Dcode";

pub struct EpicLoginState(pub Arc<Mutex<Option<String>>>);

impl Default for EpicLoginState {
    fn default() -> Self {
        Self(Arc::new(Mutex::new(None)))
    }
}

// ── App Data & Tools Paths ────────────────────────────────────────────────────

pub fn pherielium_user_data_dir() -> Result<PathBuf, String> {
    #[cfg(windows)]
    {
        let appdata = std::env::var("APPDATA").map_err(|_| "APPDATA nao definido.".to_string())?;
        let dir = PathBuf::from(appdata).join("Phelierium");
        fs::create_dir_all(&dir).map_err(|e| format!("Falha ao criar pasta de dados: {e}"))?;
        Ok(dir)
    }
    #[cfg(not(windows))]
    {
        let home = std::env::var("HOME").map_err(|_| "HOME nao definido.".to_string())?;
        let dir = PathBuf::from(home).join(".local").join("share").join("Phelierium");
        fs::create_dir_all(&dir).map_err(|e| format!("Falha ao criar pasta de dados: {e}"))?;
        Ok(dir)
    }
}

fn legendary_install_dir() -> Result<PathBuf, String> {
    Ok(pherielium_user_data_dir()?
        .join("tools")
        .join("legendary")
        .join(LEGENDARY_VERSION))
}

fn legendary_exe_path() -> Result<PathBuf, String> {
    Ok(legendary_install_dir()?.join("legendary.exe"))
}

fn sha256_file(path: &Path) -> Result<String, String> {
    let bytes = fs::read(path).map_err(|e| format!("Falha ao ler Legendary: {e}"))?;
    let digest = Sha256::digest(bytes);
    Ok(format!("{:x}", digest))
}

fn verify_legendary_binary(path: &Path) -> Result<(), String> {
    let meta = fs::metadata(path).map_err(|e| format!("Legendary ausente: {e}"))?;
    if meta.len() != LEGENDARY_SIZE {
        return Err("Tamanho do Legendary invalido.".into());
    }
    let digest = sha256_file(path)?;
    if digest != LEGENDARY_SHA256 {
        return Err("Hash do Legendary invalido.".into());
    }
    Ok(())
}

#[cfg(windows)]
fn download_legendary(dest: &Path) -> Result<(), String> {
    fs::create_dir_all(
        dest.parent()
            .ok_or_else(|| "Caminho Legendary invalido.".to_string())?,
    )
    .map_err(|e| format!("Falha ao criar pasta Legendary: {e}"))?;

    let temp = dest.with_extension("exe.download");
    let script = format!(
        "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '{}' -OutFile '{}' -UseBasicParsing",
        LEGENDARY_DOWNLOAD_URL,
        temp.to_string_lossy().replace('\'', "''")
    );

    let output = Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", &script])
        .output()
        .map_err(|e| format!("Falha ao baixar Legendary: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Download do Legendary falhou: {stderr}"));
    }

    verify_legendary_binary(&temp)?;
    if dest.exists() {
        let _ = fs::remove_file(dest);
    }
    fs::rename(&temp, dest).map_err(|e| format!("Falha ao instalar Legendary: {e}"))?;
    Ok(())
}

#[cfg(not(windows))]
fn download_legendary(_dest: &Path) -> Result<(), String> {
    Err("Legendary so esta disponivel no Windows.".into())
}

fn ensure_legendary_installed() -> Result<PathBuf, String> {
    let exe = legendary_exe_path()?;
    if verify_legendary_binary(&exe).is_ok() {
        return Ok(exe);
    }
    download_legendary(&exe)?;
    verify_legendary_binary(&exe)?;
    Ok(exe)
}

fn run_legendary(args: &[&str]) -> Result<String, String> {
    let exe = ensure_legendary_installed()?;

    let mut cmd = Command::new(exe);
    cmd.args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    #[cfg(windows)]
    cmd.creation_flags(0x08000000);

    let output = cmd
        .output()
        .map_err(|e| format!("Falha ao executar Legendary: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Comando Legendary falhou: {stderr}"));
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

// ── Domain Types ─────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EpicAccountStatus {
    pub authenticated: bool,
    pub account_id: Option<String>,
    pub display_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct EpicLibraryGame {
    pub app_name: String,
    pub title: String,
    pub catalog_id: String,
    pub namespace: String,
    pub description: String,
    pub key_images: Vec<EpicKeyImage>,
    #[serde(default)]
    pub install_location: Option<String>,
    #[serde(default)]
    pub executable: Option<String>,
    #[serde(default)]
    pub is_installed: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct EpicKeyImage {
    #[serde(rename = "type")]
    pub image_type: String,
    pub url: String,
    #[serde(default)]
    pub width: Option<u32>,
    #[serde(default)]
    pub height: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
struct EpicManifest {
    app_name: Option<String>,
    display_name: Option<String>,
    catalog_item_id: Option<String>,
    catalog_namespace: Option<String>,
    install_location: Option<String>,
    launch_executable: Option<String>,
    #[serde(default)]
    is_incomplete_install: bool,
}

// ── Local Installed Manifest Reading ──────────────────────────────────────────

fn find_epic_manifests_dir() -> Option<PathBuf> {
    let candidates = [
        PathBuf::from(r"C:\ProgramData\Epic\EpicGamesLauncher\Data\Manifests"),
        dirs::data_local_dir()
            .unwrap_or_default()
            .join(r"Epic\EpicGamesLauncher\Data\Manifests"),
    ];
    for c in &candidates {
        if c.exists() {
            return Some(c.clone());
        }
    }
    None
}

pub fn read_installed_epic_games() -> Vec<EpicLibraryGame> {
    let Some(manifests_dir) = find_epic_manifests_dir() else {
        return vec![];
    };

    let mut games = Vec::new();
    let Ok(entries) = fs::read_dir(&manifests_dir) else {
        return vec![];
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().map_or(true, |e| e != "item") {
            continue;
        }
        let Ok(content) = fs::read_to_string(&path) else {
            continue;
        };
        let Ok(manifest) = serde_json::from_str::<EpicManifest>(&content) else {
            continue;
        };
        if manifest.is_incomplete_install {
            continue;
        }
        let Some(app_name) = manifest.app_name else {
            continue;
        };
        let title = manifest.display_name.unwrap_or_else(|| app_name.clone());
        let install_location = manifest.install_location.clone();
        let executable = manifest.launch_executable.as_ref().and_then(|exe| {
            install_location
                .as_ref()
                .map(|loc| format!("{loc}\\{exe}"))
        });

        games.push(EpicLibraryGame {
            app_name,
            title,
            catalog_id: manifest.catalog_item_id.unwrap_or_default(),
            namespace: manifest.catalog_namespace.unwrap_or_default(),
            description: String::new(),
            key_images: Vec::new(),
            install_location: manifest.install_location,
            executable,
            is_installed: true,
        });
    }
    games
}

// ── Progress helper ───────────────────────────────────────────────────────────

fn emit_epic_progress(app: &AppHandle, phase: &str, completed: Option<u64>, total: Option<u64>) {
    let _ = app.emit(
        "epic:progress",
        json!({
            "phase": phase,
            "completed": completed,
            "total": total,
        }),
    );
}

// ── Commands ─────────────────────────────────────────────────────────────────

fn legendary_config_dirs() -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    if let Ok(home) = std::env::var("USERPROFILE").or_else(|_| std::env::var("HOME")) {
        dirs.push(PathBuf::from(&home).join(".config").join("legendary"));
    }
    if let Ok(local) = std::env::var("LOCALAPPDATA") {
        dirs.push(PathBuf::from(local).join("legendary"));
    }
    if let Ok(appdata) = std::env::var("APPDATA") {
        dirs.push(PathBuf::from(appdata).join("legendary"));
    }
    dirs
}

fn is_epic_account_name(value: &str) -> bool {
    let account = value.trim();
    !account.is_empty()
        && !account.eq_ignore_ascii_case("none")
        && !account.eq_ignore_ascii_case("null")
        && !account.to_ascii_lowercase().contains("not logged in")
}

fn epic_status_from_user_json() -> Option<EpicAccountStatus> {
    for dir in legendary_config_dirs() {
        let path = dir.join("user.json");
        let Ok(raw) = fs::read_to_string(&path) else {
            continue;
        };
        let Ok(val) = serde_json::from_str::<Value>(&raw) else {
            continue;
        };
        let display_name = val
            .get("displayName")
            .or_else(|| val.get("display_name"))
            .and_then(|v| v.as_str())
            .map(str::trim)
            .filter(|s| is_epic_account_name(s))
            .map(String::from);
        let account_id = val
            .get("accountId")
            .or_else(|| val.get("account_id"))
            .or_else(|| val.get("id"))
            .and_then(|v| v.as_str())
            .map(str::trim)
            .filter(|s| is_epic_account_name(s))
            .map(String::from);
        if display_name.is_some() || account_id.is_some() {
            return Some(EpicAccountStatus {
                authenticated: true,
                account_id: account_id.clone().or_else(|| display_name.clone()),
                display_name: display_name.or(account_id),
            });
        }
    }
    None
}

fn epic_status_from_cli(exe: &Path) -> Option<EpicAccountStatus> {
    // Prefer offline so a network blip does not look like a logout.
    for args in [&["status", "--json", "--offline"][..], &["status", "--json"][..]] {
        let mut cmd = Command::new(exe);
        cmd.args(args).stdout(Stdio::piped()).stderr(Stdio::piped());
        #[cfg(windows)]
        cmd.creation_flags(0x08000000);

        let Ok(output) = cmd.output() else {
            continue;
        };
        if !output.status.success() {
            continue;
        }
        let stdout = String::from_utf8_lossy(&output.stdout);
        let Ok(val) = serde_json::from_str::<Value>(&stdout) else {
            continue;
        };
        let account = val
            .get("account")
            .or_else(|| val.get("account_id"))
            .or_else(|| val.get("display_name"))
            .or_else(|| val.get("displayName"))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .trim()
            .to_string();
        if !is_epic_account_name(&account) {
            continue;
        }
        let display_name = val
            .get("display_name")
            .or_else(|| val.get("displayName"))
            .and_then(|v| v.as_str())
            .map(str::trim)
            .filter(|s| is_epic_account_name(s))
            .map(String::from)
            .unwrap_or_else(|| account.clone());
        return Some(EpicAccountStatus {
            authenticated: true,
            account_id: Some(account),
            display_name: Some(display_name),
        });
    }
    None
}

#[command]
pub async fn epic_get_status() -> Result<EpicAccountStatus, String> {
    // user.json is the durable source of truth; CLI can flake on network/timeouts.
    if let Some(status) = epic_status_from_user_json() {
        return Ok(status);
    }

    if let Ok(exe) = legendary_exe_path() {
        if exe.exists() {
            if let Some(status) = epic_status_from_cli(&exe) {
                return Ok(status);
            }
        }
    }

    Ok(EpicAccountStatus {
        authenticated: false,
        account_id: None,
        display_name: None,
    })
}

#[command]
pub async fn epic_authenticate(
    app: AppHandle,
    code: String,
) -> Result<Value, String> {
    let clean_code = code.trim();
    if clean_code.len() < 8 || clean_code.len() > 2048 {
        return Err("Codigo de autenticacao Epic invalido.".to_string());
    }

    emit_epic_progress(&app, "authenticating", None, None);
    run_legendary(&["auth", "--code", clean_code, "-y"])?;
    emit_epic_progress(&app, "refreshing-profile", Some(1), Some(1));
    Ok(json!({ "success": true }))
}

#[command]
pub async fn epic_list_library(app: AppHandle) -> Result<Value, String> {
    emit_epic_progress(&app, "reading-library", None, None);

    let installed = read_installed_epic_games();

    // Check if legendary is authenticated
    let status = epic_get_status().await.unwrap_or(EpicAccountStatus {
        authenticated: false,
        account_id: None,
        display_name: None,
    });

    if !status.authenticated {
        // Return locally installed games from manifests
        let mapped: Vec<Value> = installed
            .into_iter()
            .map(|game| {
                json!({
                    "appName": game.app_name,
                    "title": game.title,
                    "catalogId": game.catalog_id,
                    "namespace": game.namespace,
                    "description": game.description,
                    "installLocation": game.install_location,
                    "executable": game.executable,
                    "isInstalled": true,
                    "keyImages": [],
                })
            })
            .collect();
        emit_epic_progress(&app, "reading-library", Some(mapped.len() as u64), Some(mapped.len() as u64));
        return Ok(json!(mapped));
    }

    // If authenticated, run legendary list-games
    let output = run_legendary(&["list-games", "--json"]).unwrap_or_default();
    let raw: Value = serde_json::from_str(&output).unwrap_or(json!([]));
    let mut items_map = std::collections::HashMap::<String, Value>::new();

    if let Some(items) = raw.as_array() {
        for item in items {
            let metadata = item.get("metadata").cloned().unwrap_or(json!({}));
            let app_name = item.get("app_name").and_then(|v| v.as_str()).unwrap_or("").trim().to_string();
            let catalog_id = metadata.get("id").or_else(|| item.get("app_name")).and_then(|v| v.as_str()).unwrap_or("").trim().to_string();

            let key_images = metadata
                .get("keyImages")
                .and_then(|v| v.as_array())
                .map(|arr| {
                    arr.iter()
                        .take(20)
                        .map(|img| {
                            json!({
                                "type": img.get("type").and_then(|v| v.as_str()).unwrap_or(""),
                                "url": img.get("url").and_then(|v| v.as_str()).unwrap_or(""),
                            })
                        })
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default();

            let entry = json!({
                "appName": app_name,
                "title": item.get("app_title")
                    .or_else(|| metadata.get("title"))
                    .or_else(|| item.get("app_name"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .trim(),
                "catalogId": catalog_id,
                "namespace": metadata.get("namespace").and_then(|v| v.as_str()).unwrap_or("").trim(),
                "description": metadata.get("description").and_then(|v| v.as_str()).unwrap_or("").trim(),
                "keyImages": key_images,
                "isInstalled": false,
            });

            let key = if !app_name.is_empty() { app_name.clone() } else { catalog_id.clone() };
            items_map.insert(key, entry);
        }
    }

    // Merge installed games
    for inst in installed {
        let key = if !inst.app_name.is_empty() { inst.app_name.clone() } else { inst.catalog_id.clone() };
        if let Some(existing) = items_map.get_mut(&key) {
            if let Some(obj) = existing.as_object_mut() {
                obj.insert("isInstalled".to_string(), json!(true));
                obj.insert("installLocation".to_string(), json!(inst.install_location));
                obj.insert("executable".to_string(), json!(inst.executable));
            }
        } else {
            items_map.insert(
                key,
                json!({
                    "appName": inst.app_name,
                    "title": inst.title,
                    "catalogId": inst.catalog_id,
                    "namespace": inst.namespace,
                    "description": inst.description,
                    "installLocation": inst.install_location,
                    "executable": inst.executable,
                    "isInstalled": true,
                    "keyImages": [],
                }),
            );
        }
    }

    let result: Vec<Value> = items_map.into_values().collect();
    emit_epic_progress(&app, "reading-library", Some(result.len() as u64), Some(result.len() as u64));
    Ok(json!(result))
}

#[command]
pub async fn epic_get_achievements(
    app: AppHandle,
    sandbox_id: Option<String>,
    app_name: Option<String>,
) -> Result<Value, String> {
    let target = app_name
        .or(sandbox_id)
        .unwrap_or_default()
        .trim()
        .to_string();

    if target.is_empty() {
        return Ok(json!({ "total": 0, "completed": 0, "list": [] }));
    }

    emit_epic_progress(&app, "reading-achievements", None, None);
    let output = match run_legendary(&["achievements", &target, "--json"]) {
        Ok(out) => out,
        Err(_) => return Ok(json!({ "total": 0, "completed": 0, "list": [] })),
    };

    let data: Value = serde_json::from_str(&output).unwrap_or(json!({}));
    let raw_list = if let Some(arr) = data.get("achievements").and_then(|v| v.as_array()) {
        arr.clone()
    } else {
        let mut merged = Vec::new();
        for key in ["completed", "uncompleted", "in_progress", "uninitiated", "hidden"] {
            if let Some(arr) = data.get(key).and_then(|v| v.as_array()) {
                for item in arr {
                    let mut entry = item.clone();
                    if key == "completed" {
                        if let Some(obj) = entry.as_object_mut() {
                            obj.insert("unlocked".to_string(), json!(true));
                        }
                    }
                    merged.push(entry);
                }
            }
        }
        merged
    };

    let list: Vec<Value> = raw_list
        .iter()
        .filter_map(|ach| {
            let api_name = ach
                .get("name")
                .or_else(|| ach.get("id"))
                .or_else(|| ach.get("api_name"))
                .or_else(|| ach.get("achievementName"))
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .trim();
            if api_name.is_empty() {
                return None;
            }
            Some(json!({
                "apiName": api_name,
                "name": ach.get("unlockedDisplayName")
                    .or_else(|| ach.get("display_name"))
                    .or_else(|| ach.get("name"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("Conquista"),
                "description": ach.get("unlockedDescription")
                    .or_else(|| ach.get("description"))
                    .and_then(|v| v.as_str())
                    .unwrap_or(""),
                "achieved": ach.get("unlocked").or_else(|| ach.get("achieved"))
                    .and_then(|v| v.as_bool())
                    .unwrap_or(false),
                "icon": ach.get("unlockedIconLink")
                    .or_else(|| ach.get("icon_url"))
                    .or_else(|| ach.get("icon"))
                    .and_then(|v| v.as_str())
                    .unwrap_or(""),
                "hidden": ach.get("hidden").and_then(|v| v.as_bool()).unwrap_or(false),
            }))
        })
        .collect();

    let total = data
        .get("total_achievements")
        .and_then(|v| v.as_u64())
        .unwrap_or(list.len() as u64) as usize;
    let completed = data
        .get("user_unlocked")
        .and_then(|v| v.as_u64())
        .unwrap_or_else(|| {
            list.iter()
                .filter(|a| a.get("achieved").and_then(|v| v.as_bool()) == Some(true))
                .count() as u64
        }) as usize;

    Ok(json!({ "total": total, "completed": completed, "list": list }))
}

#[command]
pub async fn epic_logout() -> Result<Value, String> {
    let _ = run_legendary(&["auth", "--delete"]);

    for dir in legendary_config_dirs() {
        for file in ["user.json", "token.json", "config.ini"] {
            let path = dir.join(file);
            let _ = fs::remove_file(path);
        }
        let _ = fs::remove_dir_all(dir);
    }

    Ok(json!({ "success": true }))
}

#[command]
pub async fn epic_validate_session() -> Result<Value, String> {
    let status = epic_get_status().await?;
    if status.authenticated {
        Ok(json!({ "valid": true }))
    } else {
        Ok(json!({ "valid": false, "reason": "missing" }))
    }
}

#[command]
pub async fn epic_capture_auth_code(
    state: State<'_, EpicLoginState>,
    app: AppHandle,
    text: String,
) -> Result<(), String> {
    let trimmed = text.trim();
    let code = if trimmed.starts_with('{') {
        let parsed: Value = serde_json::from_str(trimmed).map_err(|_| "JSON Epic invalido.")?;
        parsed
            .get("authorizationCode")
            .or_else(|| parsed.get("sid"))
            .and_then(|v| v.as_str())
            .map(|s| s.trim().to_string())
    } else if trimmed.contains("code=") {
        trimmed
            .split("code=")
            .nth(1)
            .and_then(|s| s.split('&').next())
            .map(|s| s.trim().to_string())
    } else {
        Some(trimmed.to_string())
    };

    if let Some(code) = code.filter(|c| c.len() >= 8) {
        *state.0.lock() = Some(code);
        if let Some(window) = app.get_webview_window("epic-login") {
            let _ = window.close();
        }
    }
    Ok(())
}

#[command]
pub async fn epic_open_login_window(
    app: AppHandle,
    state: State<'_, EpicLoginState>,
) -> Result<Option<String>, String> {
    *state.0.lock() = None;

    if let Some(existing) = app.get_webview_window("epic-login") {
        let _ = existing.close();
    }

    let url: tauri::Url = EPIC_OAUTH_URL
        .parse()
        .map_err(|e| format!("URL Epic invalida: {e}"))?;

    let login_state = state.inner().0.clone();
    let app_login = app.clone();
    let login_state_load = login_state.clone();

    let _window = WebviewWindowBuilder::new(&app, "epic-login", WebviewUrl::External(url))
        .title("Pherielium - Conectar Epic Games")
        .inner_size(580.0, 720.0)
        .center()
        .on_page_load(move |_webview, payload| {
            let current = payload.url();
            let current_str = current.as_str();

            for (k, v) in current.query_pairs() {
                if (k == "code" || k == "authorizationCode") && !v.is_empty() {
                    let code = v.to_string();
                    *login_state_load.lock() = Some(code);
                    if let Some(w) = app_login.get_webview_window("epic-login") {
                        let _ = w.close();
                    }
                    return;
                }
                if k == "redirectUrl" && v.contains("code=") {
                    if let Some(pos) = v.find("code=") {
                        let sub = &v[pos + 5..];
                        let code = sub.split('&').next().unwrap_or(sub);
                        if !code.is_empty() {
                            *login_state_load.lock() = Some(code.to_string());
                            if let Some(w) = app_login.get_webview_window("epic-login") {
                                let _ = w.close();
                            }
                            return;
                        }
                    }
                }
            }

            if !current_str.starts_with("https://www.epicgames.com/id/api/redirect") {
                return;
            }

            let app_eval = app_login.clone();
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(Duration::from_millis(400)).await;
                let script = r#"
                  (async () => {
                    try {
                      const text = document.body ? document.body.innerText : "";
                      if (text) {
                        try {
                          const json = JSON.parse(text);
                          const c = json.authorizationCode || json.code || json.sid;
                          if (c) {
                            document.title = "PHERIELIUM_AUTH_CODE:" + c;
                          }
                        } catch (_) {}
                      }
                      if (text && window.__TAURI__) {
                        await window.__TAURI__.core.invoke("epic_capture_auth_code", { text });
                      }
                    } catch (e) {
                      console.warn("[epic-login]", e);
                    }
                  })();
                "#;
                if let Some(w) = app_eval.get_webview_window("epic-login") {
                    let _ = w.eval(script);
                }
            });
        })
        .build()
        .map_err(|e| format!("Falha ao abrir janela Epic: {e}"))?;

    let app_wait = app.clone();

    for _ in 0..600 {
        tokio::time::sleep(Duration::from_millis(500)).await;
        if let Some(code) = login_state.lock().clone() {
            return Ok(Some(code));
        }
        if let Some(win) = app_wait.get_webview_window("epic-login") {
            if let Ok(title) = win.title() {
                if let Some(code) = title.strip_prefix("PHERIELIUM_AUTH_CODE:") {
                    let clean = code.trim().to_string();
                    if !clean.is_empty() {
                        *login_state.lock() = Some(clean.clone());
                        let _ = win.close();
                        return Ok(Some(clean));
                    }
                }
            }
        } else {
            break;
        }
    }

    let code = login_state.lock().clone();
    Ok(code)
}

fn search_local_legendary_library(query: &str) -> Vec<Value> {
    let mut results = Vec::new();
    let q = query.to_lowercase().trim().to_string();
    if q.is_empty() {
        return results;
    }

    let mut dirs = vec![];
    if let Ok(home) = std::env::var("USERPROFILE").or_else(|_| std::env::var("HOME")) {
        dirs.push(PathBuf::from(home).join(".config").join("legendary").join("metadata"));
    }
    if let Ok(local) = std::env::var("LOCALAPPDATA") {
        dirs.push(PathBuf::from(local).join("legendary").join("metadata"));
    }
    if let Ok(appdata) = std::env::var("APPDATA") {
        dirs.push(PathBuf::from(appdata).join("legendary").join("metadata"));
    }

    for meta_dir in dirs {
        if !meta_dir.exists() {
            continue;
        }
        if let Ok(entries) = fs::read_dir(&meta_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().and_then(|s| s.to_str()) == Some("json") {
                    if let Ok(content) = fs::read_to_string(&path) {
                        if let Ok(item) = serde_json::from_str::<Value>(&content) {
                            let metadata = item.get("metadata").cloned().unwrap_or(json!({}));
                            let app_name = item
                                .get("app_name")
                                .and_then(|v| v.as_str())
                                .unwrap_or("")
                                .trim()
                                .to_string();
                            let title = item
                                .get("app_title")
                                .or_else(|| metadata.get("title"))
                                .or_else(|| item.get("app_name"))
                                .and_then(|v| v.as_str())
                                .unwrap_or("")
                                .trim()
                                .to_string();
                            let catalog_id = metadata
                                .get("id")
                                .or_else(|| item.get("app_name"))
                                .and_then(|v| v.as_str())
                                .unwrap_or("")
                                .trim()
                                .to_string();
                            let namespace = metadata
                                .get("namespace")
                                .and_then(|v| v.as_str())
                                .unwrap_or("")
                                .trim()
                                .to_string();
                            let description = metadata
                                .get("description")
                                .and_then(|v| v.as_str())
                                .unwrap_or("")
                                .trim()
                                .to_string();

                            let title_lower = title.to_lowercase();
                            let app_lower = app_name.to_lowercase();
                            if title_lower.contains(&q) || app_lower.contains(&q) {
                                let key_images = metadata.get("keyImages").cloned().unwrap_or(json!([]));
                                results.push(json!({
                                    "id": catalog_id,
                                    "catalogId": catalog_id,
                                    "title": title,
                                    "appName": app_name,
                                    "namespace": namespace,
                                    "productSlug": "",
                                    "keyImages": key_images,
                                    "description": description,
                                }));
                            }
                        }
                    }
                }
            }
        }
    }
    results
}

#[command]
pub async fn epic_search_store(query: String) -> Result<Vec<Value>, String> {
    let q = query.trim();
    if q.is_empty() {
        return Ok(vec![]);
    }
    let q_lower = q.to_lowercase();
    let mut results: Vec<Value> = Vec::new();
    let mut seen_titles = HashSet::<String>::new();

    // 1. Search local legendary library metadata cache
    for item in search_local_legendary_library(q) {
        let title = item.get("title").and_then(|v| v.as_str()).unwrap_or("").trim().to_string();
        if !title.is_empty() && seen_titles.insert(title.to_lowercase()) {
            results.push(item);
        }
    }

    // 2. Search local installed Epic manifests
    for inst in read_installed_epic_games() {
        let title = inst.title.trim().to_string();
        if !title.is_empty()
            && (title.to_lowercase().contains(&q_lower) || inst.app_name.to_lowercase().contains(&q_lower))
        {
            if seen_titles.insert(title.to_lowercase()) {
                results.push(json!({
                    "id": inst.catalog_id,
                    "catalogId": inst.catalog_id,
                    "title": title,
                    "appName": inst.app_name,
                    "namespace": inst.namespace,
                    "productSlug": "",
                    "keyImages": [],
                    "description": inst.description,
                    "isInstalled": true,
                    "executable": inst.executable,
                }));
            }
        }
    }

    // 3. Search store-content productmapping (Akamai CDN, no Cloudflare block)
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(4))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());

    let mapping_url = "https://store-content-ipv4.ak.epicgames.com/api/content/productmapping";
    if let Ok(resp) = client.get(mapping_url).send().await {
        if let Ok(mapping) = resp.json::<HashMap<String, String>>().await {
            let query_words: Vec<&str> = q_lower.split_whitespace().collect();
            let query_slug = q_lower.replace(' ', "-");
            let mut matching_slugs: Vec<(String, String)> = Vec::new();

            for (namespace_or_key, slug) in mapping {
                let s_lower = slug.to_lowercase();
                if s_lower.contains(&query_slug) || query_words.iter().all(|w| s_lower.contains(w)) {
                    matching_slugs.push((namespace_or_key, slug));
                    if matching_slugs.len() >= 6 {
                        break;
                    }
                }
            }

            for (ns, slug) in matching_slugs {
                let prod_url = format!("https://store-content-ipv4.ak.epicgames.com/api/pt-BR/content/products/{slug}");
                if let Ok(prod_resp) = client.get(&prod_url).send().await {
                    if let Ok(payload) = prod_resp.json::<Value>().await {
                        if let Some(page) = payload.pointer("/pages/0") {
                            let about = page.get("data").and_then(|d| d.get("about"));
                            let hero = page.get("data").and_then(|d| d.get("hero"));
                            let images = page.get("_images_").and_then(|i| i.as_array());

                            let card_img = about
                                .and_then(|a| a.get("image"))
                                .and_then(|img| img.get("src"))
                                .and_then(|s| s.as_str())
                                .or_else(|| {
                                    hero.and_then(|h| h.get("portraitBackgroundImageUrl"))
                                        .and_then(|s| s.as_str())
                                })
                                .unwrap_or("");

                            let bg_img = hero
                                .and_then(|h| h.get("backgroundImageUrl"))
                                .and_then(|s| s.as_str())
                                .or_else(|| images.and_then(|arr| arr.first()).and_then(|v| v.as_str()))
                                .unwrap_or(card_img);

                            let thumb_img = about
                                .and_then(|a| a.get("image"))
                                .and_then(|img| img.get("src"))
                                .and_then(|s| s.as_str())
                                .or_else(|| {
                                    hero.and_then(|h| h.get("logoImage"))
                                        .and_then(|l| l.get("src"))
                                        .and_then(|s| s.as_str())
                                })
                                .unwrap_or(card_img);

                            let title = about
                                .and_then(|a| a.get("title"))
                                .and_then(|s| s.as_str())
                                .or_else(|| page.get("_title").and_then(|s| s.as_str()))
                                .or_else(|| page.get("productName").and_then(|s| s.as_str()))
                                .unwrap_or(&slug)
                                .to_string();

                            let desc = about
                                .and_then(|a| a.get("description"))
                                .and_then(|s| s.as_str())
                                .or_else(|| {
                                    about
                                        .and_then(|a| a.get("shortDescription"))
                                        .and_then(|s| s.as_str())
                                })
                                .unwrap_or("")
                                .to_string();

                            let item_id = page
                                .pointer("/offer/id")
                                .or_else(|| page.pointer("/item/id"))
                                .or_else(|| page.get("_id"))
                                .and_then(|v| v.as_str())
                                .unwrap_or(&slug)
                                .to_string();

                            if seen_titles.insert(title.to_lowercase()) {
                                results.push(json!({
                                    "id": item_id,
                                    "catalogId": item_id,
                                    "title": title,
                                    "appName": "",
                                    "namespace": page.get("namespace").and_then(|v| v.as_str()).unwrap_or(&ns),
                                    "productSlug": slug,
                                    "keyImages": [
                                        { "type": "OfferImageTall", "url": card_img },
                                        { "type": "OfferImageWide", "url": bg_img },
                                        { "type": "Thumbnail", "url": thumb_img },
                                    ],
                                    "description": desc,
                                }));
                            }
                        }
                    }
                }
            }
        }
    }

    // 4. Steam Community Search fallback if results are low
    if results.len() < 4 {
        let clean_q = q.replace(|c: char| !c.is_alphanumeric() && c != ' ', "");
        let steam_url = format!("https://steamcommunity.com/actions/SearchApps/{}", clean_q.replace(' ', "%20"));
        if let Ok(steam_resp) = client.get(&steam_url).send().await {
            if let Ok(steam_items) = steam_resp.json::<Vec<Value>>().await {
                for it in steam_items.into_iter().take(8) {
                    let name = it.get("name").and_then(|v| v.as_str()).unwrap_or("").trim().to_string();
                    let appid = it.get("appid").and_then(|v| v.as_str()).unwrap_or("").trim().to_string();
                    if !name.is_empty() && !appid.is_empty() && seen_titles.insert(name.to_lowercase()) {
                        let tall = format!(
                            "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/{appid}/library_600x900_2x.jpg"
                        );
                        let wide = format!(
                            "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/{appid}/header.jpg"
                        );
                        let thumb = it
                            .get("logo")
                            .or_else(|| it.get("icon"))
                            .and_then(|v| v.as_str())
                            .unwrap_or(&wide)
                            .to_string();
                        results.push(json!({
                            "id": format!("steam_{appid}"),
                            "catalogId": format!("steam_{appid}"),
                            "title": name,
                            "appName": "",
                            "namespace": "",
                            "productSlug": "",
                            "keyImages": [
                                { "type": "OfferImageTall", "url": tall },
                                { "type": "OfferImageWide", "url": wide },
                                { "type": "Thumbnail", "url": thumb },
                            ],
                            "description": "",
                        }));
                    }
                }
            }
        }
    }

    Ok(results)
}

#[command]
pub async fn epic_fetch_store_details(request: Value) -> Result<Value, String> {
    let product_slug = request
        .get("productSlug")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();

    let title_query = request
        .get("title")
        .or_else(|| request.get("appName"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim();

    let catalog_id = request
        .get("catalogId")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim();

    let namespace = request
        .get("namespace")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim();

    let app_name = request
        .get("appName")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim();

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(6))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());

    // 1. Gera lista de slugs candidatos para o endpoint da Epic (/p/[nome]-[do]-[jogo])
    let mut candidate_slugs: Vec<String> = Vec::new();
    if !product_slug.is_empty() {
        candidate_slugs.push(product_slug.to_string());
    }

    let edition_words = [
        "enhanced", "edition", "deluxe", "definitive", "standard",
        "bundle", "complete", "goty", "remastered", "legacy", "online",
        "the", "directors cut"
    ];

    if !title_query.is_empty() {
        let title_lower = title_query.to_lowercase();
        let mut clean_title = title_lower.clone();
        for ew in &edition_words {
            clean_title = clean_title.replace(ew, " ");
        }

        let clean_words: Vec<String> = clean_title
            .replace(|c: char| !c.is_alphanumeric() && c != ' ', "")
            .split_whitespace()
            .map(|s| s.to_string())
            .collect();
        let clean_slug = clean_words.join("-");

        let full_words: Vec<String> = title_lower
            .replace(|c: char| !c.is_alphanumeric() && c != ' ', "")
            .split_whitespace()
            .map(|s| s.to_string())
            .collect();
        let full_slug = full_words.join("-");

        if !clean_slug.is_empty() && !candidate_slugs.contains(&clean_slug) {
            candidate_slugs.push(clean_slug.clone());
        }
        if !full_slug.is_empty() && !candidate_slugs.contains(&full_slug) {
            candidate_slugs.push(full_slug);
        }

        // Sub-slugs progressivos (ex: 4 palavras, 3 palavras, 2 palavras)
        if clean_words.len() >= 3 {
            for len in (2..clean_words.len()).rev() {
                let sub = clean_words[..len].join("-");
                if !candidate_slugs.contains(&sub) {
                    candidate_slugs.push(sub);
                }
            }
        }
    }

    // Tenta também resolver via productmapping da Epic
    let mapping_url = "https://store-content-ipv4.ak.epicgames.com/api/content/productmapping";
    if let Ok(resp) = client.get(mapping_url).send().await {
        if let Ok(mapping) = resp.json::<HashMap<String, String>>().await {
            if !catalog_id.is_empty() {
                if let Some(slug) = mapping.get(catalog_id) {
                    if !candidate_slugs.contains(slug) {
                        candidate_slugs.insert(0, slug.clone());
                    }
                }
            }
            if !namespace.is_empty() {
                if let Some(slug) = mapping.get(namespace) {
                    if !candidate_slugs.contains(slug) {
                        candidate_slugs.insert(0, slug.clone());
                    }
                }
            }
            if !app_name.is_empty() {
                let app_clean = app_name.to_lowercase().replace(' ', "-");
                for (k, v) in &mapping {
                    if k.eq_ignore_ascii_case(app_name)
                        || v.eq_ignore_ascii_case(&app_clean)
                        || v.to_lowercase().contains(&app_clean)
                    {
                        if !candidate_slugs.contains(v) {
                            candidate_slugs.push(v.clone());
                        }
                    }
                }
            }
            for candidate in candidate_slugs.clone() {
                for (_k, v) in &mapping {
                    let vl = v.to_lowercase();
                    if vl == candidate || vl.contains(&candidate) || candidate.contains(&vl) {
                        if !candidate_slugs.contains(v) {
                            candidate_slugs.push(v.clone());
                        }
                    }
                }
            }
        }
    }

    // 2. Itera sobre candidate_slugs tentando buscar página de produto no CDN Akamai da Epic
    for candidate in &candidate_slugs {
        let urls_to_try = [
            format!("https://store-content-ipv4.ak.epicgames.com/api/pt-BR/content/products/{candidate}"),
            format!("https://store-content-ipv4.ak.epicgames.com/api/en-US/content/products/{candidate}"),
        ];

        for url in &urls_to_try {
            if let Ok(resp) = client.get(url).send().await {
                if !resp.status().is_success() {
                    continue;
                }
                if let Ok(payload) = resp.json::<Value>().await {
                    if let Some(page) = payload.pointer("/pages/0") {
                        let product_slug = candidate.clone();
                        let about = page.get("data").and_then(|d| d.get("about"));
                        let hero = page.get("data").and_then(|d| d.get("hero"));
                        let meta = page.get("data").and_then(|d| d.get("meta"));
                        let carousel_items = page.pointer("/data/carousel/items").and_then(|c| c.as_array());
                        let images = page.get("_images_").and_then(|i| i.as_array());

                        let mut screenshots: Vec<String> = Vec::new();
                        let mut seen_screenshots = std::collections::HashSet::new();

                        if let Some(items) = carousel_items {
                            for item in items {
                                if let Some(src) = item.get("image").and_then(|img| img.get("src")).and_then(|s| s.as_str()) {
                                    if !src.is_empty() && seen_screenshots.insert(src.to_string()) {
                                        screenshots.push(src.to_string());
                                    }
                                }
                            }
                        }

                        if let Some(imgs) = images {
                            for img in imgs {
                                if let Some(src) = img.as_str() {
                                    let lower = src.to_lowercase();
                                    if !lower.contains("logo")
                                        && !lower.contains("esrb")
                                        && !lower.contains("icon")
                                        && !lower.contains("publisher")
                                        && seen_screenshots.insert(src.to_string())
                                    {
                                        screenshots.push(src.to_string());
                                    }
                                }
                            }
                        }

                        let mut trailer_url = String::new();
                        if let Some(items) = carousel_items {
                            for item in items {
                                if let Some(recipes_str) = item.pointer("/video/recipes").and_then(|s| s.as_str()) {
                                    if let Ok(recipe_json) = serde_json::from_str::<Value>(recipes_str) {
                                        if let Some(outputs) = recipe_json.get("output").and_then(|o| o.as_array()) {
                                            for out in outputs {
                                                if let Some(url_str) = out.as_str() {
                                                    if url_str.ends_with(".mp4") {
                                                        trailer_url = url_str.to_string();
                                                        break;
                                                    }
                                                }
                                            }
                                        }
                                    }
                                    if !trailer_url.is_empty() {
                                        break;
                                    }
                                }
                            }
                        }

                        let card_image = about
                            .and_then(|a| a.get("image"))
                            .and_then(|img| img.get("src"))
                            .and_then(|s| s.as_str())
                            .or_else(|| {
                                hero.and_then(|h| h.get("portraitBackgroundImageUrl"))
                                    .and_then(|s| s.as_str())
                            })
                            .or_else(|| screenshots.first().map(|s| s.as_str()))
                            .unwrap_or("");

                        let bg_image = hero
                            .and_then(|h| h.get("backgroundImageUrl"))
                            .and_then(|s| s.as_str())
                            .or_else(|| screenshots.first().map(|s| s.as_str()))
                            .unwrap_or(card_image);

                        let logo_image = hero
                            .and_then(|h| h.get("logoImage"))
                            .and_then(|l| l.get("src"))
                            .and_then(|s| s.as_str())
                            .unwrap_or("");

                        let short_desc = about
                            .and_then(|a| a.get("shortDescription"))
                            .and_then(|s| s.as_str())
                            .unwrap_or("");

                        let full_desc = about
                            .and_then(|a| a.get("description"))
                            .and_then(|s| s.as_str())
                            .unwrap_or("");

                        let description = if !short_desc.is_empty() {
                            short_desc
                        } else {
                            full_desc
                        };

                        let about_the_game = if !full_desc.is_empty() {
                            full_desc
                        } else {
                            short_desc
                        };

                        let developer = meta
                            .and_then(|m| m.pointer("/developer/0"))
                            .and_then(|s| s.as_str())
                            .or_else(|| about.and_then(|a| a.get("developerAttribution")).and_then(|s| s.as_str()))
                            .unwrap_or("");

                        let publisher = meta
                            .and_then(|m| m.pointer("/publisher/0"))
                            .and_then(|s| s.as_str())
                            .or_else(|| about.and_then(|a| a.get("publisherAttribution")).and_then(|s| s.as_str()))
                            .unwrap_or("");

                        let release_date = meta
                            .and_then(|m| m.get("releaseDate"))
                            .and_then(|s| s.as_str())
                            .unwrap_or("");

                        let mut tags: Vec<String> = Vec::new();
                        if let Some(meta_tags) = meta.and_then(|m| m.get("tags")).and_then(|t| t.as_array()) {
                            for t in meta_tags {
                                if let Some(s) = t.as_str() {
                                    tags.push(s.to_string());
                                } else if let Some(s) = t.get("name").and_then(|n| n.as_str()) {
                                    tags.push(s.to_string());
                                }
                            }
                        }

                        let title = about
                            .and_then(|a| a.get("title"))
                            .and_then(|s| s.as_str())
                            .or_else(|| page.get("_title").and_then(|s| s.as_str()))
                            .unwrap_or(title_query);

                        if !card_image.is_empty() || !bg_image.is_empty() || !screenshots.is_empty() || !description.is_empty() {
                            return Ok(json!({
                                "catalogId": request.get("catalogId").cloned().unwrap_or(json!("")),
                                "namespace": request.get("namespace").cloned().unwrap_or(json!("")),
                                "appName": request.get("appName").cloned().unwrap_or(json!("")),
                                "title": title,
                                "image": card_image,
                                "cardImage": card_image,
                                "backgroundImage": bg_image,
                                "logoImage": logo_image,
                                "description": description,
                                "aboutTheGame": about_the_game,
                                "developer": developer,
                                "publisher": publisher,
                                "releaseDate": release_date,
                                "tags": tags,
                                "screenshots": screenshots,
                                "trailerUrl": trailer_url,
                                "productSlug": product_slug,
                                "productUrl": format!("https://store.epicgames.com/p/{product_slug}"),
                            }));
                        }
                    }
                }
            }
        }
    }

    // 3. Fallback: Se não encontrou imagens na Epic, busca no catálogo público da Steam pelo título
    if !title_query.is_empty() {
        let clean_title = title_query.replace(|c: char| !c.is_alphanumeric() && c != ' ', "");
        let steam_url = format!(
            "https://steamcommunity.com/actions/SearchApps/{}",
            clean_title.replace(' ', "%20")
        );
        if let Ok(steam_resp) = client.get(&steam_url).send().await {
            if let Ok(steam_items) = steam_resp.json::<Vec<Value>>().await {
                if let Some(first) = steam_items.first() {
                    let appid = first
                        .get("appid")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .trim();
                    let matched_name = first
                        .get("name")
                        .and_then(|v| v.as_str())
                        .unwrap_or(title_query);

                    if !appid.is_empty() {
                        let card_img = format!(
                            "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/{appid}/library_600x900_2x.jpg"
                        );
                        let bg_img = format!(
                            "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/{appid}/header.jpg"
                        );

                        // Enriquecer com detalhes da loja Steam
                        let mut steam_desc = String::new();
                        let mut steam_about = String::new();
                        let mut steam_dev = String::new();
                        let mut steam_pub = String::new();
                        let mut steam_release = String::new();
                        let mut steam_tags = Vec::new();
                        let mut steam_screenshots = Vec::new();

                        let steam_detail_url = format!(
                            "https://store.steampowered.com/api/appdetails?appids={appid}&l=brazilian"
                        );
                        if let Ok(detail_resp) = client.get(&steam_detail_url).send().await {
                            if let Ok(detail_val) = detail_resp.json::<Value>().await {
                                if let Some(app_data) = detail_val.get(appid).and_then(|v| v.get("data")) {
                                    steam_desc = app_data.get("short_description").and_then(|v| v.as_str()).unwrap_or("").to_string();
                                    steam_about = app_data.get("detailed_description").or_else(|| app_data.get("about_the_game")).and_then(|v| v.as_str()).unwrap_or("").to_string();
                                    if let Some(devs) = app_data.get("developers").and_then(|v| v.as_array()) {
                                        if let Some(d) = devs.first().and_then(|v| v.as_str()) {
                                            steam_dev = d.to_string();
                                        }
                                    }
                                    if let Some(pubs) = app_data.get("publishers").and_then(|v| v.as_array()) {
                                        if let Some(p) = pubs.first().and_then(|v| v.as_str()) {
                                            steam_pub = p.to_string();
                                        }
                                    }
                                    if let Some(rd) = app_data.pointer("/release_date/date").and_then(|v| v.as_str()) {
                                        steam_release = rd.to_string();
                                    }
                                    if let Some(genres) = app_data.get("genres").and_then(|v| v.as_array()) {
                                        for g in genres {
                                            if let Some(d) = g.get("description").and_then(|v| v.as_str()) {
                                                steam_tags.push(d.to_string());
                                            }
                                        }
                                    }
                                    if let Some(screens) = app_data.get("screenshots").and_then(|v| v.as_array()) {
                                        for s in screens {
                                            if let Some(p) = s.get("path_full").or_else(|| s.get("path_thumbnail")).and_then(|v| v.as_str()) {
                                                steam_screenshots.push(p.to_string());
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        return Ok(json!({
                            "catalogId": request.get("catalogId").cloned().unwrap_or(json!("")),
                            "namespace": request.get("namespace").cloned().unwrap_or(json!("")),
                            "appName": request.get("appName").cloned().unwrap_or(json!("")),
                            "title": matched_name,
                            "image": card_img,
                            "cardImage": card_img,
                            "backgroundImage": bg_img,
                            "logoImage": "",
                            "description": steam_desc,
                            "aboutTheGame": steam_about,
                            "developer": steam_dev,
                            "publisher": steam_pub,
                            "releaseDate": steam_release,
                            "tags": steam_tags,
                            "screenshots": steam_screenshots,
                            "productSlug": product_slug,
                            "productUrl": if !product_slug.is_empty() {
                                format!("https://store.epicgames.com/p/{product_slug}")
                            } else {
                                String::new()
                            },
                        }));
                    }
                }
            }
        }
    }

    Ok(json!({
        "catalogId": request.get("catalogId").cloned().unwrap_or(json!("")),
        "namespace": request.get("namespace").cloned().unwrap_or(json!("")),
        "appName": request.get("appName").cloned().unwrap_or(json!("")),
        "title": title_query,
    }))
}
