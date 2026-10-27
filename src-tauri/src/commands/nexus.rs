//! Tauri commands: Nexus Mods API, download manager, credential store
//! Substitui electron/mods/*.cjs (11 arquivos, ~88 KB total)

use std::path::PathBuf;
use tauri::{command, AppHandle};

const NEXUS_API_BASE: &str = "https://api.nexusmods.com/v1";

// ── Credential store (keyring) ────────────────────────────────────────────────

const KEYRING_SERVICE: &str = "pherielium-nexus";
const KEYRING_USER: &str = "api-key";

// A chave fica no cofre do sistema (Windows Credential Manager, protegido por DPAPI) e nunca
// no front-end. Não dá para guardar só um hash: a API da Nexus exige a chave original em cada
// requisição, e hash é irreversível. O cofre do SO é a forma correta de proteger um segredo
// que precisa ser reutilizado.
fn save_secret(service: &str, user: &str, secret: &str) -> anyhow::Result<()> {
    keyring::Entry::new(service, user)?.set_password(secret)?;
    Ok(())
}

fn load_secret(service: &str, user: &str) -> Option<String> {
    keyring::Entry::new(service, user)
        .ok()
        .and_then(|e| e.get_password().ok())
}

fn delete_secret(service: &str, user: &str) -> anyhow::Result<()> {
    keyring::Entry::new(service, user)?.delete_credential()?;
    Ok(())
}

fn save_nexus_key(key: &str) -> anyhow::Result<()> {
    save_secret(KEYRING_SERVICE, KEYRING_USER, key)
}

pub(crate) fn load_nexus_key() -> Option<String> {
    load_secret(KEYRING_SERVICE, KEYRING_USER)
}

fn delete_nexus_key() -> anyhow::Result<()> {
    delete_secret(KEYRING_SERVICE, KEYRING_USER)
}

// ── Nexus API client ─────────────────────────────────────────────────────────

/// Cliente único com timeout: sem ele uma rede travada deixava a conexão pendurada para sempre.
pub(crate) fn nexus_client() -> &'static reqwest::Client {
    static CLIENT: std::sync::OnceLock<reqwest::Client> = std::sync::OnceLock::new();
    CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(20))
            .user_agent("Pherielium/3.2.7")
            .build()
            .unwrap_or_default()
    })
}

/// Identificadores que entram em URL e em caminho de pasta (domínio do jogo).
/// Só `[a-z0-9_-]`: bloqueia `..`, barras e `?`, que permitiriam sair da pasta de downloads
/// ou redirecionar a requisição (com a chave do usuário) para outro endpoint da API.
pub(crate) fn validate_slug(value: &str, what: &str) -> Result<(), String> {
    let ok = !value.is_empty()
        && value.len() <= 80
        && value
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_' || c == '-');
    if ok {
        Ok(())
    } else {
        Err(format!("{what} inválido"))
    }
}

pub(crate) fn validate_numeric_id(value: &str, what: &str) -> Result<(), String> {
    if !value.is_empty() && value.len() <= 12 && value.chars().all(|c| c.is_ascii_digit()) {
        Ok(())
    } else {
        Err(format!("{what} inválido"))
    }
}

/// Limites restantes que a Nexus informa nos cabeçalhos (`null` quando ausentes).
fn rate_limit_from_headers(headers: &reqwest::header::HeaderMap) -> serde_json::Value {
    let read = |name: &str| {
        headers
            .get(name)
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.parse::<i64>().ok())
    };
    serde_json::json!({
        "dailyRemaining": read("x-rl-daily-remaining"),
        "hourlyRemaining": read("x-rl-hourly-remaining"),
    })
}

/// Traduz o status HTTP da Nexus em uma mensagem que o usuário consegue agir.
pub(crate) fn nexus_status_error(status: reqwest::StatusCode) -> String {
    match status.as_u16() {
        401 | 403 => "Chave de API inválida ou sem permissão. Gere uma nova em nexusmods.com.".to_string(),
        429 => "Limite de requisições da Nexus atingido. Tente de novo mais tarde.".to_string(),
        code if code >= 500 => format!("A Nexus está instável (erro {code}). Tente de novo em instantes."),
        code => format!("A Nexus recusou a requisição (erro {code})."),
    }
}

