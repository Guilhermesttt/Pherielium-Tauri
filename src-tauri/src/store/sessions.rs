//! Sessões de jogo que sobrevivem a crash. O front abre a sessão ao detectar o jogo, manda um
//! heartbeat a cada ~30 s e fecha ao terminar. Se o app morrer no meio, `recover_orphans` fecha a
//! sessão na próxima abertura usando o último heartbeat (o tempo jogado não se perde).
//! O tempo é somado em minutos, uma única vez, dentro de uma transação.

use anyhow::Result;
use rusqlite::{params, Connection, OptionalExtension};
use uuid::Uuid;

use super::game_library;
use crate::commands::achievement_util::rfc3339_from_unix;

/// Sessões com menos de 30 s não contam (abrir e fechar na hora).
const MIN_COUNTED_SECS: i64 = 30;

#[derive(Debug, Clone, PartialEq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClosedSession {
    pub game_id: String,
    pub title: String,
    pub duration_minutes: i64,
    /// `true` quando veio da recuperação de uma sessão interrompida
    pub recovered: bool,
}

fn now_secs() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

/// Abre (ou substitui) a sessão do usuário. Se havia outra aberta, ela é fechada antes.
pub fn open_at(conn: &Connection, uid: &str, game_id: &str, title: &str, now: i64) -> Result<Option<ClosedSession>> {
    let previous = finish(conn, uid, now, false)?;
    conn.execute(
        "INSERT INTO open_sessions (uid, game_id, title, started_at, last_heartbeat) VALUES (?1, ?2, ?3, ?4, ?4)",
        params![uid, game_id, title, now],
    )?;
    Ok(previous)
}

pub fn heartbeat_at(conn: &Connection, uid: &str, now: i64) -> Result<()> {
    conn.execute("UPDATE open_sessions SET last_heartbeat = ?2 WHERE uid = ?1", params![uid, now])?;
    Ok(())
}

/// Fecha a sessão aberta e grava o tempo. `end` = quando terminou (agora, ou o último heartbeat).
fn finish(conn: &Connection, uid: &str, end: i64, recovered: bool) -> Result<Option<ClosedSession>> {
    let row: Option<(String, String, i64)> = conn
        .query_row(
            "SELECT game_id, title, started_at FROM open_sessions WHERE uid = ?1",
            params![uid],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )
        .optional()?;
    let Some((game_id, title, started)) = row else {
        return Ok(None);
    };

    let tx = conn.unchecked_transaction()?;
    tx.execute("DELETE FROM open_sessions WHERE uid = ?1", params![uid])?;

    let secs = (end - started).max(0);
    let minutes = (secs + 30) / 60; // arredonda ao minuto mais próximo
    if secs < MIN_COUNTED_SECS || minutes < 1 {
        tx.commit()?;
        return Ok(None);
    }
    let known: bool = tx
        .query_row("SELECT 1 FROM games WHERE id = ?1 AND uid = ?2", params![game_id, uid], |_| Ok(true))
        .optional()?
        .unwrap_or(false);
    if !known {
        tx.commit()?;
        return Ok(None);
    }

    let ended_iso = rfc3339_from_unix(end.max(0) as u64);
    tx.execute(
        "INSERT INTO sessions (id, uid, game_id, started_at, ended_at, duration_minutes, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?5)",
        params![
            Uuid::new_v4().to_string(),
            uid,
            game_id,
            rfc3339_from_unix(started.max(0) as u64),
            ended_iso,
            minutes
        ],
    )?;
    tx.execute(
        "UPDATE games SET total_playtime_minutes = total_playtime_minutes + ?1, last_played_at = ?2, updated_at = ?2
         WHERE id = ?3 AND uid = ?4",
        params![minutes, ended_iso, game_id, uid],
    )?;
    tx.commit()?;
    Ok(Some(ClosedSession { game_id, title, duration_minutes: minutes, recovered }))
}

