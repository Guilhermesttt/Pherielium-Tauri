//! Local game library — SQLite-backed persistence
//!
//! Substitui electron/games/local-game-library.cjs (~17 KB)

use anyhow::Result;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use uuid::Uuid;

// ── Domain types ──────────────────────────────────────────────────────────────

fn deserialize_flexible_i64<'de, D>(deserializer: D) -> Result<i64, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let v = serde_json::Value::deserialize(deserializer)?;
    match v {
        serde_json::Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                Ok(i)
            } else if let Some(f) = n.as_f64() {
                Ok(f.round() as i64)
            } else {
                Ok(0)
            }
        }
        serde_json::Value::String(s) => {
            Ok(s.parse::<f64>().map(|f| f.round() as i64).unwrap_or(0))
        }
        serde_json::Value::Null => Ok(0),
        _ => Ok(0),
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Game {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub uid: String,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub image_url: Option<String>,
    #[serde(default)]
    pub image: Option<String>,
    #[serde(default)]
    pub card_image: Option<String>,
    #[serde(default)]
    pub executable_path: Option<String>,
    #[serde(default)]
    pub launcher_type: String,
    #[serde(default)]
    pub steam_app_id: Option<String>,
    #[serde(default)]
    pub epic_catalog_id: Option<String>,
    #[serde(default)]
    pub epic_launch_id: Option<String>,
    #[serde(default, deserialize_with = "deserialize_flexible_i64")]
    pub total_playtime_minutes: i64,
    #[serde(default, deserialize_with = "deserialize_flexible_i64")]
    pub steam_playtime_minutes: i64,
    #[serde(default)]
    pub last_played_at: Option<String>,
    #[serde(default)]
    pub is_favorite: bool,
    #[serde(default, deserialize_with = "deserialize_flexible_i64")]
    pub sort_order: i64,
    #[serde(default)]
    pub created_at: String,
    #[serde(default)]
    pub updated_at: String,
    // Extra metadata stored as JSON string
    #[serde(default)]
    pub metadata: Option<serde_json::Value>,
    #[serde(flatten, default)]
    pub extra: serde_json::Map<String, serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameSession {
    pub started_at: String,
    pub ended_at: String,
    pub duration_minutes: i64,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LibrarySummary {
    pub schema_version: i32,
    pub stats: LibraryStats,
    pub platforms: PlatformStats,
    pub achievements: AchievementStats,
    pub top_games: Vec<TopGame>,
    pub favorite_games: Vec<TopGame>,
    pub revision: i64,
    pub device_id: String,
    pub dirty: bool,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryStats {
    pub games: i64,
    pub minutes_played: i64,
    pub favorites: i64,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlatformStats {
    pub steam_game_count: i64,
    pub epic_game_count: i64,
    pub local_game_count: i64,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AchievementStats {
    pub unlocked: i64,
    pub total: i64,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TopGame {
    pub id: String,
    pub title: String,
    pub minutes_played: i64,
    pub image_url: String,
}

// ── Database path ─────────────────────────────────────────────────────────────

pub fn db_path(uid: &str) -> PathBuf {
    let base = dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("Pherielium")
        .join("users")
        .join(uid);
    std::fs::create_dir_all(&base).ok();
    base.join("library.db")
}

// ── Connection + migrations ───────────────────────────────────────────────────

pub fn open(uid: &str) -> Result<Connection> {
    let conn = Connection::open(db_path(uid))?;
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;
    migrate(&conn)?;
    Ok(conn)
}

fn migrate(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS games (
            id                  TEXT PRIMARY KEY,
            uid                 TEXT NOT NULL,
            title               TEXT NOT NULL,
            image_url           TEXT,
            executable_path     TEXT,
            launcher_type       TEXT NOT NULL DEFAULT 'local',
            steam_app_id        TEXT,
            epic_catalog_id     TEXT,
            epic_launch_id      TEXT,
            total_playtime_minutes INTEGER NOT NULL DEFAULT 0,
            last_played_at      TEXT,
            is_favorite         INTEGER NOT NULL DEFAULT 0,
            sort_order          INTEGER NOT NULL DEFAULT 0,
            created_at          TEXT NOT NULL,
            updated_at          TEXT NOT NULL,
            metadata            TEXT
        );

        CREATE TABLE IF NOT EXISTS sessions (
            id          TEXT PRIMARY KEY,
            uid         TEXT NOT NULL,
            game_id     TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
            started_at  TEXT NOT NULL,
            ended_at    TEXT NOT NULL,
            duration_minutes INTEGER NOT NULL,
            created_at  TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS library_meta (
            key     TEXT PRIMARY KEY,
            value   TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_games_uid ON games(uid);
        CREATE INDEX IF NOT EXISTS idx_sessions_game_id ON sessions(game_id);
        ",
    )?;
    Ok(())
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

pub fn list_games(uid: &str) -> Result<Vec<Game>> {
    let conn = open(uid)?;
    let mut stmt = conn.prepare(
        "SELECT id, uid, title, image_url, executable_path, launcher_type,
                steam_app_id, epic_catalog_id, epic_launch_id,
                total_playtime_minutes, last_played_at, is_favorite,
                sort_order, created_at, updated_at, metadata
         FROM games WHERE uid = ?1 ORDER BY sort_order ASC, title ASC",
    )?;
    let games = stmt
        .query_map(params![uid], |row| {
            let metadata_str: Option<String> = row.get(15)?;
            let img: Option<String> = row.get(3)?;
            let total_playtime: i64 = row
                .get::<_, i64>(9)
                .or_else(|_| row.get::<_, f64>(9).map(|f| f.round() as i64))
                .unwrap_or(0);
            let metadata_val: Option<serde_json::Value> = metadata_str
                .and_then(|s| serde_json::from_str(&s).ok());

            let mut extra = match metadata_val.clone() {
                Some(serde_json::Value::Object(map)) => map,
                _ => serde_json::Map::new(),
            };

            // Ensure frontend image compatibility
            if !extra.contains_key("image") {
                if let Some(ref url) = img {
                    extra.insert("image".to_string(), serde_json::json!(url));
                }
            }
            if !extra.contains_key("cardImage") {
                if let Some(ref url) = img {
                    extra.insert("cardImage".to_string(), serde_json::json!(url));
                }
            }
            if !extra.contains_key("hoursPlayed") {
                extra.insert("hoursPlayed".to_string(), serde_json::json!(total_playtime / 60));
            }
            if !extra.contains_key("steamPlaytimeMinutes") {
                extra.insert("steamPlaytimeMinutes".to_string(), serde_json::json!(total_playtime));
            }

            let sort_order: i64 = row
                .get::<_, i64>(12)
                .or_else(|_| row.get::<_, f64>(12).map(|f| f.round() as i64))
                .unwrap_or(0);

            Ok(Game {
                id: row.get(0)?,
                uid: row.get(1)?,
                title: row.get(2)?,
                image_url: img.clone(),
                image: img.clone(),
                card_image: img,
                executable_path: row.get(4)?,
                launcher_type: row.get::<_, Option<String>>(5)?.unwrap_or_default(),
                steam_app_id: row.get(6)?,
                epic_catalog_id: row.get(7)?,
                epic_launch_id: row.get(8)?,
                total_playtime_minutes: total_playtime,
                steam_playtime_minutes: total_playtime,
                last_played_at: row.get(10)?,
                is_favorite: row.get::<_, i64>(11)? != 0,
                sort_order,
                created_at: row.get(13)?,
                updated_at: row.get(14)?,
                metadata: metadata_val,
                extra,
            })
        })?
        .filter_map(|r| r.ok())
        .collect();
    Ok(games)
}

pub fn create_game(uid: &str, mut game: Game) -> Result<Game> {
    let conn = open(uid)?;
    if game.id.is_empty() {
        game.id = Uuid::new_v4().to_string();
    }
    let now = chrono_now();
    if game.created_at.is_empty() {
        game.created_at = now.clone();
    }
    game.updated_at = now;
    game.uid = uid.to_string();

    if game.image_url.is_none() {
        game.image_url = game.image.clone()
            .or_else(|| game.card_image.clone())
            .or_else(|| game.extra.get("image").and_then(|v| v.as_str()).map(String::from))
            .or_else(|| game.extra.get("cardImage").and_then(|v| v.as_str()).map(String::from));
    }

    if game.total_playtime_minutes == 0 && game.steam_playtime_minutes > 0 {
        game.total_playtime_minutes = game.steam_playtime_minutes;
    }

    if let Some(ref img) = game.image_url {
        game.extra.entry("image").or_insert_with(|| serde_json::json!(img));
        game.extra.entry("cardImage").or_insert_with(|| serde_json::json!(img));
    }

    // Merge extra fields into metadata
    let metadata_obj = match game.metadata.take() {
        Some(serde_json::Value::Object(mut map)) => {
            for (k, v) in &game.extra {
                map.insert(k.clone(), v.clone());
            }
            serde_json::Value::Object(map)
        }
        _ => serde_json::Value::Object(game.extra.clone()),
    };

    let metadata_str = serde_json::to_string(&metadata_obj).ok();
    game.metadata = Some(metadata_obj);

    conn.execute(
        "INSERT INTO games
         (id, uid, title, image_url, executable_path, launcher_type,
          steam_app_id, epic_catalog_id, epic_launch_id,
          total_playtime_minutes, last_played_at, is_favorite,
          sort_order, created_at, updated_at, metadata)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16)
         ON CONFLICT(id) DO UPDATE SET
           title = excluded.title,
           image_url = excluded.image_url,
           executable_path = excluded.executable_path,
           launcher_type = excluded.launcher_type,
           steam_app_id = excluded.steam_app_id,
           epic_catalog_id = excluded.epic_catalog_id,
           epic_launch_id = excluded.epic_launch_id,
           total_playtime_minutes = MAX(games.total_playtime_minutes, excluded.total_playtime_minutes),
           last_played_at = COALESCE(excluded.last_played_at, games.last_played_at),
           is_favorite = games.is_favorite,
           sort_order = excluded.sort_order,
           updated_at = excluded.updated_at,
           metadata = excluded.metadata",
        params![
            game.id, game.uid, game.title, game.image_url, game.executable_path,
            game.launcher_type, game.steam_app_id, game.epic_catalog_id,
            game.epic_launch_id, game.total_playtime_minutes, game.last_played_at,
            game.is_favorite as i64, game.sort_order, game.created_at, game.updated_at,
            metadata_str
        ],
    )?;
    Ok(game)
}

pub fn update_game(uid: &str, game_id: &str, patch: serde_json::Value) -> Result<Game> {
    let conn = open(uid)?;
    let now = chrono_now();

    // Build SET clauses dynamically from the JSON patch
    let obj = patch.as_object().ok_or_else(|| anyhow::anyhow!("patch must be object"))?;
    let mut sets = vec!["updated_at = ?1".to_string()];
    let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(now.clone())];

    let field_map = [
        ("title", "title"),
        ("imageUrl", "image_url"),
        ("image", "image_url"),
        ("cardImage", "image_url"),
        ("executablePath", "executable_path"),
        ("launcherType", "launcher_type"),
        ("steamAppId", "steam_app_id"),
        ("epicCatalogId", "epic_catalog_id"),
        ("epicLaunchId", "epic_launch_id"),
        ("totalPlaytimeMinutes", "total_playtime_minutes"),
        ("steamPlaytimeMinutes", "total_playtime_minutes"),
        ("hoursPlayed", "total_playtime_minutes"),
        ("lastPlayedAt", "last_played_at"),
        ("isFavorite", "is_favorite"),
        ("sortOrder", "sort_order"),
    ];

    let mut idx = 2usize;
    let mut seen_cols = std::collections::HashSet::new();
    for (json_key, col) in &field_map {
        if seen_cols.contains(col) {
            continue;
        }
        if let Some(val) = obj.get(*json_key) {
            seen_cols.insert(*col);
            sets.push(format!("{col} = ?{idx}"));
            if *json_key == "hoursPlayed" && *col == "total_playtime_minutes" {
                let minutes = match val {
                    serde_json::Value::Number(n) => (n.as_f64().unwrap_or(0.0) * 60.0).round() as i64,
                    _ => 0,
                };
                params_vec.push(Box::new(minutes));
            } else {
                match val {
                    serde_json::Value::String(s) => params_vec.push(Box::new(s.clone())),
                    serde_json::Value::Number(n) => {
                        if *col == "total_playtime_minutes" || *col == "sort_order" {
                            let int_val = n.as_i64().unwrap_or_else(|| n.as_f64().map(|f| f.round() as i64).unwrap_or(0));
                            params_vec.push(Box::new(int_val));
                        } else if let Some(i) = n.as_i64() {
                            params_vec.push(Box::new(i));
                        } else {
                            params_vec.push(Box::new(n.as_f64().unwrap_or(0.0)));
                        }
                    }
                    serde_json::Value::Bool(b) => params_vec.push(Box::new(*b as i64)),
                    serde_json::Value::Null => params_vec.push(Box::new(rusqlite::types::Null)),
                    _ => params_vec.push(Box::new(serde_json::to_string(val).unwrap_or_default())),
                }
            }
            idx += 1;
        }
    }

    // Read existing metadata to merge extra fields
    let existing_meta_str: Option<String> = conn
        .query_row(
            "SELECT metadata FROM games WHERE id = ?1 AND uid = ?2",
            params![game_id, uid],
            |row| row.get(0),
        )
        .ok()
        .flatten();

    let mut meta_map = existing_meta_str
        .and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok())
        .and_then(|v| match v {
            serde_json::Value::Object(m) => Some(m),
            _ => None,
        })
        .unwrap_or_default();

    for (k, v) in obj {
        meta_map.insert(k.clone(), v.clone());
    }

    if let Ok(new_meta_json) = serde_json::to_string(&serde_json::Value::Object(meta_map)) {
        sets.push(format!("metadata = ?{idx}"));
        params_vec.push(Box::new(new_meta_json));
        idx += 1;
    }

    let sql = format!(
        "UPDATE games SET {} WHERE id = ?{} AND uid = ?{}",
        sets.join(", "), idx, idx + 1
    );
    params_vec.push(Box::new(game_id.to_string()));
    params_vec.push(Box::new(uid.to_string()));

    let params_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();
    conn.execute(&sql, params_refs.as_slice())?;

    // Return updated game
    let games = list_games(uid)?;
    games
        .into_iter()
        .find(|g| g.id == game_id)
        .ok_or_else(|| anyhow::anyhow!("Game not found after update"))
}

pub fn delete_game(uid: &str, game_id: &str) -> Result<bool> {
    let conn = open(uid)?;
    let rows = conn.execute(
        "DELETE FROM games WHERE id = ?1 AND uid = ?2",
        params![game_id, uid],
    )?;
    Ok(rows > 0)
}

pub fn delete_games_by_launcher(uid: &str, launcher_type: &str) -> Result<i64> {
    let conn = open(uid)?;
    let rows = if launcher_type.eq_ignore_ascii_case("epic") {
        conn.execute(
            "DELETE FROM games WHERE uid = ?1 AND (launcher_type = 'epic' OR epic_catalog_id IS NOT NULL OR epic_launch_id IS NOT NULL)",
            params![uid],
        )?
    } else if launcher_type.eq_ignore_ascii_case("steam") {
        conn.execute(
            "DELETE FROM games WHERE uid = ?1 AND (launcher_type = 'steam' OR steam_app_id IS NOT NULL)",
            params![uid],
        )?
    } else {
        conn.execute(
            "DELETE FROM games WHERE uid = ?1 AND launcher_type = ?2",
            params![uid, launcher_type],
        )?
    };
    Ok(rows as i64)
}

pub fn bulk_upsert(uid: &str, games: Vec<Game>) -> Result<Vec<Game>> {
    let conn = open(uid)?;
    let now = chrono_now();
    let tx = conn;

    let mut result = Vec::new();
    for mut g in games {
        if g.id.is_empty() {
            g.id = Uuid::new_v4().to_string();
        }
        if g.created_at.is_empty() {
            g.created_at = now.clone();
        }
        g.updated_at = now.clone();
        g.uid = uid.to_string();

        if g.image_url.is_none() {
            g.image_url = g.image.clone()
                .or_else(|| g.card_image.clone())
                .or_else(|| g.extra.get("image").and_then(|v| v.as_str()).map(String::from))
                .or_else(|| g.extra.get("cardImage").and_then(|v| v.as_str()).map(String::from));
        }

        if g.total_playtime_minutes == 0 && g.steam_playtime_minutes > 0 {
            g.total_playtime_minutes = g.steam_playtime_minutes;
        }

        if let Some(ref img) = g.image_url {
            g.extra.entry("image").or_insert_with(|| serde_json::json!(img));
            g.extra.entry("cardImage").or_insert_with(|| serde_json::json!(img));
        }

        let metadata_obj = match g.metadata.take() {
            Some(serde_json::Value::Object(mut map)) => {
                for (k, v) in &g.extra {
                    map.insert(k.clone(), v.clone());
                }
                serde_json::Value::Object(map)
            }
            _ => serde_json::Value::Object(g.extra.clone()),
        };

        let metadata_str = serde_json::to_string(&metadata_obj).ok();
        g.metadata = Some(metadata_obj);

        tx.execute(
            "INSERT INTO games
             (id, uid, title, image_url, executable_path, launcher_type,
              steam_app_id, epic_catalog_id, epic_launch_id,
              total_playtime_minutes, last_played_at, is_favorite,
              sort_order, created_at, updated_at, metadata)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16)
             ON CONFLICT(id) DO UPDATE SET
               title = excluded.title,
               image_url = excluded.image_url,
               executable_path = excluded.executable_path,
               launcher_type = excluded.launcher_type,
               steam_app_id = excluded.steam_app_id,
               epic_catalog_id = excluded.epic_catalog_id,
               epic_launch_id = excluded.epic_launch_id,
               total_playtime_minutes = excluded.total_playtime_minutes,
               last_played_at = excluded.last_played_at,
               is_favorite = excluded.is_favorite,
               sort_order = excluded.sort_order,
               updated_at = excluded.updated_at,
               metadata = excluded.metadata",
            params![
                g.id, g.uid, g.title, g.image_url, g.executable_path,
                g.launcher_type, g.steam_app_id, g.epic_catalog_id,
                g.epic_launch_id, g.total_playtime_minutes, g.last_played_at,
                g.is_favorite as i64, g.sort_order, g.created_at, g.updated_at,
                metadata_str
            ],
        )?;
        result.push(g);
    }
    Ok(result)
}

pub fn record_session(uid: &str, game_id: &str, session: GameSession) -> Result<String> {
    let conn = open(uid)?;
    let id = Uuid::new_v4().to_string();
    let now = chrono_now();

    conn.execute(
        "INSERT INTO sessions (id, uid, game_id, started_at, ended_at, duration_minutes, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![id, uid, game_id, session.started_at, session.ended_at, session.duration_minutes, now],
    )?;

    // Update total playtime
    conn.execute(
        "UPDATE games SET total_playtime_minutes = total_playtime_minutes + ?1,
                          last_played_at = ?2, updated_at = ?3
         WHERE id = ?4 AND uid = ?5",
        params![session.duration_minutes, session.ended_at, now, game_id, uid],
    )?;

    Ok(id)
}

pub fn get_summary(uid: &str) -> Result<LibrarySummary> {
    let conn = open(uid)?;

    let (games_count, minutes_played, favorites): (i64, i64, i64) = conn.query_row(
        "SELECT COUNT(*), COALESCE(SUM(total_playtime_minutes),0), COALESCE(SUM(is_favorite),0)
         FROM games WHERE uid = ?1",
        params![uid],
        |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
    )?;

    let steam_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM games WHERE uid=?1 AND launcher_type='steam'",
        params![uid], |r| r.get(0),
    ).unwrap_or(0);

    let epic_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM games WHERE uid=?1 AND launcher_type='epic'",
        params![uid], |r| r.get(0),
    ).unwrap_or(0);

    let local_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM games WHERE uid=?1 AND launcher_type='local'",
        params![uid], |r| r.get(0),
    ).unwrap_or(0);

    // Top 5 most played
    let mut top_stmt = conn.prepare(
        "SELECT id, title, total_playtime_minutes, COALESCE(image_url,'')
         FROM games WHERE uid=?1 ORDER BY total_playtime_minutes DESC LIMIT 5",
    )?;
    let top_games: Vec<TopGame> = top_stmt
        .query_map(params![uid], |r| {
            Ok(TopGame { id: r.get(0)?, title: r.get(1)?, minutes_played: r.get(2)?, image_url: r.get(3)? })
        })?
        .filter_map(|r| r.ok())
        .collect();

    // Favorites
    let mut fav_stmt = conn.prepare(
        "SELECT id, title, total_playtime_minutes, COALESCE(image_url,'')
         FROM games WHERE uid=?1 AND is_favorite=1 ORDER BY total_playtime_minutes DESC LIMIT 5",
    )?;
    let fav_games: Vec<TopGame> = fav_stmt
        .query_map(params![uid], |r| {
            Ok(TopGame { id: r.get(0)?, title: r.get(1)?, minutes_played: r.get(2)?, image_url: r.get(3)? })
        })?
        .filter_map(|r| r.ok())
        .collect();

    // Revision counter
    let revision: i64 = conn
        .query_row(
            "SELECT CAST(value AS INTEGER) FROM library_meta WHERE key='revision'",
            [], |r| r.get(0),
        )
        .unwrap_or(0);

    let device_id = conn
        .query_row(
            "SELECT value FROM library_meta WHERE key='device_id'",
            [], |r| r.get::<_, String>(0),
        )
        .unwrap_or_else(|_| {
            let id = Uuid::new_v4().to_string();
            conn.execute(
                "INSERT OR IGNORE INTO library_meta(key,value) VALUES('device_id',?1)",
                params![id],
            ).ok();
            id
        });

    Ok(LibrarySummary {
        schema_version: 1,
        stats: LibraryStats { games: games_count, minutes_played, favorites },
        platforms: PlatformStats { steam_game_count: steam_count, epic_game_count: epic_count, local_game_count: local_count },
        achievements: AchievementStats { unlocked: 0, total: 0 },
        top_games,
        favorite_games: fav_games,
        revision,
        device_id,
        dirty: false,
    })
}

pub fn needs_legacy_import(uid: &str) -> Result<bool> {
    let conn = open(uid)?;
    let imported: i64 = conn
        .query_row(
            "SELECT CAST(value AS INTEGER) FROM library_meta WHERE key='legacy_imported'",
            [], |r| r.get(0),
        )
        .unwrap_or(0);
    Ok(imported == 0)
}

pub fn mark_legacy_imported(uid: &str) -> Result<()> {
    let conn = open(uid)?;
    conn.execute(
        "INSERT OR REPLACE INTO library_meta(key,value) VALUES('legacy_imported','1')",
        [],
    )?;
    Ok(())
}

pub fn mark_summary_synced(uid: &str, revision: i64) -> Result<()> {
    let conn = open(uid)?;
    conn.execute(
        "INSERT OR REPLACE INTO library_meta(key,value) VALUES('revision',?1)",
        params![revision.to_string()],
    )?;
    Ok(())
}

pub fn clear_steam_id(uid: &str) -> Result<()> {
    let conn = open(uid)?;
    conn.execute(
        "UPDATE games SET steam_app_id=NULL, updated_at=?1 WHERE uid=?2 AND launcher_type='steam'",
        params![chrono_now(), uid],
    )?;
    Ok(())
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn chrono_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    // Simple ISO 8601 UTC string
    let dt = secs;
    let s = dt % 60;
    let m = (dt / 60) % 60;
    let h = (dt / 3600) % 24;
    let d_total = dt / 86400;
    let y = 1970 + d_total / 365;
    let mo = (d_total % 365) / 30 + 1;
    let d = (d_total % 365) % 30 + 1;
    format!("{y:04}-{mo:02}-{d:02}T{h:02}:{m:02}:{s:02}Z")
}
