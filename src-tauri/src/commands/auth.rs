//! Tauri commands: Authentication
//! Substitui os handlers de auth do electron/main.cjs (~150 linhas)
//! Executa as chamadas HTTP nativamente no Rust para evitar qualquer bloqueio de CORS no Webview.

#![allow(dead_code)]

use serde::{Deserialize, Serialize};
use tauri::{command, AppHandle};
use tauri_plugin_opener::OpenerExt;

const PROD_BACKEND_URL: &str = "https://checkpoint-launcher.onrender.com";

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GoogleAuthStartResult {
    pub state: String,
    pub poll_secret: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LinkedAccountResult {
    pub ok: bool,
    pub url: Option<String>,
}

#[command]
pub async fn auth_start_google_browser(
    app: AppHandle,
    backend_url: Option<String>,
) -> Result<GoogleAuthStartResult, String> {
    let base = backend_url
        .filter(|u| !u.is_empty() && !u.contains("localhost") && !u.contains("127.0.0.1"))
        .unwrap_or_else(|| PROD_BACKEND_URL.to_string());
    let endpoint = format!("{}/auth/desktop/google/start", base.trim_end_matches('/'));

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(35))
        .build()
        .map_err(|e| e.to_string())?;

    let res = client
        .post(&endpoint)
        .header("Content-Type", "application/json")
        .body("{}")
        .send()
        .await
        .map_err(|e| format!("Falha ao conectar com o servidor: {e}"))?;

    if !res.status().is_success() {
        return Err(format!("O backend retornou status HTTP {}", res.status()));
    }

    let payload: serde_json::Value = res
        .json()
        .await
        .map_err(|e| format!("Falha ao decodificar resposta: {e}"))?;

    let state = payload
        .get("state")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let poll_secret = payload
        .get("pollSecret")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let auth_url = payload
        .get("url")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    if state.is_empty() || poll_secret.is_empty() || auth_url.is_empty() {
        return Err("O backend retornou uma sessão Google incompleta.".into());
    }

    // Abre o navegador padrão do Windows sem restrições de CORS
    let _ = app.opener().open_url(&auth_url, None::<String>);

    Ok(GoogleAuthStartResult {
        state,
        poll_secret,
    })
}

#[command]
pub async fn auth_poll_google_status(
    state: String,
    poll_secret: String,
    backend_url: Option<String>,
) -> Result<serde_json::Value, String> {
    let base = backend_url
        .filter(|u| !u.is_empty() && !u.contains("localhost") && !u.contains("127.0.0.1"))
        .unwrap_or_else(|| PROD_BACKEND_URL.to_string());

    let endpoint = format!("{}/auth/desktop/google/status", base.trim_end_matches('/'));

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(12))
        .build()
        .map_err(|e| e.to_string())?;

    let res = match client
        .get(&endpoint)
        .query(&[("state", &state), ("pollSecret", &poll_secret)])
        .send()
        .await
    {
        Ok(r) => r,
        Err(_) => return Ok(serde_json::json!({ "status": "pending" })),
    };

    if !res.status().is_success() {
        if res.status().as_u16() >= 400 && res.status().as_u16() < 500 {
            return Ok(serde_json::json!({
                "status": "error",
                "error": format!("Falha ao consultar login Google (HTTP {})", res.status())
            }));
        }
        return Ok(serde_json::json!({ "status": "pending" }));
    }

    let payload: serde_json::Value = res
        .json()
        .await
        .unwrap_or_else(|_| serde_json::json!({ "status": "pending" }));

    Ok(payload)
}

#[command]
pub async fn auth_start_linked_account_browser(
    app: AppHandle,
    provider: String,
    access_token: String,
    open_browser: Option<bool>,
    backend_url: Option<String>,
) -> Result<LinkedAccountResult, String> {
    let base = backend_url
        .filter(|u| !u.is_empty() && !u.contains("localhost") && !u.contains("127.0.0.1"))
        .unwrap_or_else(|| PROD_BACKEND_URL.to_string());

    let pathname = if provider.eq_ignore_ascii_case("steam") {
        "/auth/steam/start"
    } else {
        "/auth/discord/start"
    };

    let endpoint = format!("{}{}", base.trim_end_matches('/'), pathname);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(35))
        .build()
        .map_err(|e| e.to_string())?;

    let res = client
        .post(&endpoint)
        .header("Authorization", format!("Bearer {access_token}"))
        .header("Content-Type", "application/json")
        .body("{}")
        .send()
        .await
        .map_err(|e| format!("Falha ao iniciar vinculação {provider}: {e}"))?;

    let payload: serde_json::Value = res
        .json()
        .await
        .map_err(|e| format!("Resposta inválida do backend: {e}"))?;

    let url = payload
        .get("url")
        .and_then(|v| v.as_str())
        .map(ToString::to_string);

    if open_browser.unwrap_or(true) {
        if let Some(ref u) = url {
            let _ = app.opener().open_url(u, None::<String>);
        }
    }

    Ok(LinkedAccountResult {
        ok: true,
        url,
    })
}
