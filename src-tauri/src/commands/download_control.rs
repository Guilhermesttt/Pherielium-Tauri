//! Controle de um download em andamento: o sinal de pausar/cancelar e as contas de retomada.
//!
//! Tudo aqui é puro (sem rede nem disco), para poder ser testado. Quem baixa de verdade é
//! `nexus_download`, que consulta o sinal a cada pedaço recebido.

use std::sync::atomic::{AtomicU8, Ordering};

/// O que o download deve fazer a seguir.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Signal {
    Run,
    Pause,
    Cancel,
}

/// Sinal compartilhado entre os comandos da tela e o laço de download.
#[derive(Debug, Default)]
pub struct DownloadControl(AtomicU8);

impl DownloadControl {
    pub fn new() -> Self {
        Self(AtomicU8::new(0))
    }

    /// Cancelar vale mais que pausar: depois de cancelado, um pedido de pausa não desfaz o cancelamento.
    pub fn set(&self, signal: Signal) {
        let wanted = signal as u8;
        let mut current = self.0.load(Ordering::SeqCst);
        while current < wanted {
            match self.0.compare_exchange(current, wanted, Ordering::SeqCst, Ordering::SeqCst) {
                Ok(_) => return,
                Err(actual) => current = actual,
            }
        }
        // `Run` só volta a valer num download novo (um `DownloadControl` por tentativa)
    }

    pub fn get(&self) -> Signal {
        match self.0.load(Ordering::SeqCst) {
            1 => Signal::Pause,
            2 => Signal::Cancel,
            _ => Signal::Run,
        }
    }
}

/// O que fazer com a resposta quando pedimos "continue a partir do byte N".
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RangePlan {
    /// Nada baixado ainda: começa do zero.
    Fresh,
    /// O servidor aceitou o pedido (206): acrescenta ao arquivo parcial.
    Append,
    /// O servidor ignorou o pedido (200) ou recusou (416): o parcial não serve, recomeça.
    Restart,
}

pub fn range_plan(requested_from: u64, status: u16) -> RangePlan {
    if requested_from == 0 {
        return RangePlan::Fresh;
    }
    if status == 206 {
        RangePlan::Append
    } else {
        RangePlan::Restart
    }
}

/// Tamanho total em `Content-Range: bytes 100-999/1000`. `*` (desconhecido) devolve `None`.
pub fn content_range_total(header: &str) -> Option<u64> {
    let total = header.trim().rsplit('/').next()?.trim();
    total.parse().ok()
}

/// Bytes por segundo entre duas leituras. Intervalo zero ou contador que andou para trás dão 0.
pub fn speed_bps(previous_bytes: u64, previous_ms: u64, bytes: u64, now_ms: u64) -> u64 {
    let elapsed = now_ms.saturating_sub(previous_ms);
    if elapsed == 0 || bytes < previous_bytes {
        return 0;
    }
    (bytes - previous_bytes).saturating_mul(1000) / elapsed
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_fresh_control_runs() {
        assert_eq!(DownloadControl::new().get(), Signal::Run);
    }

    #[test]
    fn pause_and_cancel_are_seen_by_the_download_loop() {
        let control = DownloadControl::new();
        control.set(Signal::Pause);
        assert_eq!(control.get(), Signal::Pause);
        control.set(Signal::Cancel);
        assert_eq!(control.get(), Signal::Cancel);
    }

    #[test]
    fn a_pause_after_a_cancel_does_not_undo_the_cancel() {
        let control = DownloadControl::new();
        control.set(Signal::Cancel);
        control.set(Signal::Pause);
        control.set(Signal::Run);
        assert_eq!(control.get(), Signal::Cancel);
    }

    #[test]
    fn resuming_from_zero_is_a_fresh_download() {
        assert_eq!(range_plan(0, 200), RangePlan::Fresh);
        assert_eq!(range_plan(0, 206), RangePlan::Fresh);
    }

    #[test]
    fn resume_appends_only_when_the_server_answers_206() {
        assert_eq!(range_plan(1024, 206), RangePlan::Append);
        // o CDN ignorou o Range e mandou o arquivo inteiro: anexar corromperia o arquivo
        assert_eq!(range_plan(1024, 200), RangePlan::Restart);
        assert_eq!(range_plan(1024, 416), RangePlan::Restart);
    }

    #[test]
    fn reads_the_total_from_content_range() {
        assert_eq!(content_range_total("bytes 100-999/1000"), Some(1000));
        assert_eq!(content_range_total(" bytes 0-0/7 "), Some(7));
        assert_eq!(content_range_total("bytes 0-99/*"), None);
        assert_eq!(content_range_total("lixo"), None);
    }

    #[test]
    fn speed_is_bytes_per_second_and_never_negative() {
        assert_eq!(speed_bps(0, 0, 500_000, 500), 1_000_000);
        assert_eq!(speed_bps(1000, 100, 1000, 100), 0);
        assert_eq!(speed_bps(2000, 0, 1000, 500), 0);
    }
}
