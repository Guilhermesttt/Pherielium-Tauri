//! Sessão de captura: duas threads ligadas por um ring lock-free, com limpeza
//! garantida por `Drop`.
//!
//! ```text
//!  [thread de captura]  --push--> [ring SPSC] --pop--> [thread de envio] --> sink
//!   open + read(evento)           f32 estéreo           pacotes de 10 ms
//! ```
//!
//! - A thread de captura nunca espera o IPC: se o envio atrasar, o ring enche e
//!   as amostras excedentes são descartadas e contadas.
//! - A thread de envio dorme em `park_timeout` e é acordada pela captura
//!   (`unpark`) a cada push — nada de laço com `sleep`.
//! - Parar, soltar a sessão ou dar panic em qualquer uma das threads encerra as
//!   duas, devolve o cliente de áudio e junta as threads (`Drop`).

use parking_lot::Mutex;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::mpsc::{self, RecvTimeoutError};
use std::sync::Arc;
use std::thread::{self, JoinHandle, Thread};
use std::time::{Duration, Instant};

use super::error::AudioCaptureError;
use super::format::PACKET_SAMPLES;
use super::packet::{encode, PacketHeader};
use super::ring::{ring, Consumer, Producer, RingStats};
use super::source::{AudioCaptureSource, CaptureStream, ReadOutcome};

/// Capacidade do ring em pacotes (16 × 10 ms = 160 ms de folga para o envio).
const RING_PACKETS: usize = 16;
/// Quanto cada `read` espera antes de devolver o controle para checar o stop.
const READ_TIMEOUT: Duration = Duration::from_millis(50);
/// Quanto esperar a captura abrir antes de desistir.
const OPEN_TIMEOUT: Duration = Duration::from_secs(6);
/// Sono máximo da thread de envio sem pacote completo.
const PUMP_PARK: Duration = Duration::from_millis(5);

/// Destino dos pacotes. Devolve `false` quando o receptor sumiu: a sessão encerra.
pub type PacketSink = Box<dyn FnMut(Vec<u8>) -> bool + Send>;

// ── Máquina de estados ──────────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SessionState {
    Idle,
    Starting,
    Running,
    Stopping,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SessionEvent {
    Start,
    Opened,
    OpenFailed,
    Stop,
    Stopped,
}

/// Transições válidas. `None` = transição inválida para o estado atual.
pub fn transition(state: SessionState, event: SessionEvent) -> Option<SessionState> {
    use SessionEvent as E;
    use SessionState as S;
    match (state, event) {
        (S::Idle, E::Start) => Some(S::Starting),
        (S::Starting, E::Opened) => Some(S::Running),
        (S::Starting, E::OpenFailed) => Some(S::Idle),
        (S::Starting, E::Stop) | (S::Running, E::Stop) => Some(S::Stopping),
        (S::Stopping, E::Stopped) => Some(S::Idle),
        _ => None,
    }
}

// ── Métricas ────────────────────────────────────────────────────────────────

#[derive(Default)]
struct Metrics {
    packets: AtomicU64,
    read_timeouts: AtomicU64,
    overrun_samples: AtomicU64,
    ring_underruns: AtomicU64,
}

/// Resumo entregue ao parar.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SessionReport {
    pub packets: u64,
    /// Leituras sem áudio novo (silêncio é normal; muitas seguidas com algo
    /// tocando indicam travamento).
    pub read_timeouts: u64,
    pub ring: RingStats,
    /// Erro que encerrou a captura por conta própria (dispositivo removido etc.).
    pub ended_with: Option<AudioCaptureError>,
}

// ── Sessão ──────────────────────────────────────────────────────────────────

pub struct CaptureSession {
    stop: Arc<AtomicBool>,
    capture: Option<JoinHandle<()>>,
    pump: Option<JoinHandle<()>>,
    metrics: Arc<Metrics>,
    end_reason: Arc<Mutex<Option<AudioCaptureError>>>,
}

/// Ao ser derrubado (inclusive durante um panic), encerra a sessão e acorda a
/// thread de envio, para ela não ficar esperando um ring que nunca mais enche.
struct StopOnDrop {
    stop: Arc<AtomicBool>,
    pump: Thread,
}

impl Drop for StopOnDrop {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::Release);
        self.pump.unpark();
    }
}

impl CaptureSession {
    pub fn start(
        source: Box<dyn AudioCaptureSource>,
        sink: PacketSink,
    ) -> Result<Self, AudioCaptureError> {
        Self::start_with_timeout(source, sink, OPEN_TIMEOUT)
    }

