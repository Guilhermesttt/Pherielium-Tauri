//! Tauri commands: perfis de controle e estado do driver ViGEmBus.
//!
//! Os perfis moram no SQLite por usuário (`store::controller_profiles`), que já
//! guarda a biblioteca. A precedência jogo > global > fábrica é resolvida lá e
//! testada lá; aqui só entra a casca de IPC.
//!
//! O driver NUNCA é instalado em silêncio: `vigem_status` apenas reporta, e a UI
//! guia a pessoa até o instalador oficial.

use serde::Serialize;
use tauri::command;

use crate::store::controller_profiles::{
    self as profiles, ControllerSettings, ResolvedProfile,
};
use crate::store::game_library;

fn open_db(uid: &str) -> Result<rusqlite::Connection, String> {
    if uid.trim().is_empty() {
        return Err("Usuário inválido.".into());
    }
    game_library::open(uid).map_err(|e| format!("Banco local indisponível: {e}"))
}

/// Perfil efetivo. `game_id` ausente = o do launcher (global ou fábrica).
#[command]
pub fn controller_profile_resolve(
    uid: String,
    game_id: Option<String>,
) -> Result<ResolvedProfile, String> {
    let conn = open_db(&uid)?;
    profiles::resolve_for(&conn, game_id.as_deref()).map_err(|e| e.to_string())
}

/// Perfil gravado num escopo específico, sem herança. `None` = não existe
/// override ali (a UI mostra "usando o global").
#[command]
pub fn controller_profile_get(
    uid: String,
    game_id: Option<String>,
) -> Result<Option<ControllerSettings>, String> {
    let conn = open_db(&uid)?;
    profiles::get(&conn, game_id.as_deref()).map_err(|e| e.to_string())
}

#[command]
pub fn controller_profile_save(
    uid: String,
    game_id: Option<String>,
    settings: ControllerSettings,
) -> Result<ResolvedProfile, String> {
    let conn = open_db(&uid)?;
    profiles::save(&conn, game_id.as_deref(), &settings).map_err(|e| e.to_string())?;
    profiles::resolve_for(&conn, game_id.as_deref()).map_err(|e| e.to_string())
}

/// "Usar global": apaga o override do jogo e devolve o perfil que passa a valer.
#[command]
pub fn controller_profile_clear_game(
    uid: String,
    game_id: String,
) -> Result<ResolvedProfile, String> {
    let conn = open_db(&uid)?;
    profiles::delete(&conn, &game_id).map_err(|e| e.to_string())?;
    profiles::resolve_for(&conn, Some(&game_id)).map_err(|e| e.to_string())
}

/// "Restaurar padrão": apaga o perfil global; tudo volta à fábrica.
#[command]
pub fn controller_profile_reset_global(uid: String) -> Result<ResolvedProfile, String> {
    let conn = open_db(&uid)?;
    conn.execute(
        "DELETE FROM controller_profiles WHERE game_id IS NULL",
        [],
    )
    .map_err(|e| e.to_string())?;
    profiles::resolve_for(&conn, None).map_err(|e| e.to_string())
}

/// Jogos com perfil próprio, para a lista de "perfis por jogo".
#[command]
pub fn controller_profile_list_games(uid: String) -> Result<Vec<String>, String> {
    let conn = open_db(&uid)?;
    profiles::list_game_ids(&conn).map_err(|e| e.to_string())
}

/// Amostras da curva de resposta, para o gráfico da aba de configurações.
///
/// A matemática de deadzone/curva/sensibilidade vive só aqui: se o front
/// desenhasse o gráfico com a própria fórmula, as duas versões divergiriam e o
/// gráfico passaria a mentir sobre o que o controle faz.
#[command]
pub fn controller_curve_preview(
    settings: ControllerSettings,
    samples: Option<u32>,
) -> Vec<f32> {
    let settings = settings.sanitized();
    let n = samples.unwrap_or(64).clamp(2, 512);
    (0..n)
        .map(|i| {
            let input = i as f32 / (n - 1) as f32;
            profiles::apply_axis(
                input,
                0.0,
                settings.deadzone_left,
                settings.curve,
                settings.sensitivity,
            )
        })
        .collect()
}

/// Amostras da curva do gatilho, mesma razão do `controller_curve_preview`.
#[command]
pub fn controller_trigger_preview(
    settings: ControllerSettings,
    samples: Option<u32>,
) -> Vec<f32> {
    let settings = settings.sanitized();
    let n = samples.unwrap_or(64).clamp(2, 512);
    (0..n)
        .map(|i| {
            let input = i as f32 / (n - 1) as f32;
            profiles::apply_trigger(input, settings.trigger_threshold)
        })
        .collect()
}

