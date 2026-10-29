//! Esconde o controle físico do jogo enquanto o controle virtual está ligado (HidHide).
//!
//! Sem isto o jogo enxerga o físico E o virtual e a entrada chega duplicada. O HidHide é um
//! driver à parte que o usuário instala; aqui só o comandamos pelo `HidHideCLI.exe` oficial
//! (nada de driver embutido). O launcher entra na lista de apps permitidos para continuar
//! lendo o controle físico — é de lá que o motor alimenta o virtual.
//!
//! Risco que importa: se o app morrer com o controle escondido, a pessoa fica sem controle em
//! TODOS os jogos. Por isso o que foi escondido é gravado em disco ANTES de esconder e desfeito
//! na próxima abertura (`recover_on_startup`).

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum CloakError {
    #[error("HidHideCLI.exe não encontrado em {0}")]
    CliMissing(String),
    #[error("falha ao executar o HidHideCLI: {0}")]
    Spawn(String),
    #[error("o HidHideCLI recusou o comando ({args}): {stderr}")]
    Command { args: String, stderr: String },
    #[error("não foi possível ler/gravar o registro de recuperação: {0}")]
    Recovery(String),
}

/// O que este app alterou no HidHide, para desfazer exatamente isso (e nada além).
#[derive(Debug, Default, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CloakRecord {
    /// Caminhos de instância dos dispositivos que escondemos.
    pub hidden: Vec<String>,
    /// O cloak estava desligado antes de ligarmos? Só então desligamos ao final.
    pub we_enabled_cloak: bool,
    /// Executável que registramos como permitido (vazio se já estava na lista).
    pub registered_app: String,
}

/// Dispositivos de jogo (controles) visíveis ao HidHide, a partir da saída JSON de `--dev-gaming`.
///
/// O parser é tolerante de propósito: varre qualquer nível procurando `deviceInstancePath`, para
/// não quebrar se a versão do HidHide mudar o aninhamento. Dispositivos marcados `present: false`
/// (controles que já foram plugados um dia) são ignorados.
pub fn parse_gaming_devices(json: &str) -> Vec<String> {
    fn walk(value: &serde_json::Value, out: &mut Vec<String>) {
        match value {
            serde_json::Value::Object(map) => {
                let absent = map.get("present").and_then(|p| p.as_bool()) == Some(false);
                if !absent {
                    if let Some(path) = map.get("deviceInstancePath").and_then(|p| p.as_str()) {
                        if !out.iter().any(|p| p == path) {
                            out.push(path.to_string());
                        }
                    }
                }
                for child in map.values() {
                    walk(child, out);
                }
            }
            serde_json::Value::Array(items) => items.iter().for_each(|i| walk(i, out)),
            _ => {}
        }
    }
    let mut out = Vec::new();
    // O CLI pode imprimir texto antes/depois do JSON; fica só do primeiro `[` ao último `]`.
    let trimmed = match (json.find('['), json.rfind(']')) {
        (Some(start), Some(end)) if end > start => &json[start..=end],
        _ => return out,
    };
    if let Ok(value) = serde_json::from_str::<serde_json::Value>(trimmed) {
        walk(&value, &mut out);
    }
    out
}

/// `--cloak-state` imprime os comandos que reproduzem o estado atual (`--cloak-on` / `--cloak-off`).
pub fn cloak_is_on(state_output: &str) -> bool {
    state_output.contains("--cloak-on")
}

/// A lista de apps (`--app-list`) imprime um `--app-reg "<caminho>"` por app.
pub fn app_is_registered(app_list_output: &str, exe: &Path) -> bool {
    let wanted = exe.to_string_lossy().to_ascii_lowercase();
    app_list_output
        .lines()
        .any(|line| line.to_ascii_lowercase().contains(&wanted))
}

#[cfg(target_os = "windows")]
mod cli {
    use super::{CloakError, PathBuf};
    use std::os::windows::process::CommandExt;
    use std::process::Command;

    /// Evita a janela de console piscando a cada chamada.
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;

