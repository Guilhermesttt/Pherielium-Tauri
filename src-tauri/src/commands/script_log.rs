//! Lê o log do compilador de scripts de um jogo com mods (REDscript, do Cyberpunk 2077) e diz o que
//! deu errado, para o hub avisar quando um mod depende de outro que não está instalado.
//!
//! O jogo compila os scripts ao abrir e grava o resultado em `r6/logs/redscript_rCURRENT.log`; o
//! que o hub vê é, portanto, o resultado do último início do jogo.

use serde::Serialize;
use std::path::Path;
use tauri::command;

use super::nexus_download::resolve_game_dir;

/// Caminho do log, sempre relativo à pasta do jogo (a tela nunca escolhe o arquivo a ler).
const LOG_RELATIVE: [&str; 3] = ["r6", "logs", "redscript_rCURRENT.log"];
/// O log de um jogo com muitos mods fica em dezenas de KB; mais que isso não é um log de scripts.
const MAX_LOG_BYTES: u64 = 4 * 1024 * 1024;
const MAX_ERRORS: usize = 25;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScriptError {
    /// Código do erro no log, por exemplo `UNRESOLVED_REF`.
    pub code: String,
    /// Pasta do mod dentro de `r6/scripts` (ou o nome do arquivo, se estiver solto).
    pub mod_folder: String,
    pub file: String,
    pub line: u32,
    /// Trecho do código que falhou, sem as setas `^^^`.
    pub snippet: String,
    pub message: String,
    /// Nome que o código usa e não existe (`ModSettings`): é a pista do mod que falta.
    pub missing_symbol: Option<String>,
}

/// Divide `...\r6\scripts\<pasta>\<arquivo>.reds` em (pasta do mod, caminho relativo a `scripts`).
fn split_script_path(raw: &str) -> (String, String) {
    let normalized = raw.replace('\\', "/");
    let relative = match normalized.to_lowercase().find("/scripts/") {
        Some(index) => normalized[index + "/scripts/".len()..].to_string(),
        None => normalized.rsplit('/').next().unwrap_or(&normalized).to_string(),
    };
    let mod_folder = relative.split('/').next().unwrap_or(&relative).to_string();
    (mod_folder, relative)
}

/// `[ERROR - ...] [CODE] At <caminho>:<linha>:<coluna>:` → (código, caminho, linha).
fn parse_error_header(line: &str) -> Option<(String, String, u32)> {
    let rest = line.strip_prefix("[ERROR")?;
    let after_time = rest.split_once("] [")?.1;
    let (code, location) = after_time.split_once("] At ")?;
    // o caminho do Windows tem `:` (C:\...), então a linha e a coluna vêm do fim
    let location = location.trim().trim_end_matches(':');
    let mut parts = location.rsplitn(3, ':');
    let _column = parts.next()?.parse::<u32>().ok()?;
    let line_number = parts.next()?.parse::<u32>().ok()?;
    let path = parts.next()?.to_string();
    Some((code.trim().to_string(), path, line_number))
}

/// O nome entre aspas simples em "unresolved reference 'ModSettings'" / "unresolved type 'X'".
fn missing_symbol_of(message: &str) -> Option<String> {
    let lower = message.to_lowercase();
    if !lower.starts_with("unresolved") {
        return None;
    }
    let start = message.find('\'')? + 1;
    let end = start + message[start..].find('\'')?;
    let symbol = &message[start..end];
    (!symbol.is_empty()).then(|| symbol.to_string())
}

/// Lê os erros do log. Linhas `[INFO]`/`[WARN]` e o que não é erro de script são ignorados.
pub fn parse_redscript_log(text: &str) -> Vec<ScriptError> {
    let lines: Vec<&str> = text.lines().collect();
    let mut errors = Vec::new();
    let mut index = 0;
    while index < lines.len() {
        let Some((code, path, line)) = parse_error_header(lines[index].trim_end()) else {
            index += 1;
            continue;
        };
        // depois do cabeçalho: o trecho do código, a linha de setas (`^^^`) e a mensagem, até a linha em branco
        let mut block = Vec::new();
        let mut cursor = index + 1;
        while cursor < lines.len() && !lines[cursor].trim().is_empty() && !lines[cursor].starts_with('[') {
            block.push(lines[cursor].trim());
            cursor += 1;
        }
        let arrows = block
            .iter()
            .position(|text| text.chars().all(|c| c == '^' || c == '~'));
        let (snippet, message) = match arrows {
            Some(at) => (
                block[..at].last().copied().unwrap_or_default().to_string(),
                block[at + 1..].join(" "),
            ),
            None => (String::new(), block.join(" ")),
        };
        let (mod_folder, file) = split_script_path(&path);
        errors.push(ScriptError {
            code,
            mod_folder,
            file,
            line,
            snippet,
            missing_symbol: missing_symbol_of(&message),
            message,
        });
        if errors.len() >= MAX_ERRORS {
            break;
        }
        index = cursor;
    }
    errors
}

#[derive(Debug, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ScriptLogReport {
    /// O jogo tem esse log (só jogos com REDscript têm).
    pub log_found: bool,
    pub log_path: Option<String>,
    /// Quando o jogo gravou o log (ms desde 1970): diz de qual início do jogo vêm os erros.
    pub written_at: Option<u64>,
    pub errors: Vec<ScriptError>,
}