pub(crate) async fn nexus_get(
    endpoint: &str,
    api_key: &str,
) -> Result<(serde_json::Value, serde_json::Value), String> {
    let resp = nexus_client()
        .get(format!("{NEXUS_API_BASE}{endpoint}"))
        .header("apikey", api_key)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|_| "Sem conexão com a Nexus. Verifique sua internet.".to_string())?;

    let status = resp.status();
    let rate = rate_limit_from_headers(resp.headers());
    if !status.is_success() {
        return Err(nexus_status_error(status));
    }
    let val = resp
        .json()
        .await
        .map_err(|_| "Resposta inesperada da Nexus.".to_string())?;
    Ok((val, rate))
}

fn account_json(val: &serde_json::Value, rate: serde_json::Value) -> serde_json::Value {
    serde_json::json!({
        "userId": val["user_id"],
        "name": val["name"],
        "profileUrl": val["profile_url"],
        "isPremium": val["is_premium"],
        "isSupporter": val["is_supporter"],
        "rateLimit": rate
    })
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
    let api_key = api_key.trim().to_string();
    if api_key.is_empty() || api_key.len() > 512 {
        return Err("Informe a chave de API da Nexus.".to_string());
    }

    // Valida a chave antes de gravar; só então ela vai para o cofre do sistema
    let (val, rate) = nexus_get("/users/validate.json", &api_key).await?;
    save_nexus_key(&api_key)
        .map_err(|_| "Não foi possível salvar a chave no cofre do Windows.".to_string())?;

    Ok(serde_json::json!({
        "connected": true,
        "encryptionAvailable": true,
        "account": account_json(&val, rate)
    }))
}