// ── Driver ──────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VigemStatus {
    /// Driver presente e respondendo.
    pub installed: bool,
    /// Só Windows tem ViGEmBus.
    pub supported: bool,
    /// Motivo legível quando `installed` é falso.
    pub detail: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HidHideStatus {
    pub installed: bool,
    pub supported: bool,
    pub detail: Option<String>,
}

/// Os dois drivers de uma vez: a UI precisa dos dois para decidir se libera a
/// emulação. Sem o HidHide o jogo enxerga o controle físico E o virtual, e a
/// entrada chega duplicada — por isso o toggle só habilita com os dois de pé.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ControllerDriverStatus {
    pub vigem: VigemStatus,
    pub hid_hide: HidHideStatus,
    /// `true` só quando dá para emular sem duplicar entrada.
    pub emulation_ready: bool,
}

/// Reporta se o HidHide está presente. **Não instala nada.**
///
/// O sinal primário é a chave de serviço no registro: é o que o instalador
/// cria e sobrevive a o dispositivo estar ocupado. Abrir `\\.\HidHide` entra
/// só como informação extra — foi exatamente esse tipo de chute que fez a
/// detecção do ViGEm reportar "ausente" com o driver instalado e rodando.
#[command]
pub fn hidhide_status() -> HidHideStatus {
    #[cfg(target_os = "windows")]
    {
        use winreg::enums::HKEY_LOCAL_MACHINE;
        use winreg::RegKey;

        let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
        match hklm.open_subkey(r"SYSTEM\CurrentControlSet\Services\HidHide") {
            Ok(_) => HidHideStatus {
                installed: true,
                supported: true,
                detail: None,
            },
            Err(err) => HidHideStatus {
                installed: false,
                supported: true,
                detail: Some(format!("HidHide não encontrado: {err}")),
            },
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        HidHideStatus {
            installed: false,
            supported: false,
            detail: Some("HidHide existe apenas no Windows.".into()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Checagem manual: depende do que está instalado na máquina, por isso fica
    /// `ignore`. Rode com
    /// `cargo test --lib driver_status_on_this_machine -- --ignored --nocapture`
    /// depois de instalar ou remover um driver, e confira se bate com a
    /// realidade. Foi assim que apareceu que a detecção antiga do ViGEm
    /// (abrir `\\.\ViGEmBus` como arquivo) dizia "ausente" com o driver de pé.
    #[test]
    #[ignore = "depende dos drivers instalados nesta máquina"]
    fn driver_status_on_this_machine() {
        let s = controller_driver_status();
        println!("ViGEm   instalado={} detalhe={:?}", s.vigem.installed, s.vigem.detail);
        println!("HidHide instalado={} detalhe={:?}", s.hid_hide.installed, s.hid_hide.detail);
        println!("emulationReady={}", s.emulation_ready);
        assert_eq!(
            s.emulation_ready,
            s.vigem.installed && s.hid_hide.installed,
            "emulationReady tem de ser a conjunção dos dois"
        );
    }
}

#[command]
pub fn controller_driver_status() -> ControllerDriverStatus {
    let vigem = vigem_status();
    let hid_hide = hidhide_status();
    let emulation_ready = vigem.installed && hid_hide.installed;
    ControllerDriverStatus {
        vigem,
        hid_hide,
        emulation_ready,
    }
}

/// Reporta se o ViGEmBus está presente. **Não instala nada**: a UI usa isto para
/// mostrar o passo a passo e abrir o instalador oficial, com o UAC à vista.
///
/// A checagem é conectar de verdade no driver. Tentar abrir `\\.\ViGEmBus` como
/// arquivo não serve: o driver se expõe por interface de dispositivo, e o
/// caminho falha mesmo com ele instalado e o serviço rodando (verificado).
/// `Client::connect()` é a mesma chamada que a emulação precisa, então o que o
/// status diz é exatamente o que vai acontecer na hora de usar.
#[command]
pub fn vigem_status() -> VigemStatus {
    #[cfg(target_os = "windows")]
    {
        match vigem_client::Client::connect() {
            Ok(_) => VigemStatus {
                installed: true,
                supported: true,
                detail: None,
            },
            Err(err) => VigemStatus {
                installed: false,
                supported: true,
                detail: Some(format!("ViGEmBus não respondeu: {err:?}")),
            },
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        VigemStatus {
            installed: false,
            supported: false,
            detail: Some("ViGEmBus existe apenas no Windows.".into()),
        }
    }
}
