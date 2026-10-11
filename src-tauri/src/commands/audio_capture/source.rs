//! Estratégias de captura e a escolha entre elas.
//!
//! A escolha é uma tabela (`MODE_TABLE`), não uma cadeia de `if/else`: cada
//! modo diz que estratégia usa e do que depende. Adicionar um modo é uma linha.
//!
//! Regra de ouro: **nada cai sozinho para `SystemLoopback`**. Ele captura o mix
//! do dispositivo inteiro, inclusive a voz das pessoas da call, então só roda
//! quando a pessoa pede explicitamente (e a UI avisa do vazamento).

use serde::{Deserialize, Serialize};
use std::time::Duration;

use super::error::AudioCaptureError;

/// Build mínimo do Windows para o process loopback, conforme a documentação
/// oficial da Microsoft (Windows 10 build 20348 / Windows 11).
pub const MIN_PROCESS_LOOPBACK_BUILD: u32 = 20348;

/// O que a pessoa escolhe no diálogo de compartilhar tela.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CaptureMode {
    /// Áudio do desktop SEM o Pherielium (a call não entra).
    ExcludeSelf,
    /// Só o áudio do jogo rastreado pelo hub.
    Game,
    /// Mix do dispositivo inteiro. Pode vazar a voz da call.
    System,
}

/// Como o áudio é de fato capturado.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Strategy {
    ExcludeOwnProcessTree,
    IncludeTargetProcessTree,
    SystemLoopback,
}

/// Resultado da sonda de capacidade do process loopback.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum Capability {
    Supported,
    UnsupportedBuild { found: u32 },
    ActivationFailed { hresult: u32 },
}

impl Capability {
    pub fn is_supported(self) -> bool {
        matches!(self, Capability::Supported)
    }

    /// O erro que explica por que o process loopback não está disponível.
    fn as_error(self) -> Option<AudioCaptureError> {
        match self {
            Capability::Supported => None,
            Capability::UnsupportedBuild { found } => Some(AudioCaptureError::UnsupportedBuild {
                found,
                required: MIN_PROCESS_LOOPBACK_BUILD,
            }),
            Capability::ActivationFailed { hresult } => {
                Some(AudioCaptureError::ActivationFailed { hresult })
            }
        }
    }
}

/// Uma linha da tabela de modos.
struct ModeRule {
    mode: CaptureMode,
    strategy: Strategy,
    /// Precisa do process loopback (build/ativação OK)?
    needs_process_loopback: bool,
    /// Precisa do PID de um jogo rastreado?
    needs_game_pid: bool,
}

const MODE_TABLE: [ModeRule; 3] = [
    ModeRule {
        mode: CaptureMode::ExcludeSelf,
        strategy: Strategy::ExcludeOwnProcessTree,
        needs_process_loopback: true,
        needs_game_pid: false,
    },
    ModeRule {
        mode: CaptureMode::Game,
        strategy: Strategy::IncludeTargetProcessTree,
        needs_process_loopback: true,
        needs_game_pid: true,
    },
    ModeRule {
        mode: CaptureMode::System,
        strategy: Strategy::SystemLoopback,
        needs_process_loopback: false,
        needs_game_pid: false,
    },
];

/// Estratégia escolhida e, quando houver, o PID alvo.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Selection {
    pub strategy: Strategy,
    pub pid: Option<u32>,
}

/// Escolhe a estratégia para o modo pedido.
///
/// `tracked_pid` é o PID que o hub já rastreia; ele NUNCA vem do front.
pub fn select(
    mode: CaptureMode,
    capability: Capability,
    tracked_pid: Option<u32>,
) -> Result<Selection, AudioCaptureError> {
    let rule = MODE_TABLE
        .iter()
        .find(|r| r.mode == mode)
        .expect("MODE_TABLE cobre todos os CaptureMode (garantido por teste)");

    if rule.needs_process_loopback {
        if let Some(err) = capability.as_error() {
            return Err(err);
        }
    }

    let pid = if rule.needs_game_pid {
        Some(tracked_pid.ok_or(AudioCaptureError::NoTrackedGame)?)
    } else {
        None
    };

    Ok(Selection { strategy: rule.strategy, pid })
}

/// O que `CaptureStream::read` encontrou.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ReadOutcome {
    /// Entraram amostras em `out` (pode ser menos que um pacote).
    Data,
    /// Nada novo dentro do tempo dado; o chamador aproveita para checar o stop.
    Timeout,
}

