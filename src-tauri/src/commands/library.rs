//! Tauri commands: local game library
//! Maps 1-to-1 with the electronAPI surface exposed in preload.cjs

use crate::store::game_library::{self, Game, GameSession};
use serde_json::Value;
use tauri::command;

#[command]
pub async fn library_list(uid: String) -> Result<Vec<Game>, String> {
    game_library::list_games(&uid).map_err(|e| e.to_string())
}

#[command]
pub async fn library_create(uid: String, game: Value) -> Result<Game, String> {
    let parsed: Game = serde_json::from_value(game)
        .map_err(|e| format!("Erro ao processar dados do jogo: {e}"))?;
    game_library::create_game(&uid, parsed).map_err(|e| e.to_string())
}

#[command]
pub async fn library_update(uid: String, game_id: String, patch: Value) -> Result<Game, String> {
    game_library::update_game(&uid, &game_id, patch).map_err(|e| e.to_string())
}

#[command]
pub async fn library_delete(uid: String, game_id: String) -> Result<bool, String> {
    game_library::delete_game(&uid, &game_id).map_err(|e| e.to_string())
}

#[command]
pub async fn library_delete_by_launcher(uid: String, launcher_type: String) -> Result<i64, String> {
    game_library::delete_games_by_launcher(&uid, &launcher_type).map_err(|e| e.to_string())
}

#[command]
pub async fn library_bulk_upsert(uid: String, games: Vec<Value>) -> Result<Vec<Game>, String> {
    let parsed: Vec<Game> = games
        .into_iter()
        .filter_map(|v| serde_json::from_value(v).ok())
        .collect();
    game_library::bulk_upsert(&uid, parsed).map_err(|e| e.to_string())
}

#[command]
pub async fn library_record_session(
    uid: String,
    game_id: String,
    session: GameSession,
) -> Result<String, String> {
    game_library::record_session(&uid, &game_id, session).map_err(|e| e.to_string())
}

#[command]
pub async fn library_get_summary(uid: String) -> Result<game_library::LibrarySummary, String> {
    game_library::get_summary(&uid).map_err(|e| e.to_string())
}

#[command]
pub async fn library_needs_legacy_import(uid: String) -> Result<bool, String> {
    game_library::needs_legacy_import(&uid).map_err(|e| e.to_string())
}

#[command]
pub async fn library_import_legacy(
    uid: String,
    games: Vec<Game>,
) -> Result<Value, String> {
    // Check if already imported
    if !game_library::needs_legacy_import(&uid).unwrap_or(true) {
        return Ok(serde_json::json!({ "imported": 0, "alreadyImported": true }));
    }
    let count = games.len();
    game_library::bulk_upsert(&uid, games).map_err(|e| e.to_string())?;
    game_library::mark_legacy_imported(&uid).map_err(|e| e.to_string())?;
    Ok(serde_json::json!({ "imported": count, "alreadyImported": false }))
}

#[command]
pub async fn library_mark_summary_synced(uid: String, revision: i64) -> Result<(), String> {
    game_library::mark_summary_synced(&uid, revision).map_err(|e| e.to_string())
}

#[command]
pub async fn library_clear_steam_id(uid: String) -> Result<(), String> {
    game_library::clear_steam_id(&uid).map_err(|e| e.to_string())
}

#[command]
pub async fn steam_fetch_public_library(steam_id: String) -> Result<Value, String> {
    let api_key = "72378BD4970B2C903ABFD0C0292A38BF";
    let url = format!(
        "https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key={}&steamid={}&include_appinfo=1&include_played_free_games=1&format=json",
        api_key,
        steam_id.trim()
    );
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| format!("Falha ao inicializar HTTP client: {e}"))?;

    let res = client
        .get(&url)
        .header("User-Agent", "Pherielium/3.2.7")
        .send()
        .await
        .map_err(|e| format!("Falha na requisição Steam: {e}"))?;

    let json: Value = res
        .json()
        .await
        .map_err(|e| format!("Falha ao decodificar JSON da Steam: {e}"))?;

    Ok(json)
}

