//! Tauri commands: Nexus Mods API, download manager, credential store
//! Substitui electron/mods/*.cjs (11 arquivos, ~88 KB total)

use std::path::PathBuf;
use tauri::{command, AppHandle};

const NEXUS_API_BASE: &str = "https://api.nexusmods.com/v1";

// ── Credential store (keyring) ────────────────────────────────────────────────

const KEYRING_SERVICE: &str = "pherielium-nexus";
const KEYRING_USER: &str = "api-key";

fn save_nexus_key(key: &str) -> anyhow::Result<()> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER)?;
    entry.set_password(key)?;
    Ok(())
}

fn load_nexus_key() -> Option<String> {
    keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER)
        .ok()
        .and_then(|e| e.get_password().ok())
}

fn delete_nexus_key() -> anyhow::Result<()> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER)?;
    entry.delete_credential()?;
    Ok(())
}

// ── Nexus API client ─────────────────────────────────────────────────────────

async fn nexus_get(endpoint: &str, api_key: &str) -> anyhow::Result<serde_json::Value> {
    let client = reqwest::Client::new();
    let url = format!("{NEXUS_API_BASE}{endpoint}");
    let resp = client
        .get(&url)
        .header("apikey", api_key)
        .header("Accept", "application/json")
        .header("User-Agent", "Pherielium/3.2.7")
        .send()
        .await?;
    let val: serde_json::Value = resp.json().await?;
    Ok(val)
}

// ── Commands ─────────────────────────────────────────────────────────────────

#[command]
pub async fn nexus_get_status() -> Result<serde_json::Value, String> {
    let has_key = load_nexus_key().is_some();
    Ok(serde_json::json!({
        "connected": has_key,
        "encryptionAvailable": true
    }))
}

#[command]
pub async fn nexus_connect_personal_key(api_key: String) -> Result<serde_json::Value, String> {
    // Validate key by calling /users/validate
    let client = reqwest::Client::new();
    let resp = client
        .get(format!("{NEXUS_API_BASE}/users/validate.json"))
        .header("apikey", &api_key)
        .header("Accept", "application/json")
        .header("User-Agent", "Pherielium/3.2.7")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        return Err("Invalid API key".to_string());
    }

    let val: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    save_nexus_key(&api_key).map_err(|e| e.to_string())?;

    Ok(serde_json::json!({
        "connected": true,
        "encryptionAvailable": true,
        "account": {
            "userId": val["user_id"],
            "name": val["name"],
            "profileUrl": val["profile_url"],
            "isPremium": val["is_premium"],
            "isSupporter": val["is_supporter"],
            "rateLimit": { "dailyRemaining": null, "hourlyRemaining": null }
        }
    }))
}

#[command]
pub async fn nexus_validate_connection() -> Result<serde_json::Value, String> {
    let Some(key) = load_nexus_key() else {
        return Ok(serde_json::json!({ "connected": false, "encryptionAvailable": true, "account": null }));
    };

    let client = reqwest::Client::new();
    let resp = client
        .get(format!("{NEXUS_API_BASE}/users/validate.json"))
        .header("apikey", &key)
        .header("Accept", "application/json")
        .header("User-Agent", "Pherielium/3.2.7")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        return Ok(serde_json::json!({ "connected": false, "encryptionAvailable": true, "account": null }));
    }

    let val: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    Ok(serde_json::json!({
        "connected": true,
        "encryptionAvailable": true,
        "account": {
            "userId": val["user_id"],
            "name": val["name"],
            "profileUrl": val["profile_url"],
            "isPremium": val["is_premium"],
            "isSupporter": val["is_supporter"],
            "rateLimit": { "dailyRemaining": null, "hourlyRemaining": null }
        }
    }))
}

#[command]
pub async fn nexus_disconnect() -> Result<serde_json::Value, String> {
    delete_nexus_key().ok();
    Ok(serde_json::json!({ "connected": false, "encryptionAvailable": true }))
}

#[command]
pub async fn nexus_get_mod_catalog(game_domain: String) -> Result<serde_json::Value, String> {
    let Some(key) = load_nexus_key() else {
        return Err("Not connected to Nexus".to_string());
    };

    let endpoint = format!("/games/{game_domain}/mods/trending.json?limit=20");
    let val = nexus_get(&endpoint, &key).await.map_err(|e| e.to_string())?;

    let mods = val
        .as_array()
        .map(|arr| {
            arr.iter().map(|m| serde_json::json!({
                "id": m["mod_id"].to_string(),
                "modId": m["mod_id"].to_string(),
                "name": m["name"],
                "author": m["user"]["name"],
                "summary": m["summary"],
                "pictureUrl": m["picture_url"],
                "modPageUrl": format!("https://www.nexusmods.com/{game_domain}/mods/{}", m["mod_id"]),
                "version": m["version"],
                "downloads": m["mod_downloads"],
                "endorsements": m["endorsement_count"],
                "updatedAt": m["updated_time"],
                "feed": "trending"
            })).collect::<Vec<_>>()
        })
        .unwrap_or_default();

    Ok(serde_json::json!({
        "mods": mods,
        "scope": "curated-feeds",
        "recentCandidateCount": mods.len(),
        "rateLimit": { "dailyRemaining": null, "hourlyRemaining": null }
    }))
}