fn read_report(game_dir: &Path) -> Result<ScriptLogReport, String> {
    let mut path = game_dir.to_path_buf();
    for part in LOG_RELATIVE {
        path.push(part);
    }
    let Ok(metadata) = std::fs::metadata(&path) else {
        return Ok(ScriptLogReport::default());
    };
    if !metadata.is_file() || metadata.len() > MAX_LOG_BYTES {
        return Ok(ScriptLogReport::default());
    }
    // o log do jogo pode ter bytes fora de UTF-8 (nomes de arquivo): lê tolerante
    let bytes = std::fs::read(&path).map_err(|_| "Não foi possível ler o log do jogo.".to_string())?;
    let text = String::from_utf8_lossy(&bytes);
    let written_at = metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis() as u64);
    Ok(ScriptLogReport {
        log_found: true,
        log_path: Some(path.to_string_lossy().into_owned()),
        written_at,
        errors: parse_redscript_log(&text),
    })
}

/// Erros de scripts do último início do jogo, para avisar quando um mod depende de outro que falta.
#[command]
pub async fn mods_check_script_log(game_folder: String) -> Result<ScriptLogReport, String> {
    let game_dir = resolve_game_dir(&game_folder)?;
    tokio::task::spawn_blocking(move || read_report(&game_dir))
        .await
        .map_err(|_| "A leitura do log foi interrompida.".to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    const REAL_LOG: &str = "[INFO - Tue, 27 Oct 2026 05:07:19 -0300] Compiling files in D:\\SteamLibrary\\steamapps\\common\\Cyberpunk 2077\\r6\\scripts:\n\
INCF-CORE\\INCF-CORE.reds\n\
LizziesBDs\\Audio.reds\n\
D:\\SteamLibrary\\steamapps\\common\\Cyberpunk 2077\\red4ext\\plugins\\TweakXL\\Scripts\\TweakXL.reds\n\
[ERROR - Tue, 27 Oct 2026 05:07:19 -0300] [UNRESOLVED_REF] At D:\\SteamLibrary\\steamapps\\common\\Cyberpunk 2077\\r6\\scripts\\INCF-CORE\\INCF-CORE.reds:134:5:\n\
    ModSettings.RegisterListenerToClass(this);\n\
    ^^^^^^^^^^^\n\
unresolved reference 'ModSettings'\n\
\n";

    #[test]
    fn reads_the_unresolved_reference_that_a_missing_dependency_causes() {
        let errors = parse_redscript_log(REAL_LOG);
        assert_eq!(errors.len(), 1);
        let error = &errors[0];
        assert_eq!(error.code, "UNRESOLVED_REF");
        assert_eq!(error.mod_folder, "INCF-CORE");
        assert_eq!(error.file, "INCF-CORE/INCF-CORE.reds");
        assert_eq!(error.line, 134);
        assert_eq!(error.snippet, "ModSettings.RegisterListenerToClass(this);");
        assert_eq!(error.message, "unresolved reference 'ModSettings'");
        assert_eq!(error.missing_symbol.as_deref(), Some("ModSettings"));
    }

    #[test]
    fn a_log_without_errors_gives_nothing() {
        let clean = "[INFO - Tue, 27 Oct 2026 05:07:19 -0300] Compiling files in D:\\Game\\r6\\scripts:\nA\\a.reds\n[INFO - Tue] Compilation complete\n";
        assert!(parse_redscript_log(clean).is_empty());
        assert!(parse_redscript_log("").is_empty());
    }

    #[test]
    fn other_errors_keep_their_message_but_name_no_missing_mod() {
        let log = "[ERROR - t] [SYNTAX_ERR] At C:\\G\\r6\\scripts\\Mod\\a.reds:7:1:\n    let x = ;\n    ^\nexpected an expression\n\n";
        let errors = parse_redscript_log(log);
        assert_eq!(errors.len(), 1);
        assert_eq!(errors[0].code, "SYNTAX_ERR");
        assert_eq!(errors[0].message, "expected an expression");
        assert_eq!(errors[0].missing_symbol, None);
    }

    #[test]
    fn several_errors_each_get_their_own_mod_and_a_loose_file_uses_its_name() {
        let log = "[ERROR - t] [UNRESOLVED_TYPE] At C:\\G\\r6\\scripts\\A\\x.reds:1:2:\n    f(Codeware);\n    ^^\nunresolved type 'Codeware'\n\n\
[ERROR - t] [UNRESOLVED_REF] At C:\\G\\r6\\scripts\\solto.reds:9:3:\n    NativeSettings.Do();\n    ^\nunresolved reference 'NativeSettings'\n\n";
        let errors = parse_redscript_log(log);
        assert_eq!(errors.len(), 2);
        assert_eq!(errors[0].mod_folder, "A");
        assert_eq!(errors[0].missing_symbol.as_deref(), Some("Codeware"));
        assert_eq!(errors[1].mod_folder, "solto.reds");
        assert_eq!(errors[1].missing_symbol.as_deref(), Some("NativeSettings"));
    }

    #[test]
    fn a_header_without_line_and_column_is_not_an_error() {
        assert!(parse_error_header("[ERROR - t] [X] At nada").is_none());
        assert!(parse_error_header("[INFO - t] Compiling").is_none());
    }

    #[test]
    fn a_missing_log_is_an_empty_report_not_an_error() {
        let report = read_report(Path::new("Z:\\nao\\existe")).unwrap();
        assert!(!report.log_found);
        assert!(report.errors.is_empty());
    }
}
