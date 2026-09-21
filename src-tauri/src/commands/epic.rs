//! Tauri commands: Epic Games integration
//! Supports local manifest reading, automatic Legendary CLI installation & auth,
//! in-app Epic OAuth webview capture, library syncing, and store details.

use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
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

#[command]
pub async fn epic_get_status() -> Result<EpicAccountStatus, String> {
    let exe = match legendary_exe_path() {
        Ok(p) => p,
        Err(_) => {
            return Ok(EpicAccountStatus {
                authenticated: false,
                account_id: None,
                display_name: None,
            });
        }
    };

    if !exe.exists() {
        return Ok(EpicAccountStatus {
            authenticated: false,
            account_id: None,
            display_name: None,
        });
    }

    let mut cmd = Command::new(&exe);
    cmd.args(["status", "--json"])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    #[cfg(windows)]
    cmd.creation_flags(0x08000000);

    if let Ok(output) = cmd.output() {
        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            if let Ok(val) = serde_json::from_str::<Value>(&stdout) {
                let account = val.get("account")
                    .or_else(|| val.get("account_id"))
                    .or_else(|| val.get("display_name"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .trim()
                    .to_string();

                if !account.is_empty()
                    && account != "none"
                    && account != "null"
                    && !account.contains("not logged in")
                {
                    let display_name = val.get("display_name")
                        .or_else(|| val.get("displayName"))
                        .and_then(|v| v.as_str())
                        .map(String::from)
                        .unwrap_or_else(|| account.clone());

                    return Ok(EpicAccountStatus {
                        authenticated: true,
                        account_id: Some(account),
                        display_name: Some(display_name),
                    });
                }
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

    let mut dirs = vec![];
    if let Ok(home) = std::env::var("USERPROFILE").or_else(|_| std::env::var("HOME")) {
        dirs.push(PathBuf::from(home).join(".config").join("legendary"));
    }
    if let Ok(local) = std::env::var("LOCALAPPDATA") {
        dirs.push(PathBuf::from(local).join("legendary"));
    }
    if let Ok(appdata) = std::env::var("APPDATA") {
        dirs.push(PathBuf::from(appdata).join("legendary"));
    }

    for dir in dirs {
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

#[command]
pub async fn epic_search_store(query: String) -> Result<Vec<Value>, String> {
    let client = reqwest::Client::new();
    let gql_url = "https://store.epicgames.com/graphql";
    let payload = json!({
        "query": r#"query searchStoreQuery($keywords: String) {
            Catalog {
                searchStore(keywords: $keywords, category: "games/edition/base", count: 20) {
                    elements {
                        id
                        title
                        namespace
                        productSlug
                        catalogNs { mappings { pageSlug pageType } }
                        keyImages { type url }
                        price { totalPrice { discountPrice } }
                    }
                }
            }
        }"#,
        "variables": { "keywords": query }
    });

    let resp = client
        .post(gql_url)
        .json(&payload)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let val: Value = resp.json().await.map_err(|e| e.to_string())?;
    let elements = val["data"]["Catalog"]["searchStore"]["elements"]
        .as_array()
        .cloned()
        .unwrap_or_default();

    Ok(elements)
}

#[command]
pub async fn epic_fetch_store_details(request: Value) -> Result<Value, String> {
    let product_slug = request
        .get("productSlug")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim();

    let title_query = request
        .get("title")
        .or_else(|| request.get("appName"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim();

    if !product_slug.is_empty() {
        let client = reqwest::Client::new();
        let url = format!(
            "https://store-content-ipv4.ak.epicgames.com/api/pt-BR/content/products/{product_slug}"
        );
        if let Ok(resp) = client.get(&url).send().await {
            if let Ok(payload) = resp.json::<Value>().await {
                return Ok(json!({
                    "catalogId": request.get("catalogId").cloned().unwrap_or(json!("")),
                    "namespace": request.get("namespace").cloned().unwrap_or(json!("")),
                    "appName": request.get("appName").cloned().unwrap_or(json!("")),
                    "title": title_query,
                    "image": payload.pointer("/pages/0/data/about/image").cloned().unwrap_or(json!("")),
                    "cardImage": payload.pointer("/pages/0/data/about/image").cloned().unwrap_or(json!("")),
                    "backgroundImage": payload.pointer("/pages/0/data/about/image").cloned().unwrap_or(json!("")),
                    "description": payload.pointer("/pages/0/data/about/description").cloned().unwrap_or(json!("")),
                    "productSlug": product_slug,
                }));
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