#[command]
pub async fn nexus_get_mod_details(
    game_domain: String,
    mod_id: String,
) -> Result<serde_json::Value, String> {
    let Some(key) = load_nexus_key() else {
        return Err("Not connected to Nexus".to_string());
    };
    let endpoint = format!("/games/{game_domain}/mods/{mod_id}.json");
    let m = nexus_get(&endpoint, &key).await.map_err(|e| e.to_string())?;

    Ok(serde_json::json!({
        "mod": {
            "id": m["mod_id"].to_string(),
            "modId": m["mod_id"].to_string(),
            "name": m["name"],
            "author": m["user"]["name"],
            "summary": m["summary"],
            "pictureUrl": m["picture_url"],
            "modPageUrl": format!("https://www.nexusmods.com/{game_domain}/mods/{mod_id}"),
            "version": m["version"],
            "downloads": m["mod_downloads"],
            "endorsements": m["endorsement_count"],
            "updatedAt": m["updated_time"],
            "feed": "detail"
        },
        "rateLimit": { "dailyRemaining": null, "hourlyRemaining": null }
    }))
}

#[command]
pub async fn nexus_get_mod_files(
    game_domain: String,
    mod_id: String,
) -> Result<serde_json::Value, String> {
    let Some(key) = load_nexus_key() else {
        return Err("Not connected to Nexus".to_string());
    };
    let endpoint = format!("/games/{game_domain}/mods/{mod_id}/files.json");
    let val = nexus_get(&endpoint, &key).await.map_err(|e| e.to_string())?;

    let files = val["files"]
        .as_array()
        .map(|arr| {
            arr.iter().map(|f| serde_json::json!({
                "id": f["file_id"].to_string(),
                "name": f["name"],
                "version": f["version"],
                "category": f["category_name"],
                "description": f["description"],
                "sizeKb": f["size_kb"],
                "uploadedAt": f["uploaded_time"],
                "primary": f["is_primary"].as_bool().unwrap_or(false)
            })).collect::<Vec<_>>()
        })
        .unwrap_or_default();

    Ok(serde_json::json!({
        "files": files,
        "rateLimit": { "dailyRemaining": null, "hourlyRemaining": null }
    }))
}

#[command]
pub async fn nexus_select_game_directory(game_title: String, app: AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let path = app.dialog()
        .file()
        .set_title(format!("Select game folder for {game_title}"))
        .blocking_pick_folder();
    Ok(path.and_then(|p| p.into_path().ok()).map(|p| p.to_string_lossy().to_string()))
}

#[command]
pub async fn nexus_get_download_state() -> Result<Option<serde_json::Value>, String> {
    Ok(None)
}

#[command]
pub async fn nexus_list_downloaded_files(game_domain: String) -> Result<Vec<serde_json::Value>, String> {
    let dir = nexus_download_dir(&game_domain);
    if !dir.exists() {
        return Ok(vec![]);
    }

    let mut files = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if let Some(name) = path.file_name().map(|n| n.to_string_lossy().to_string()) {
                let size = path.metadata().map(|m| m.len()).unwrap_or(0);
                files.push(serde_json::json!({
                    "id": uuid::Uuid::new_v4().to_string(),
                    "gameDomain": game_domain,
                    "modId": "unknown",
                    "filename": name,
                    "filePath": path.to_string_lossy(),
                    "bytes": size,
                    "downloadedAt": 0
                }));
            }
        }
    }
    Ok(files)
}

#[command]
pub async fn nexus_open_download_location(game_domain: Option<String>, app: AppHandle) -> Result<bool, String> {
    use tauri_plugin_opener::OpenerExt;
    let domain = game_domain.unwrap_or_else(|| "unknown".to_string());
    let dir = nexus_download_dir(&domain);
    std::fs::create_dir_all(&dir).ok();
    app.opener()
        .open_path(dir.to_string_lossy().as_ref(), None::<String>)
        .map_err(|e| e.to_string())?;
    Ok(true)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn nexus_download_dir(game_domain: &str) -> PathBuf {
    dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("Pherielium")
        .join("nexus-downloads")
        .join(game_domain)
}
