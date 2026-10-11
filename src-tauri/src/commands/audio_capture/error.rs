//! Erros tipados da captura de áudio do compartilhamento de tela.
//!
//! Cada variante tem um `code` estável: o front decide a mensagem e a ação
//! (tentar de novo, oferecer o fallback, avisar do vazamento) pelo código, não
//! por texto. O texto em português aqui é só o que aparece no log.

use serde::{Serialize, Serializer};
use thiserror::Error;

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum AudioCaptureError {
    #[error("A captura de áudio por processo exige o Windows build {required} ou superior (este é o {found}).")]
    UnsupportedBuild { found: u32, required: u32 },

    #[error("O Windows recusou a captura de áudio por processo (HRESULT {hresult:#010x}).")]
    ActivationFailed { hresult: u32 },

    #[error("Tempo esgotado ao ativar a captura de áudio por processo.")]
    ActivationTimeout,

    #[error("O dispositivo recusou o formato de áudio {format} (HRESULT {hresult:#010x}).")]
    FormatRejected { format: &'static str, hresult: u32 },

    #[error("Falha na API de áudio do Windows em {call} (HRESULT {hresult:#010x}).")]
    Windows { call: &'static str, hresult: u32 },

    /// O dispositivo de saída foi removido ou trocado no meio da captura.
    #[error("O dispositivo de áudio foi desconectado ou trocado.")]
    DeviceInvalidated,

    #[error("Já existe uma captura de áudio em andamento.")]
    AlreadyRunning,

    #[error("Não há captura de áudio em andamento.")]
    NotRunning,

    #[error("Nenhum jogo está sendo rastreado: o áudio só do jogo precisa de um jogo em execução.")]
    NoTrackedGame,

    #[error("Não foi possível criar a thread de captura de áudio: {0}")]
    Thread(String),

    #[error("A captura de áudio por processo existe apenas no Windows.")]
    PlatformUnsupported,

    #[error("Este diagnóstico existe apenas em builds de desenvolvimento.")]
    DebugOnly,
}

impl AudioCaptureError {
    /// Código estável para o front. Não mude um valor existente: a UI depende dele.
    pub fn code(&self) -> &'static str {
        match self {
            Self::UnsupportedBuild { .. } => "unsupported_build",
            Self::ActivationFailed { .. } => "activation_failed",
            Self::ActivationTimeout => "activation_timeout",
            Self::FormatRejected { .. } => "format_rejected",
            Self::Windows { .. } => "windows_api",
            Self::DeviceInvalidated => "device_invalidated",
            Self::AlreadyRunning => "already_running",
            Self::NotRunning => "not_running",
            Self::NoTrackedGame => "no_tracked_game",
            Self::Thread(_) => "thread",
            Self::PlatformUnsupported => "platform_unsupported",
            Self::DebugOnly => "debug_only",
        }
    }
}

/// O Tauri exige `Serialize` no erro de um comando. Sai como `{ code, message }`.
impl Serialize for AudioCaptureError {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        use serde::ser::SerializeStruct;
        let mut state = serializer.serialize_struct("AudioCaptureError", 2)?;
        state.serialize_field("code", self.code())?;
        state.serialize_field("message", &self.to_string())?;
        state.end()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializes_as_code_and_message() {
        let err = AudioCaptureError::ActivationFailed { hresult: 0x8000_4001 };
        let json = serde_json::to_value(&err).unwrap();
        assert_eq!(json["code"], "activation_failed");
        assert!(json["message"].as_str().unwrap().contains("0x80004001"));
    }

    #[test]
    fn every_variant_has_a_distinct_code() {
        let all = [
            AudioCaptureError::UnsupportedBuild { found: 1, required: 2 },
            AudioCaptureError::ActivationFailed { hresult: 0 },
            AudioCaptureError::ActivationTimeout,
            AudioCaptureError::FormatRejected { format: "f32", hresult: 0 },
            AudioCaptureError::Windows { call: "x", hresult: 0 },
            AudioCaptureError::DeviceInvalidated,
            AudioCaptureError::AlreadyRunning,
            AudioCaptureError::NotRunning,
            AudioCaptureError::NoTrackedGame,
            AudioCaptureError::Thread(String::new()),
            AudioCaptureError::PlatformUnsupported,
            AudioCaptureError::DebugOnly,
        ];
        let mut codes: Vec<_> = all.iter().map(|e| e.code()).collect();
        codes.sort_unstable();
        let before = codes.len();
        codes.dedup();
        assert_eq!(codes.len(), before, "dois erros com o mesmo code");
    }
}