    pub fn path() -> Result<PathBuf, CloakError> {
        let base = std::env::var_os("ProgramFiles").unwrap_or_else(|| r"C:\Program Files".into());
        let exe = PathBuf::from(base)
            .join("Nefarius Software Solutions")
            .join("HidHide")
            .join("x64")
            .join("HidHideCLI.exe");
        if exe.is_file() {
            Ok(exe)
        } else {
            Err(CloakError::CliMissing(exe.display().to_string()))
        }
    }

    pub fn run(args: &[&str]) -> Result<String, CloakError> {
        let output = Command::new(path()?)
            .args(args)
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .map_err(|e| CloakError::Spawn(e.to_string()))?;
        if !output.status.success() {
            return Err(CloakError::Command {
                args: args.join(" "),
                stderr: String::from_utf8_lossy(&output.stderr).trim().to_string(),
            });
        }
        Ok(String::from_utf8_lossy(&output.stdout).into_owned())
    }
}

#[cfg(not(target_os = "windows"))]
mod cli {
    use super::CloakError;

    pub fn run(_args: &[&str]) -> Result<String, CloakError> {
        Err(CloakError::CliMissing("HidHide existe apenas no Windows".into()))
    }
}

fn recovery_file() -> Result<PathBuf, CloakError> {
    let dir = dirs::data_local_dir()
        .ok_or_else(|| CloakError::Recovery("pasta de dados local indisponível".into()))?
        .join("Pherielium");
    std::fs::create_dir_all(&dir).map_err(|e| CloakError::Recovery(e.to_string()))?;
    Ok(dir.join("hidhide-recovery.json"))
}

fn write_record(record: &CloakRecord) -> Result<(), CloakError> {
    let json = serde_json::to_string(record).map_err(|e| CloakError::Recovery(e.to_string()))?;
    std::fs::write(recovery_file()?, json).map_err(|e| CloakError::Recovery(e.to_string()))
}

/// Desfaz o que o registro diz que fizemos. Tenta tudo mesmo se um passo falhar, para não deixar
/// o controle escondido por causa de um erro no meio; devolve o primeiro erro encontrado.
fn undo(record: &CloakRecord) -> Result<(), CloakError> {
    let mut first_error = None;
    let mut keep = |result: Result<String, CloakError>| {
        if let Err(e) = result {
            first_error.get_or_insert(e);
        }
    };
    for device in &record.hidden {
        keep(cli::run(&["--dev-unhide", device]));
    }
    if record.we_enabled_cloak {
        keep(cli::run(&["--cloak-off"]));
    }
    if !record.registered_app.is_empty() {
        keep(cli::run(&["--app-unreg", &record.registered_app]));
    }
    match first_error {
        Some(e) => Err(e),
        None => Ok(()),
    }
}

/// Controles de jogo presentes agora. Chame ANTES de ligar o pad virtual, senão ele entra na lista.
pub fn gaming_devices() -> Result<Vec<String>, CloakError> {
    Ok(parse_gaming_devices(&cli::run(&["--dev-gaming"])?))
}

/// Dispositivos escondidos agora (`--dev-list`), seja por este app ou não.
pub fn hidden_devices() -> Result<Vec<String>, CloakError> {
    let output = cli::run(&["--dev-list"])?;
    // `--dev-list` imprime um `--dev-hide "<caminho>"` por dispositivo.
    Ok(output
        .lines()
        .filter_map(|line| line.trim().strip_prefix("--dev-hide"))
        .map(|rest| rest.trim().trim_matches('"').to_string())
        .collect())
}

/// Esconde `devices` de todo app que não seja `exe`. Idempotente quanto ao registro em disco.
pub fn hide(devices: &[String], exe: &Path) -> Result<CloakRecord, CloakError> {
    let cloak_was_on = cloak_is_on(&cli::run(&["--cloak-state"])?);
    let app_was_registered = app_is_registered(&cli::run(&["--app-list"])?, exe);

    let record = CloakRecord {
        hidden: devices.to_vec(),
        we_enabled_cloak: !cloak_was_on,
        registered_app: if app_was_registered { String::new() } else { exe.to_string_lossy().into_owned() },
    };
    // Grava ANTES de mexer: se o app cair no meio, a próxima abertura sabe o que desfazer.
    write_record(&record)?;

    let exe_str = exe.to_string_lossy();
    let result = (|| {
        if !app_was_registered {
            cli::run(&["--app-reg", &exe_str])?;
        }
        // Lista de apps normal (não invertida): só os registrados enxergam os escondidos.
        cli::run(&["--inv-off"])?;
        for device in devices {
            cli::run(&["--dev-hide", device])?;
        }
        cli::run(&["--cloak-on"])?;
        Ok::<(), CloakError>(())
    })();

    if let Err(e) = result {
        let _ = undo(&record);
        let _ = clear_record();
        return Err(e);
    }
    Ok(record)
}