/// Uma captura aberta. Vive só na thread que a abriu (objetos COM não são `Send`),
/// por isso não exige `Send`. Ao ser derrubada ela para e libera o cliente de áudio.
pub trait CaptureStream {
    /// Espera até `timeout` por áudio e anexa as amostras (float32 estéreo
    /// 48 kHz intercalado) a `out`. Não pode bloquear além do `timeout`.
    fn read(
        &mut self,
        timeout: Duration,
        out: &mut Vec<f32>,
    ) -> Result<ReadOutcome, AudioCaptureError>;
}

/// Configuração de uma captura. É `Send` porque só carrega parâmetros: a captura
/// de fato (`open`) acontece dentro da thread dedicada.
pub trait AudioCaptureSource: Send {
    fn strategy(&self) -> Strategy;
    fn open(&mut self) -> Result<Box<dyn CaptureStream>, AudioCaptureError>;
}

#[cfg(test)]
mod tests {
    use super::*;

    const OK: Capability = Capability::Supported;

    #[test]
    fn table_covers_every_mode_exactly_once() {
        for mode in [CaptureMode::ExcludeSelf, CaptureMode::Game, CaptureMode::System] {
            let hits = MODE_TABLE.iter().filter(|r| r.mode == mode).count();
            assert_eq!(hits, 1, "{mode:?} deveria ter exatamente uma linha");
        }
    }

    #[test]
    fn exclude_self_uses_process_loopback_when_supported() {
        let s = select(CaptureMode::ExcludeSelf, OK, None).unwrap();
        assert_eq!(s, Selection { strategy: Strategy::ExcludeOwnProcessTree, pid: None });
    }

    #[test]
    fn game_mode_uses_the_tracked_pid() {
        let s = select(CaptureMode::Game, OK, Some(4242)).unwrap();
        assert_eq!(
            s,
            Selection { strategy: Strategy::IncludeTargetProcessTree, pid: Some(4242) }
        );
    }

    #[test]
    fn game_mode_without_a_tracked_game_is_an_error() {
        assert_eq!(select(CaptureMode::Game, OK, None), Err(AudioCaptureError::NoTrackedGame));
    }

    #[test]
    fn unsupported_build_never_falls_back_to_system_loopback_silently() {
        let cap = Capability::UnsupportedBuild { found: 19045 };
        for mode in [CaptureMode::ExcludeSelf, CaptureMode::Game] {
            let err = select(mode, cap, Some(1)).unwrap_err();
            assert_eq!(
                err,
                AudioCaptureError::UnsupportedBuild {
                    found: 19045,
                    required: MIN_PROCESS_LOOPBACK_BUILD
                },
                "{mode:?} deveria falhar, não trocar de estratégia"
            );
        }
    }

    #[test]
    fn activation_failure_is_reported_with_its_hresult() {
        let cap = Capability::ActivationFailed { hresult: 0x8000_4001 };
        assert_eq!(
            select(CaptureMode::ExcludeSelf, cap, None),
            Err(AudioCaptureError::ActivationFailed { hresult: 0x8000_4001 })
        );
    }

    #[test]
    fn explicit_system_mode_works_even_without_process_loopback() {
        let cap = Capability::UnsupportedBuild { found: 10240 };
        let s = select(CaptureMode::System, cap, None).unwrap();
        assert_eq!(s.strategy, Strategy::SystemLoopback);
    }

    #[test]
    fn system_loopback_is_never_chosen_for_the_other_modes() {
        for cap in [OK, Capability::UnsupportedBuild { found: 1 }, Capability::ActivationFailed { hresult: 1 }] {
            for mode in [CaptureMode::ExcludeSelf, CaptureMode::Game] {
                if let Ok(sel) = select(mode, cap, Some(9)) {
                    assert_ne!(sel.strategy, Strategy::SystemLoopback);
                }
            }
        }
    }

    #[test]
    fn mode_serializes_as_snake_case_for_the_front() {
        assert_eq!(serde_json::to_string(&CaptureMode::ExcludeSelf).unwrap(), "\"exclude_self\"");
        assert_eq!(serde_json::to_string(&CaptureMode::Game).unwrap(), "\"game\"");
    }

    #[test]
    fn capability_serializes_with_a_status_tag() {
        let json = serde_json::to_value(Capability::UnsupportedBuild { found: 19045 }).unwrap();
        assert_eq!(json["status"], "unsupported_build");
        assert_eq!(json["found"], 19045);
    }
}