    pub fn start_with_timeout(
        source: Box<dyn AudioCaptureSource>,
        sink: PacketSink,
        open_timeout: Duration,
    ) -> Result<Self, AudioCaptureError> {
        let (producer, consumer) = ring(PACKET_SAMPLES * RING_PACKETS);
        let stop = Arc::new(AtomicBool::new(false));
        let metrics = Arc::new(Metrics::default());
        let end_reason = Arc::new(Mutex::new(None));

        let pump = {
            let stop = stop.clone();
            let metrics = metrics.clone();
            thread::Builder::new()
                .name("audio-capture-pump".into())
                .spawn(move || pump_loop(consumer, sink, stop, metrics))
                .map_err(|e| AudioCaptureError::Thread(e.to_string()))?
        };
        let pump_thread = pump.thread().clone();

        let (open_tx, open_rx) = mpsc::channel::<Result<(), AudioCaptureError>>();
        let capture = {
            let stop = stop.clone();
            let metrics = metrics.clone();
            let end_reason = end_reason.clone();
            let pump_thread = pump_thread.clone();
            thread::Builder::new()
                .name("audio-capture".into())
                .spawn(move || {
                    capture_loop(source, producer, pump_thread, stop, metrics, end_reason, open_tx)
                })
        };
        let capture = match capture {
            Ok(handle) => handle,
            Err(err) => {
                stop.store(true, Ordering::Release);
                pump_thread.unpark();
                let _ = pump.join();
                return Err(AudioCaptureError::Thread(err.to_string()));
            }
        };

        let mut session = CaptureSession {
            stop,
            capture: Some(capture),
            pump: Some(pump),
            metrics,
            end_reason,
        };

        match open_rx.recv_timeout(open_timeout) {
            Ok(Ok(())) => Ok(session),
            Ok(Err(err)) => {
                // A thread de captura já saiu sozinha; só falta juntar.
                session.shutdown();
                Err(err)
            }
            Err(RecvTimeoutError::Timeout) => {
                // `open` travou (driver/COM). Não dá para juntar uma thread presa:
                // sinaliza o stop e solta as threads; quando `open` voltar ela vê
                // o stop e sai sem entrar no laço.
                session.stop.store(true, Ordering::Release);
                pump_thread.unpark();
                session.capture.take();
                session.pump.take();
                Err(AudioCaptureError::ActivationTimeout)
            }
            Err(RecvTimeoutError::Disconnected) => {
                session.shutdown();
                Err(AudioCaptureError::Thread(
                    "a thread de captura terminou antes de abrir o áudio".into(),
                ))
            }
        }
    }

    /// A captura terminou sozinha (erro ou receptor sumiu)?
    pub fn has_ended(&self) -> bool {
        self.stop.load(Ordering::Acquire)
    }

    /// Para, junta as threads e devolve o resumo. Idempotente.
    pub fn stop(mut self) -> SessionReport {
        self.shutdown()
    }

    fn shutdown(&mut self) -> SessionReport {
        self.stop.store(true, Ordering::Release);
        if let Some(pump) = &self.pump {
            pump.thread().unpark();
        }
        // Junta a captura primeiro: é ela que solta o cliente de áudio. Um panic
        // em qualquer thread aparece como `Err` aqui e não propaga.
        if let Some(handle) = self.capture.take() {
            let _ = handle.join();
        }
        if let Some(handle) = self.pump.take() {
            let _ = handle.join();
        }
        SessionReport {
            packets: self.metrics.packets.load(Ordering::Relaxed),
            read_timeouts: self.metrics.read_timeouts.load(Ordering::Relaxed),
            ring: RingStats {
                overrun_samples: self.metrics.overrun_samples.load(Ordering::Relaxed),
                underruns: self.metrics.ring_underruns.load(Ordering::Relaxed),
            },
            ended_with: self.end_reason.lock().clone(),
        }
    }
}

impl Drop for CaptureSession {
    fn drop(&mut self) {
        self.shutdown();
    }
}