#[command]
pub async fn steam_search_store(query: String) -> Result<Vec<Value>, String> {
    let q = query.trim();
    if q.is_empty() {
        return Ok(vec![]);
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(6))
        .build()
        .map_err(|e| format!("Falha ao inicializar HTTP client: {e}"))?;

    let mut results: Vec<Value> = Vec::new();
    let mut seen_ids = std::collections::HashSet::new();

    // 1. Se for puramente numérico (Steam App ID direto, ex: 1593500 ou 730)
    if q.chars().all(|c| c.is_ascii_digit()) && q.len() >= 2 {
        let appid = q;
        let details_url = format!("https://store.steampowered.com/api/appdetails?appids={appid}&l=brazilian");
        if let Ok(res) = client.get(&details_url).send().await {
            if let Ok(json) = res.json::<Value>().await {
                if let Some(app_data) = json.get(appid).and_then(|v| v.get("data")) {
                    let name = app_data.get("name").and_then(|v| v.as_str()).unwrap_or(appid);
                    let header_img = app_data
                        .get("header_image")
                        .and_then(|v| v.as_str())
                        .unwrap_or("");
                    seen_ids.insert(appid.to_string());
                    results.push(serde_json::json!({
                        "id": appid,
                        "appid": appid,
                        "name": name,
                        "title": name,
                        "tiny_image": if !header_img.is_empty() {
                            header_img.to_string()
                        } else {
                            format!("https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/{appid}/capsule_231x87.jpg")
                        },
                        "type": "app"
                    }));
                }
            }
        }
    }

    // 2. Busca via Steam SearchApps (rápido, direto da Steam Community)
    let clean_q = q.replace(|c: char| !c.is_alphanumeric() && c != ' ', "");
    let search_url = format!(
        "https://steamcommunity.com/actions/SearchApps/{}",
        clean_q.replace(' ', "%20")
    );

    if let Ok(res) = client.get(&search_url).header("User-Agent", "Pherielium/3.2.7").send().await {
        if let Ok(items) = res.json::<Vec<Value>>().await {
            for item in items.into_iter().take(15) {
                let appid = item.get("appid").and_then(|v| v.as_str()).unwrap_or("").trim().to_string();
                let name = item.get("name").and_then(|v| v.as_str()).unwrap_or("").trim().to_string();
                if appid.is_empty() || name.is_empty() {
                    continue;
                }
                if seen_ids.insert(appid.clone()) {
                    let logo = item.get("logo").and_then(|v| v.as_str()).unwrap_or("");
                    let icon = item.get("icon").and_then(|v| v.as_str()).unwrap_or("");
                    let img = if !logo.is_empty() {
                        logo.to_string()
                    } else if !icon.is_empty() {
                        icon.to_string()
                    } else {
                        format!("https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/{appid}/capsule_231x87.jpg")
                    };

                    results.push(serde_json::json!({
                        "id": appid,
                        "appid": appid,
                        "name": name,
                        "title": name,
                        "tiny_image": img,
                        "type": "app"
                    }));
                }
            }
        }
    }

    Ok(results)
}

#[command]
pub async fn steam_fetch_player_achievements_batch(
    steam_id: String,
    app_ids: Vec<String>,
) -> Result<Value, String> {
    let api_key = "72378BD4970B2C903ABFD0C0292A38BF";
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| format!("Falha ao inicializar HTTP client: {e}"))?;

    let clean_steam_id = steam_id.trim().to_string();
    let semaphore = std::sync::Arc::new(tokio::sync::Semaphore::new(8));
    let mut tasks = Vec::new();

    for app_id in app_ids {
        let client = client.clone();
        let s_id = clean_steam_id.clone();
        let app = app_id.trim().to_string();
        let sem = semaphore.clone();

        tasks.push(tokio::spawn(async move {
            let _permit = sem.acquire().await.ok()?;
            let url = format!(
                "https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v0001/?appid={}&key={}&steamid={}",
                app, api_key, s_id
            );
            let res = client
                .get(&url)
                .header("User-Agent", "Pherielium/3.2.7")
                .send()
                .await
                .ok()?;
            let json: Value = res.json().await.ok()?;
            let playerstats = json.get("playerstats")?;
            if playerstats.get("success").and_then(|v| v.as_bool()).unwrap_or(false) {
                if let Some(achs) = playerstats.get("achievements").and_then(|v| v.as_array()) {
                    let total = achs.len() as u32;
                    let unlocked = achs
                        .iter()
                        .filter(|a| a.get("achieved").and_then(|v| v.as_u64()) == Some(1))
                        .count() as u32;
                    return Some((app, total, unlocked));
                }
            }
            None
        }));
    }

    let mut map = serde_json::Map::new();
    for task in tasks {
        if let Ok(Some((app, total, unlocked))) = task.await {
            map.insert(
                app,
                serde_json::json!({
                    "total": total,
                    "unlocked": unlocked
                }),
            );
        }
    }

    Ok(Value::Object(map))
}

