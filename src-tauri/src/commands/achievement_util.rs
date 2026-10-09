//! Utilidades compartilhadas do sistema de conquistas: caminhos dos arquivos locais, data em
//! RFC 3339 e escrita atômica. Antes cada arquivo tinha a sua cópia (e o `now_iso` não gerava
//! uma data válida).

use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

pub fn achievement_dir() -> PathBuf {
    dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("Pherielium")
        .join("achievements")
}

pub fn definitions_path(game_id: &str) -> PathBuf {
    achievement_dir().join(format!("{game_id}_definitions.json"))
}

pub fn progress_path(game_id: &str) -> PathBuf {
    achievement_dir().join(format!("{game_id}_progress.json"))
}

/// Dia civil (ano, mês, dia) a partir de dias desde 1970-01-01 (algoritmo de Howard Hinnant).
fn civil_from_days(days: i64) -> (i64, u32, u32) {
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    (if m <= 2 { y + 1 } else { y }, m, d)
}

/// Segundos desde a época Unix em RFC 3339 UTC (`2023-11-14T22:13:20Z`).
pub fn rfc3339_from_unix(secs: u64) -> String {
    let days = (secs / 86_400) as i64;
    let rem = secs % 86_400;
    let (y, m, d) = civil_from_days(days);
    format!("{y:04}-{m:02}-{d:02}T{:02}:{:02}:{:02}Z", rem / 3_600, (rem % 3_600) / 60, rem % 60)
}

/// Agora, em RFC 3339 UTC (parseável por `Date.parse` no front).
pub fn now_iso() -> String {
    let secs = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs();
    rfc3339_from_unix(secs)
}

/// Escreve em um arquivo temporário vizinho e renomeia: um crash no meio não deixa o JSON
/// pela metade (que o leitor trataria como vazio, zerando o progresso).
pub fn atomic_write(path: &Path, contents: &[u8]) -> std::io::Result<()> {
    let mut tmp = path.as_os_str().to_owned();
    tmp.push(".tmp");
    let tmp = PathBuf::from(tmp);
    std::fs::write(&tmp, contents)?;
    match std::fs::rename(&tmp, path) {
        Ok(()) => Ok(()),
        Err(err) => {
            // no Windows, renomear sobre um arquivo aberto por outro processo pode falhar
            let _ = std::fs::remove_file(&tmp);
            Err(err)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rfc3339_known_instants() {
        assert_eq!(rfc3339_from_unix(0), "1970-01-01T00:00:00Z");
        assert_eq!(rfc3339_from_unix(1_700_000_000), "2023-11-14T22:13:20Z");
        // ano bissexto: 2024-02-29 12:00:00
        assert_eq!(rfc3339_from_unix(1_709_208_000), "2024-02-29T12:00:00Z");
        // virada de ano
        assert_eq!(rfc3339_from_unix(1_735_689_599), "2024-12-31T23:59:59Z");
        assert_eq!(rfc3339_from_unix(1_735_689_600), "2025-01-01T00:00:00Z");
    }

    #[test]
    fn now_iso_has_rfc3339_shape() {
        let s = now_iso();
        assert_eq!(s.len(), 20, "{s}");
        assert!(s.ends_with('Z') && s.as_bytes()[10] == b'T' && s.as_bytes()[4] == b'-', "{s}");
    }

    #[test]
    fn atomic_write_replaces_contents_and_leaves_no_temp() {
        let dir = std::env::temp_dir().join(format!("pherielium_atomic_{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let file = dir.join("progress.json");
        atomic_write(&file, b"{\"a\":1}").unwrap();
        atomic_write(&file, b"{\"a\":2}").unwrap();
        assert_eq!(std::fs::read_to_string(&file).unwrap(), "{\"a\":2}");
        assert!(!dir.join("progress.json.tmp").exists());
        let _ = std::fs::remove_dir_all(&dir);
    }
}