fn capture_loop(
    mut source: Box<dyn AudioCaptureSource>,
    mut producer: Producer,
    pump: Thread,
    stop: Arc<AtomicBool>,
    metrics: Arc<Metrics>,
    end_reason: Arc<Mutex<Option<AudioCaptureError>>>,
    open_tx: mpsc::Sender<Result<(), AudioCaptureError>>,
) {
    // Garante o stop mesmo se esta thread morrer por panic.
    let _guard = StopOnDrop { stop: stop.clone(), pump };

    let mut stream: Box<dyn CaptureStream> = match source.open() {
        Ok(stream) => {
            let _ = open_tx.send(Ok(()));
            stream
        }
        Err(err) => {
            let _ = open_tx.send(Err(err));
            return;
        }
    };

    let mut scratch: Vec<f32> = Vec::with_capacity(PACKET_SAMPLES * 2);
    while !stop.load(Ordering::Acquire) {
        scratch.clear();
        match stream.read(READ_TIMEOUT, &mut scratch) {
            Ok(ReadOutcome::Data) => {
                if !scratch.is_empty() {
                    producer.push_slice(&scratch);
                    _guard.pump.unpark();
                }
            }
            Ok(ReadOutcome::Timeout) => {
                metrics.read_timeouts.fetch_add(1, Ordering::Relaxed);
            }
            Err(err) => {
                *end_reason.lock() = Some(err);
                break;
            }
        }
    }
    metrics
        .overrun_samples
        .store(producer.stats().overrun_samples, Ordering::Relaxed);
    // `stream` cai aqui: para o cliente de áudio e devolve os recursos do Windows.
}

fn pump_loop(
    mut consumer: Consumer,
    mut sink: PacketSink,
    stop: Arc<AtomicBool>,
    metrics: Arc<Metrics>,
) {
    let started = Instant::now();
    let mut seq: u32 = 0;
    let mut block = vec![0.0f32; PACKET_SAMPLES];

    while !stop.load(Ordering::Acquire) {
        if consumer.available() >= PACKET_SAMPLES {
            consumer.pop_slice(&mut block);
            let header = PacketHeader {
                seq,
                ts_ms: started.elapsed().as_millis() as u32,
            };
            seq = seq.wrapping_add(1);
            metrics.packets.fetch_add(1, Ordering::Relaxed);
            if !sink(encode(header, &block)) {
                // O receptor sumiu (janela fechada, canal descartado).
                stop.store(true, Ordering::Release);
                break;
            }
        } else {
            thread::park_timeout(PUMP_PARK);
        }
    }
    metrics
        .ring_underruns
        .store(consumer.stats().underruns, Ordering::Relaxed);
}

// ── Gerenciador (uma sessão por vez) ────────────────────────────────────────

#[derive(Default)]
struct ManagerInner {
    state: Option<SessionState>,
    session: Option<CaptureSession>,
}

/// Guarda a única sessão ativa. Fica no estado do Tauri.
#[derive(Default)]
pub struct CaptureManager {
    inner: Mutex<ManagerInner>,
}

impl CaptureManager {
    pub fn state(&self) -> SessionState {
        self.inner.lock().state.unwrap_or(SessionState::Idle)
    }

    /// Abre a captura. Segura o lock até abrir (alguns instantes), então um
    /// `start` concorrente recebe `AlreadyRunning` em vez de abrir duas.
    pub fn start(
        &self,
        source: Box<dyn AudioCaptureSource>,
        sink: PacketSink,
    ) -> Result<(), AudioCaptureError> {
        let mut inner = self.inner.lock();
        // Uma sessão que se encerrou sozinha (erro, receptor sumiu) não pode
        // bloquear a próxima: recolhe e segue.
        if inner.session.as_ref().is_some_and(|s| s.has_ended()) {
            if let Some(old) = inner.session.take() {
                old.stop();
            }
            inner.state = Some(SessionState::Idle);
        }
        let current = inner.state.unwrap_or(SessionState::Idle);
        let starting = transition(current, SessionEvent::Start)
            .ok_or(AudioCaptureError::AlreadyRunning)?;
        inner.state = Some(starting);

        match CaptureSession::start(source, sink) {
            Ok(session) => {
                inner.state = transition(starting, SessionEvent::Opened);
                inner.session = Some(session);
                Ok(())
            }
            Err(err) => {
                inner.state = transition(starting, SessionEvent::OpenFailed);
                Err(err)
            }
        }
    }