#[command]
pub async fn steam_fetch_app_details(
    app_id: String,
    language: Option<String>,
) -> Result<Value, String> {
    let clean_id = app_id.trim();
    if clean_id.is_empty() {
        return Err("App ID inválido".into());
    }

    let lang = match language.as_deref().unwrap_or("pt-BR") {
        "pt-BR" => "brazilian",
        "es-ES" => "spanish",
        "fr-FR" => "french",
        "de-DE" => "german",
        "it-IT" => "italian",
        _ => "english",
    };

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(8))
        .build()
        .map_err(|e| format!("Falha ao inicializar HTTP client: {e}"))?;

    let url = format!(
        "https://store.steampowered.com/api/appdetails?appids={clean_id}&l={lang}"
    );

    let res = client
        .get(&url)
        .header("User-Agent", "Pherielium/3.2.7")
        .send()
        .await
        .map_err(|e| format!("Falha ao conectar à loja Steam: {e}"))?;

    let json: Value = res
        .json()
        .await
        .map_err(|e| format!("Falha ao processar resposta da Steam: {e}"))?;

    // Trata tanto a chave sendo clean_id quanto redirecionamento de appid (ex: CS 730 -> 2678630)
    let app_obj = json
        .get(clean_id)
        .or_else(|| json.as_object().and_then(|m| m.values().next()))
        .ok_or_else(|| "Nenhum dado retornado para este app".to_string())?;

    let success = app_obj
        .get("success")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    if !success {
        return Err("Jogo não encontrado na loja Steam".into());
    }

    let data = app_obj
        .get("data")
        .ok_or_else(|| "Campo data ausente na resposta da Steam".to_string())?;

    let title = data.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let desc = data.get("short_description").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let about = data.get("detailed_description")
        .or_else(|| data.get("about_the_game"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    let mut developers: Vec<String> = Vec::new();
    if let Some(devs) = data.get("developers").and_then(|v| v.as_array()) {
        for d in devs {
            if let Some(s) = d.as_str() {
                developers.push(s.to_string());
            }
        }
    }

    let mut publishers: Vec<String> = Vec::new();
    if let Some(pubs) = data.get("publishers").and_then(|v| v.as_array()) {
        for p in pubs {
            if let Some(s) = p.as_str() {
                publishers.push(s.to_string());
            }
        }
    }

    let release_date = data.pointer("/release_date/date")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    let mut tags: Vec<String> = Vec::new();
    if let Some(genres) = data.get("genres").and_then(|v| v.as_array()) {
        for g in genres {
            if let Some(desc_val) = g.get("description").and_then(|v| v.as_str()) {
                tags.push(desc_val.to_string());
            }
        }
    }
    if let Some(cats) = data.get("categories").and_then(|v| v.as_array()) {
        for c in cats {
            if let Some(desc_val) = c.get("description").and_then(|v| v.as_str()) {
                if !tags.contains(&desc_val.to_string()) {
                    tags.push(desc_val.to_string());
                }
            }
        }
    }

    let mut screenshots: Vec<String> = Vec::new();
    if let Some(shots) = data.get("screenshots").and_then(|v| v.as_array()) {
        for s in shots {
            if let Some(p) = s.get("path_full").and_then(|v| v.as_str()) {
                screenshots.push(p.to_string());
            }
        }
    }

    let mut trailer_url = String::new();
    let mut trailer_thumb = String::new();
    if let Some(movies) = data.get("movies").and_then(|v| v.as_array()) {
        if let Some(first_movie) = movies.first() {
            if let Some(mp4) = first_movie.pointer("/mp4/max").and_then(|v| v.as_str()) {
                trailer_url = mp4.to_string();
            } else if let Some(webm) = first_movie.pointer("/webm/max").and_then(|v| v.as_str()) {
                trailer_url = webm.to_string();
            }
            if let Some(th) = first_movie.get("thumbnail").and_then(|v| v.as_str()) {
                trailer_thumb = th.to_string();
            }
        }
    }

    let card_image = format!("https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/{clean_id}/library_600x900_2x.jpg");
    let background_image = format!("https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/{clean_id}/library_hero.jpg");
    let logo_image = format!("https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/{clean_id}/logo.png");
    let header_image = data.get("header_image").and_then(|v| v.as_str()).unwrap_or("").to_string();

    Ok(serde_json::json!({
        "appId": clean_id,
        "title": title,
        "description": desc,
        "aboutTheGame": about,
        "developer": developers.first().cloned().unwrap_or_default(),
        "publisher": publishers.first().cloned().unwrap_or_default(),
        "releaseDate": release_date,
        "cardImage": card_image,
        "backgroundImage": background_image,
        "logoImage": logo_image,
        "headerImage": header_image,
        "tags": tags,
        "screenshots": screenshots,
        "trailerUrl": trailer_url,
        "trailerThumbnail": trailer_thumb,
        "pcRequirements": data.get("pc_requirements"),
        "supportedLanguages": data.get("supported_languages"),
        "metacritic": data.get("metacritic"),
        "priceOverview": data.get("price_overview"),
    }))
}

