//! Buffer circular SPSC (um produtor, um consumidor) lock-free de amostras f32.
//!
//! A thread de captura é a única produtora e a thread de envio é a única
//! consumidora. Nenhum lado toma lock nem bloqueia: a captura nunca espera o
//! IPC, e um consumidor lento só faz o ring encher — as amostras que não cabem
//! são descartadas e contadas (`overruns`), em vez de travar a captura do
//! Windows (que perderia pacotes de qualquer jeito).
//!
//! ## Invariantes do `unsafe`
//! - `head` só é escrito pelo `Producer`; `tail` só pelo `Consumer`.
//! - O produtor só escreve em slots que o consumidor já liberou
//!   (`head - tail < capacidade`); o consumidor só lê slots que o produtor já
//!   publicou (`head - tail > 0`). Então nenhum slot é lido e escrito ao mesmo
//!   tempo.
//! - A publicação é `Release` no escritor do índice e `Acquire` no leitor: as
//!   escritas nos slots acontecem-antes da leitura deles.
//! - `Producer` e `Consumer` não são `Clone`: a unicidade de cada papel é
//!   garantida pelo sistema de tipos.

use std::cell::UnsafeCell;
use std::sync::atomic::{AtomicU64, AtomicUsize, Ordering};
use std::sync::Arc;

struct Shared {
    buf: Box<[UnsafeCell<f32>]>,
    mask: usize,
    /// Próximo índice de escrita (monotônico, com wrapping).
    head: AtomicUsize,
    /// Próximo índice de leitura (monotônico, com wrapping).
    tail: AtomicUsize,
    overrun_samples: AtomicU64,
    underruns: AtomicU64,
}

// SAFETY: os únicos acessos aos `UnsafeCell` seguem as invariantes do módulo
// (slots disjuntos entre produtor e consumidor, ordenados por Release/Acquire).
unsafe impl Sync for Shared {}

pub struct Producer {
    shared: Arc<Shared>,
}

pub struct Consumer {
    shared: Arc<Shared>,
}

/// Métricas lidas de qualquer lado.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct RingStats {
    /// Amostras descartadas porque o ring estava cheio.
    pub overrun_samples: u64,
    /// Vezes que o consumidor pediu mais do que havia.
    pub underruns: u64,
}

/// Cria um ring com `capacity` amostras (arredondada para a próxima potência de dois).
pub fn ring(capacity: usize) -> (Producer, Consumer) {
    let cap = capacity.max(2).next_power_of_two();
    let buf: Box<[UnsafeCell<f32>]> = (0..cap).map(|_| UnsafeCell::new(0.0)).collect();
    let shared = Arc::new(Shared {
        buf,
        mask: cap - 1,
        head: AtomicUsize::new(0),
        tail: AtomicUsize::new(0),
        overrun_samples: AtomicU64::new(0),
        underruns: AtomicU64::new(0),
    });
    (Producer { shared: shared.clone() }, Consumer { shared })
}

impl Producer {
    pub fn capacity(&self) -> usize {
        self.shared.buf.len()
    }

    /// Escreve o que couber e devolve quantas amostras entraram. O excedente é
    /// descartado e contado em `overrun_samples`.
    pub fn push_slice(&mut self, src: &[f32]) -> usize {
        let s = &*self.shared;
        let head = s.head.load(Ordering::Relaxed); // só este lado escreve `head`
        let tail = s.tail.load(Ordering::Acquire);
        let used = head.wrapping_sub(tail);
        let free = s.buf.len() - used;
        let n = free.min(src.len());
        for (i, sample) in src[..n].iter().enumerate() {
            let idx = head.wrapping_add(i) & s.mask;
            // SAFETY: `idx` está entre `head` e `head + free`, slots que o
            // consumidor já liberou e que ele não lê antes do Release abaixo.
            unsafe { *s.buf[idx].get() = *sample };
        }
        s.head.store(head.wrapping_add(n), Ordering::Release);
        if n < src.len() {
            s.overrun_samples.fetch_add((src.len() - n) as u64, Ordering::Relaxed);
        }
        n
    }

    pub fn stats(&self) -> RingStats {
        stats_of(&self.shared)
    }
}

impl Consumer {
    /// Amostras disponíveis agora.
    pub fn available(&self) -> usize {
        let s = &*self.shared;
        s.head.load(Ordering::Acquire).wrapping_sub(s.tail.load(Ordering::Relaxed))
    }