    /// Para a sessão, se houver. Sem sessão devolve `None` (idempotente).
    pub fn stop(&self) -> Option<SessionReport> {
        let mut inner = self.inner.lock();
        let session = inner.session.take()?;
        let current = inner.state.unwrap_or(SessionState::Idle);
        inner.state = transition(current, SessionEvent::Stop);
        let report = session.stop();
        inner.state = inner
            .state
            .and_then(|s| transition(s, SessionEvent::Stopped));
        Some(report)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::audio_capture::packet::decode;
    use crate::commands::audio_capture::source::Strategy;
    use std::sync::atomic::AtomicUsize;

    // ── máquina de estados ──

    #[test]
    fn happy_path_walks_the_whole_cycle() {
        use SessionEvent as E;
        use SessionState as S;
        let mut s = S::Idle;
        for (event, expected) in [
            (E::Start, S::Starting),
            (E::Opened, S::Running),
            (E::Stop, S::Stopping),
            (E::Stopped, S::Idle),
        ] {
            s = transition(s, event).unwrap_or_else(|| panic!("{event:?} inválido em {s:?}"));
            assert_eq!(s, expected);
        }
    }

    #[test]
    fn failed_open_returns_to_idle() {
        assert_eq!(
            transition(SessionState::Starting, SessionEvent::OpenFailed),
            Some(SessionState::Idle)
        );
    }

    #[test]
    fn invalid_transitions_are_rejected() {
        use SessionEvent as E;
        use SessionState as S;
        assert_eq!(transition(S::Running, E::Start), None, "start duplo");
        assert_eq!(transition(S::Starting, E::Start), None);
        assert_eq!(transition(S::Idle, E::Stop), None, "stop sem start");
        assert_eq!(transition(S::Idle, E::Stopped), None);
        assert_eq!(transition(S::Running, E::Opened), None);
        assert_eq!(transition(S::Stopping, E::Start), None);
    }

    // ── fonte falsa ──

    struct FakeSource {
        fail: Option<AudioCaptureError>,
        released: Arc<AtomicUsize>,
        read_len: usize,
        open_delay: Duration,
    }

    impl FakeSource {
        fn ok(released: &Arc<AtomicUsize>) -> Box<Self> {
            Box::new(Self {
                fail: None,
                released: released.clone(),
                read_len: 1000, // de propósito não alinhado a 960
                open_delay: Duration::ZERO,
            })
        }
    }

    impl AudioCaptureSource for FakeSource {
        fn strategy(&self) -> Strategy {
            Strategy::SystemLoopback
        }
        fn open(&mut self) -> Result<Box<dyn CaptureStream>, AudioCaptureError> {
            thread::sleep(self.open_delay);
            if let Some(err) = self.fail.take() {
                return Err(err);
            }
            Ok(Box::new(FakeStream {
                next: 0,
                read_len: self.read_len,
                released: self.released.clone(),
            }))
        }
    }

    struct FakeStream {
        next: usize,
        read_len: usize,
        released: Arc<AtomicUsize>,
    }

    impl CaptureStream for FakeStream {
        fn read(
            &mut self,
            _timeout: Duration,
            out: &mut Vec<f32>,
        ) -> Result<ReadOutcome, AudioCaptureError> {
            thread::sleep(Duration::from_millis(1));
            for i in 0..self.read_len {
                out.push((self.next + i) as f32);
            }
            self.next += self.read_len;
            Ok(ReadOutcome::Data)
        }
    }

    impl Drop for FakeStream {
        fn drop(&mut self) {
            self.released.fetch_add(1, Ordering::SeqCst);
        }
    }

    type Collected = Arc<Mutex<Vec<Vec<u8>>>>;

    fn collecting_sink() -> (PacketSink, Collected) {
        let store: Collected = Arc::new(Mutex::new(Vec::new()));
        let writer = store.clone();
        (
            Box::new(move |packet| {
                writer.lock().push(packet);
                true
            }),
            store,
        )
    }

    fn wait_until(what: &str, mut cond: impl FnMut() -> bool) {
        let deadline = Instant::now() + Duration::from_secs(5);
        while !cond() {
            assert!(Instant::now() < deadline, "tempo esgotado esperando: {what}");
            thread::sleep(Duration::from_millis(2));
        }
    }

    // ── comportamento ──

    #[test]
    fn packets_arrive_in_order_and_samples_are_continuous() {
        let released = Arc::new(AtomicUsize::new(0));
        let manager = CaptureManager::default();
        let (sink, store) = collecting_sink();
        manager.start(FakeSource::ok(&released), sink).unwrap();
        assert_eq!(manager.state(), SessionState::Running);

        wait_until("20 pacotes", || store.lock().len() >= 20);
        let report = manager.stop().expect("havia sessão");
        assert_eq!(report.ring.overrun_samples, 0, "ring não deveria encher neste teste");

        let packets = store.lock();
        let mut expected_sample = 0usize;
        let mut last_ts = 0u32;
        for (i, raw) in packets.iter().enumerate() {
            let (header, samples) = decode(raw).unwrap();
            assert_eq!(header.seq as usize, i, "seq fora de ordem");
            assert!(header.ts_ms >= last_ts, "ts andou para trás");
            last_ts = header.ts_ms;
            assert_eq!(samples.len(), PACKET_SAMPLES);
            for s in samples {
                assert_eq!(s as usize, expected_sample, "amostra perdida ou repetida");
                expected_sample += 1;
            }
        }
    }

    #[test]
    fn stop_releases_the_stream_and_joins_the_threads() {
        let released = Arc::new(AtomicUsize::new(0));
        let manager = CaptureManager::default();
        let (sink, _store) = collecting_sink();
        manager.start(FakeSource::ok(&released), sink).unwrap();
        assert_eq!(released.load(Ordering::SeqCst), 0);

        assert!(manager.stop().is_some());
        assert_eq!(released.load(Ordering::SeqCst), 1, "o cliente de áudio não foi liberado");
        assert_eq!(manager.state(), SessionState::Idle);
    }

    #[test]
    fn stop_without_start_is_a_harmless_none() {
        let manager = CaptureManager::default();
        assert!(manager.stop().is_none());
        assert_eq!(manager.state(), SessionState::Idle);
    }

    #[test]
    fn second_start_is_refused_and_does_not_open_a_second_stream() {
        let released = Arc::new(AtomicUsize::new(0));
        let manager = CaptureManager::default();
        let (sink, _a) = collecting_sink();
        manager.start(FakeSource::ok(&released), sink).unwrap();

        let (sink2, _b) = collecting_sink();
        let err = manager.start(FakeSource::ok(&released), sink2).unwrap_err();
        assert_eq!(err, AudioCaptureError::AlreadyRunning);

        manager.stop();
        assert_eq!(released.load(Ordering::SeqCst), 1, "só uma stream deveria ter existido");
    }

    #[test]
    fn failed_open_leaves_the_manager_ready_for_the_next_start() {
        let released = Arc::new(AtomicUsize::new(0));
        let manager = CaptureManager::default();

        let mut bad = FakeSource::ok(&released);
        bad.fail = Some(AudioCaptureError::ActivationFailed { hresult: 0x8000_4001 });
        let (sink, _s) = collecting_sink();
        assert_eq!(
            manager.start(bad, sink).unwrap_err(),
            AudioCaptureError::ActivationFailed { hresult: 0x8000_4001 }
        );
        assert_eq!(manager.state(), SessionState::Idle);

        let (sink2, store2) = collecting_sink();
        manager.start(FakeSource::ok(&released), sink2).unwrap();
        wait_until("pacote depois da falha", || !store2.lock().is_empty());
        manager.stop();
    }

    #[test]
    fn restarting_many_times_leaks_no_stream() {
        let released = Arc::new(AtomicUsize::new(0));
        let manager = CaptureManager::default();
        for _ in 0..25 {
            let (sink, _s) = collecting_sink();
            manager.start(FakeSource::ok(&released), sink).unwrap();
            assert!(manager.stop().is_some());
        }
        assert_eq!(released.load(Ordering::SeqCst), 25, "cada start deve ter um release");
    }

    #[test]
    fn dropping_the_session_cleans_up_like_stop() {
        let released = Arc::new(AtomicUsize::new(0));
        let (sink, _s) = collecting_sink();
        let session = CaptureSession::start(FakeSource::ok(&released), sink).unwrap();
        drop(session);
        assert_eq!(released.load(Ordering::SeqCst), 1);
    }

    #[test]
    fn a_vanished_receiver_ends_the_session_by_itself() {
        let released = Arc::new(AtomicUsize::new(0));
        let manager = CaptureManager::default();
        let seen = Arc::new(AtomicUsize::new(0));
        let counter = seen.clone();
        let sink: PacketSink = Box::new(move |_| counter.fetch_add(1, Ordering::SeqCst) < 2);
        manager.start(FakeSource::ok(&released), sink).unwrap();

        wait_until("a sessão se encerrar sozinha", || {
            released.load(Ordering::SeqCst) == 1
        });
        // e um novo start funciona sem precisar de stop explícito
        let (sink2, _s) = collecting_sink();
        manager.start(FakeSource::ok(&released), sink2).unwrap();
        manager.stop();
    }

    #[test]
    fn open_that_hangs_times_out_and_cleans_up_when_it_finally_returns() {
        let released = Arc::new(AtomicUsize::new(0));
        let mut slow = FakeSource::ok(&released);
        slow.open_delay = Duration::from_millis(300);
        let (sink, _s) = collecting_sink();

        let err = CaptureSession::start_with_timeout(slow, sink, Duration::from_millis(50))
            .map(|_| ())
            .unwrap_err();
        assert_eq!(err, AudioCaptureError::ActivationTimeout);

        // Quando `open` volta, a thread vê o stop e solta a stream sem entrar no laço.
        wait_until("a stream tardia ser liberada", || {
            released.load(Ordering::SeqCst) == 1
        });
    }
}