pub fn close_at(conn: &Connection, uid: &str, now: i64) -> Result<Option<ClosedSession>> {
    finish(conn, uid, now, false)
}

/// Fecha, no último heartbeat, a sessão que ficou aberta por um crash.
pub fn recover_orphans_at(conn: &Connection, uid: &str) -> Result<Option<ClosedSession>> {
    let hb: Option<i64> = conn
        .query_row("SELECT last_heartbeat FROM open_sessions WHERE uid = ?1", params![uid], |r| r.get(0))
        .optional()?;
    match hb {
        Some(hb) => finish(conn, uid, hb, true),
        None => Ok(None),
    }
}

// ── envoltórios por usuário (abrem o SQLite) ─────────────────────────────────

pub fn open_session(uid: &str, game_id: &str, title: &str) -> Result<Option<ClosedSession>> {
    open_at(&game_library::open(uid)?, uid, game_id, title, now_secs())
}
pub fn heartbeat(uid: &str) -> Result<()> {
    heartbeat_at(&game_library::open(uid)?, uid, now_secs())
}
pub fn close_session(uid: &str) -> Result<Option<ClosedSession>> {
    close_at(&game_library::open(uid)?, uid, now_secs())
}
pub fn recover_orphans(uid: &str) -> Result<Option<ClosedSession>> {
    recover_orphans_at(&game_library::open(uid)?, uid)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        game_library::migrate(&conn).unwrap();
        conn.execute(
            "INSERT INTO games (id, uid, title, created_at, updated_at) VALUES ('g1','u','Hades','t','t')",
            [],
        )
        .unwrap();
        conn
    }
    fn minutes(conn: &Connection) -> i64 {
        conn.query_row("SELECT total_playtime_minutes FROM games WHERE id='g1'", [], |r| r.get(0)).unwrap()
    }

    #[test]
    fn normal_session_adds_exact_minutes_once() {
        let c = db();
        open_at(&c, "u", "g1", "Hades", 1_000).unwrap();
        let closed = close_at(&c, "u", 1_000 + 25 * 60).unwrap().unwrap();
        assert_eq!(closed.duration_minutes, 25);
        assert_eq!(minutes(&c), 25);
        assert!(close_at(&c, "u", 9_999).unwrap().is_none(), "fechar de novo nao soma");
        assert_eq!(minutes(&c), 25);
    }

    #[test]
    fn crash_is_recovered_up_to_the_last_heartbeat() {
        let c = db();
        open_at(&c, "u", "g1", "Hades", 1_000).unwrap();
        heartbeat_at(&c, "u", 1_000 + 40 * 60).unwrap();
        let rec = recover_orphans_at(&c, "u").unwrap().unwrap();
        assert!(rec.recovered);
        assert_eq!(rec.duration_minutes, 40);
        assert_eq!(minutes(&c), 40);
        assert!(recover_orphans_at(&c, "u").unwrap().is_none());
    }

    #[test]
    fn very_short_sessions_are_ignored_but_cleared() {
        let c = db();
        open_at(&c, "u", "g1", "Hades", 1_000).unwrap();
        assert!(close_at(&c, "u", 1_010).unwrap().is_none());
        assert_eq!(minutes(&c), 0);
        let n: i64 = c.query_row("SELECT COUNT(*) FROM open_sessions", [], |r| r.get(0)).unwrap();
        assert_eq!(n, 0);
    }

    #[test]
    fn opening_a_second_session_closes_the_first() {
        let c = db();
        open_at(&c, "u", "g1", "Hades", 0).unwrap();
        let prev = open_at(&c, "u", "g1", "Hades", 10 * 60).unwrap().unwrap();
        assert_eq!(prev.duration_minutes, 10);
        assert_eq!(minutes(&c), 10);
    }

    #[test]
    fn unknown_game_does_not_credit_anything() {
        let c = db();
        open_at(&c, "u", "nope", "X", 0).unwrap();
        assert!(close_at(&c, "u", 3600).unwrap().is_none());
        assert_eq!(minutes(&c), 0);
    }
}