    /// Lê até `dst.len()` amostras e devolve quantas leu.
    pub fn pop_slice(&mut self, dst: &mut [f32]) -> usize {
        let s = &*self.shared;
        let tail = s.tail.load(Ordering::Relaxed); // só este lado escreve `tail`
        let head = s.head.load(Ordering::Acquire);
        let avail = head.wrapping_sub(tail);
        let n = avail.min(dst.len());
        for (i, slot) in dst[..n].iter_mut().enumerate() {
            let idx = tail.wrapping_add(i) & s.mask;
            // SAFETY: `idx` está entre `tail` e `head`, slots já publicados pelo
            // produtor (Acquire acima) e que ele não reescreve antes do Release abaixo.
            *slot = unsafe { *s.buf[idx].get() };
        }
        s.tail.store(tail.wrapping_add(n), Ordering::Release);
        n
    }

    /// Lê exatamente `dst.len()` amostras ou nada. Se faltar, conta um underrun.
    pub fn pop_exact(&mut self, dst: &mut [f32]) -> bool {
        if self.available() < dst.len() {
            self.shared.underruns.fetch_add(1, Ordering::Relaxed);
            return false;
        }
        self.pop_slice(dst);
        true
    }

    pub fn stats(&self) -> RingStats {
        stats_of(&self.shared)
    }
}

fn stats_of(s: &Shared) -> RingStats {
    RingStats {
        overrun_samples: s.overrun_samples.load(Ordering::Relaxed),
        underruns: s.underruns.load(Ordering::Relaxed),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn capacity_rounds_up_to_power_of_two() {
        let (p, _c) = ring(1000);
        assert_eq!(p.capacity(), 1024);
    }

    #[test]
    fn keeps_order() {
        let (mut p, mut c) = ring(8);
        assert_eq!(p.push_slice(&[1.0, 2.0, 3.0]), 3);
        let mut out = [0.0; 3];
        assert!(c.pop_exact(&mut out));
        assert_eq!(out, [1.0, 2.0, 3.0]);
    }

    #[test]
    fn wraps_around_the_end() {
        let (mut p, mut c) = ring(4);
        let mut out = [0.0; 3];
        for round in 0..20 {
            let base = round as f32 * 10.0;
            assert_eq!(p.push_slice(&[base, base + 1.0, base + 2.0]), 3);
            assert!(c.pop_exact(&mut out));
            assert_eq!(out, [base, base + 1.0, base + 2.0], "rodada {round}");
        }
    }

    #[test]
    fn overrun_drops_the_excess_and_counts_it() {
        let (mut p, mut c) = ring(4);
        assert_eq!(p.push_slice(&[1.0, 2.0, 3.0, 4.0, 5.0, 6.0]), 4);
        assert_eq!(p.stats().overrun_samples, 2);
        // o que entrou continua íntegro e na ordem
        let mut out = [0.0; 4];
        assert!(c.pop_exact(&mut out));
        assert_eq!(out, [1.0, 2.0, 3.0, 4.0]);
    }

    #[test]
    fn underrun_is_counted_and_nothing_is_consumed() {
        let (mut p, mut c) = ring(8);
        p.push_slice(&[1.0, 2.0]);
        let mut out = [0.0; 4];
        assert!(!c.pop_exact(&mut out));
        assert_eq!(c.stats().underruns, 1);
        assert_eq!(c.available(), 2, "um pop que falha não pode consumir nada");
    }

    #[test]
    fn partial_pop_returns_what_exists() {
        let (mut p, mut c) = ring(8);
        p.push_slice(&[7.0, 8.0]);
        let mut out = [0.0; 5];
        assert_eq!(c.pop_slice(&mut out), 2);
        assert_eq!(&out[..2], &[7.0, 8.0]);
    }

    #[test]
    fn survives_a_producer_and_a_consumer_on_different_threads() {
        const TOTAL: usize = 200_000;
        let (mut p, mut c) = ring(256);

        let producer = std::thread::spawn(move || {
            let mut next = 0usize;
            while next < TOTAL {
                let end = (next + 37).min(TOTAL);
                let chunk: Vec<f32> = (next..end).map(|v| v as f32).collect();
                let pushed = p.push_slice(&chunk);
                next += pushed;
                if pushed == 0 {
                    std::thread::yield_now();
                }
            }
        });

        let mut expected = 0usize;
        let mut buf = [0.0f32; 64];
        while expected < TOTAL {
            let n = c.pop_slice(&mut buf);
            for v in &buf[..n] {
                assert_eq!(*v as usize, expected, "ordem quebrada ou amostra perdida");
                expected += 1;
            }
            if n == 0 {
                std::thread::yield_now();
            }
        }
        producer.join().unwrap();
    }
}