/// Desfaz um `hide` e apaga o registro de recuperação.
pub fn restore(record: &CloakRecord) -> Result<(), CloakError> {
    let result = undo(record);
    // O registro só some se deu tudo certo; senão fica para a próxima abertura tentar de novo.
    if result.is_ok() {
        clear_record()?;
    }
    result
}

fn clear_record() -> Result<(), CloakError> {
    let file = recovery_file()?;
    match std::fs::remove_file(file) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(CloakError::Recovery(e.to_string())),
    }
}

/// Na abertura do app: se sobrou um registro, o app anterior caiu com o controle escondido.
pub fn recover_on_startup() {
    let Ok(file) = recovery_file() else { return };
    let Ok(raw) = std::fs::read_to_string(&file) else { return };
    match serde_json::from_str::<CloakRecord>(&raw) {
        Ok(record) => match restore(&record) {
            Ok(()) => eprintln!("[hidhide] controle restaurado após encerramento anormal"),
            Err(e) => eprintln!("[hidhide] não foi possível restaurar o controle: {e}"),
        },
        Err(e) => {
            eprintln!("[hidhide] registro de recuperação inválido ({e}); descartado");
            let _ = clear_record();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = r#"
[
  {
    "friendlyName": "Xbox Wireless Controller",
    "devices": [
      { "present": true,  "gamingDevice": true, "deviceInstancePath": "HID\\VID_045E&PID_0B13&IG_00\\9&1A2B3C&0&0000" },
      { "present": false, "gamingDevice": true, "deviceInstancePath": "HID\\VID_054C&PID_0CE6\\OLD" }
    ],
    "present": true
  },
  {
    "friendlyName": "Outro",
    "devices": [ { "gamingDevice": true, "deviceInstancePath": "HID\\VID_1234&PID_5678\\X" } ]
  }
]"#;

    #[test]
    fn lists_only_present_gaming_devices() {
        let devices = parse_gaming_devices(SAMPLE);
        assert_eq!(
            devices,
            vec![
                r"HID\VID_045E&PID_0B13&IG_00\9&1A2B3C&0&0000".to_string(),
                r"HID\VID_1234&PID_5678\X".to_string(),
            ]
        );
    }

    #[test]
    fn tolerates_garbage_and_empty_output() {
        assert!(parse_gaming_devices("").is_empty());
        assert!(parse_gaming_devices("sem json").is_empty());
        assert!(parse_gaming_devices(" [ ] ").is_empty());
        assert!(parse_gaming_devices("[{quebrado").is_empty());
    }

    #[test]
    fn ignores_text_around_the_json() {
        let wrapped = format!("aviso\n{SAMPLE}\nfim");
        assert_eq!(parse_gaming_devices(&wrapped).len(), 2);
    }

    #[test]
    fn reads_cloak_state_and_registered_apps() {
        assert!(cloak_is_on("--cloak-on\n--inv-off"));
        assert!(!cloak_is_on("--cloak-off\n--inv-off"));
        let list = "--app-reg \"C:\\Program Files\\Pherielium\\pherielium.exe\"\n";
        assert!(app_is_registered(list, Path::new(r"C:\Program Files\Pherielium\Pherielium.exe")));
        assert!(!app_is_registered(list, Path::new(r"C:\Outro\app.exe")));
    }

    #[test]
    fn record_round_trips_through_json() {
        let record = CloakRecord {
            hidden: vec!["HID\\A".into()],
            we_enabled_cloak: true,
            registered_app: "C:\\app.exe".into(),
        };
        let json = serde_json::to_string(&record).unwrap();
        assert_eq!(serde_json::from_str::<CloakRecord>(&json).unwrap(), record);
    }
}