#[command]
pub async fn nexus_validate_connection() -> Result<serde_json::Value, String> {
    let Some(key) = load_nexus_key() else {
        return Ok(serde_json::json!({ "connected": false, "encryptionAvailable": true, "account": null }));
    };

    // Chave recusada = desconectado; falha de rede não apaga a chave salva
    match nexus_get("/users/validate.json", &key).await {
        Ok((val, rate)) => Ok(serde_json::json!({
            "connected": true,
            "encryptionAvailable": true,
            "account": account_json(&val, rate)
        })),
        Err(_) => Ok(serde_json::json!({ "connected": false, "encryptionAvailable": true, "account": null })),
    }
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

    validate_slug(&game_domain, "Jogo")?;

    // A API v1 só entrega listas curtas (10 mods cada). Juntar as três dá até 30 mods por jogo
    // com 3 chamadas: "Em alta", "Atualizados" e "Novos". O que se repete entra uma vez só.
    let feeds = [
        ("trending", "Em alta"),
        ("latest_updated", "Atualizados"),
        ("latest_added", "Novos"),
    ];
    let endpoints = feeds.map(|(path, _)| format!("/games/{game_domain}/mods/{path}.json"));
    let (trending, updated, added) = tokio::join!(
        nexus_get(&endpoints[0], &key),
        nexus_get(&endpoints[1], &key),
        nexus_get(&endpoints[2], &key),
    );
    let responses = [trending, updated, added];

    let mut rate = serde_json::Value::Null;
    let mut seen = std::collections::HashSet::new();
    let mut mods = Vec::new();
    let mut first_error = None;
    for ((_, label), response) in feeds.iter().zip(responses) {
        let (val, feed_rate) = match response {
            Ok(ok) => ok,
            Err(error) => {
                first_error.get_or_insert(error);
                continue;
            }
        };
        rate = feed_rate;
        for m in val.as_array().into_iter().flatten() {
            if !seen.insert(m["mod_id"].to_string()) {
                continue;
            }
            mods.push(serde_json::json!({
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
                "feed": label
            }));
        }
    }
    // só vira erro se NENHUMA lista veio: uma lista a menos ainda é um catálogo útil
    if mods.is_empty() {
        if let Some(error) = first_error {
            return Err(error);
        }
    }

    Ok(serde_json::json!({
        "mods": mods,
        "scope": "curated-feeds",
        "recentCandidateCount": mods.len(),
        "rateLimit": rate
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
    validate_slug(&game_domain, "Jogo")?;
    validate_numeric_id(&mod_id, "Mod")?;
    let endpoint = format!("/games/{game_domain}/mods/{mod_id}.json");
    let (m, rate) = nexus_get(&endpoint, &key).await?;

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
        "rateLimit": rate
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
    validate_slug(&game_domain, "Jogo")?;
    validate_numeric_id(&mod_id, "Mod")?;
    let endpoint = format!("/games/{game_domain}/mods/{mod_id}/files.json");
    let (val, rate) = nexus_get(&endpoint, &key).await?;

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
        "rateLimit": rate
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
pub async fn nexus_list_downloaded_files(game_domain: String) -> Result<Vec<serde_json::Value>, String> {
    validate_slug(&game_domain, "Jogo")?;
    let dir = nexus_download_dir(&game_domain);
    if !dir.exists() {
        return Ok(vec![]);
    }

    let mut files = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if let Some(name) = path.file_name().map(|n| n.to_string_lossy().to_string()) {
                // downloads incompletos ainda não são arquivos de mod
                if name.ends_with(".part") {
                    continue;
                }
                let size = path.metadata().map(|m| m.len()).unwrap_or(0);
                // nome "<mod>-<arquivo>-<título>": dá o mod de origem; o resto (ids do CDN) segue "unknown"
                let parsed = super::nexus_download::parse_download_name(&name);
                let (mod_id, file_id, shown) = match &parsed {
                    Some((m, f, title)) => (m.clone(), f.clone(), title.clone()),
                    None => ("unknown".to_string(), String::new(), name.clone()),
                };
                files.push(serde_json::json!({
                    "id": if parsed.is_some() { format!("{game_domain}:{mod_id}") } else { format!("{game_domain}:file:{name}") },
                    "gameDomain": game_domain,
                    "modId": mod_id,
                    "fileId": file_id,
                    "filename": shown,
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
    validate_slug(&domain, "Jogo")?;
    let dir = nexus_download_dir(&domain);
    std::fs::create_dir_all(&dir).ok();
    app.opener()
        .open_path(dir.to_string_lossy().as_ref(), None::<String>)
        .map_err(|e| e.to_string())?;
    Ok(true)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

pub(crate) fn nexus_download_dir(game_domain: &str) -> PathBuf {
    dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("Pherielium")
        .join("nexus-downloads")
        .join(game_domain)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Regressão: sem a feature `windows-native` o keyring usa o repositório mock e a chave
    /// gravada nunca podia ser lida de volta (a conexão com a Nexus parecia não salvar).
    #[test]
    fn slug_rejects_path_traversal_and_url_injection() {
        let too_long = "a".repeat(81);
        for bad in ["", "..", "../x", "a/b", "a\\b", "x?apikey=1", "Skyrim", "a b", too_long.as_str()] {
            assert!(validate_slug(bad, "Jogo").is_err(), "deveria recusar {bad:?}");
        }
        assert!(validate_slug("skyrimspecialedition", "Jogo").is_ok());
        assert!(validate_slug("cyberpunk2077", "Jogo").is_ok());
    }

    #[test]
    fn mod_id_accepts_only_digits() {
        assert!(validate_numeric_id("12345", "Mod").is_ok());
        for bad in ["", "12a", "../1", "1/2", "1234567890123"] {
            assert!(validate_numeric_id(bad, "Mod").is_err(), "deveria recusar {bad:?}");
        }
    }

    #[test]
    #[cfg(target_os = "windows")]
    fn secret_survives_a_fresh_entry() {
        let service = "pherielium-test-keyring-roundtrip";
        let user = "nexus-test";
        save_secret(service, user, "segredo-de-teste").expect("gravar");
        assert_eq!(load_secret(service, user).as_deref(), Some("segredo-de-teste"));
        delete_secret(service, user).expect("apagar");
        assert_eq!(load_secret(service, user), None);
    }
}
