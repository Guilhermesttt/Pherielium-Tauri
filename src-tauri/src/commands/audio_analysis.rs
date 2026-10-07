//! Análise leve de áudio para o mascote ("headbang"): nível (RMS/pico), três bandas
//! (graves/médios/agudos) e detecção de batida pela energia dos graves. Sem FFT: três
//! filtros de um polo por amostra bastam para um kick e custam quase nada de CPU.
//!
//! É puro (não toca em APIs do Windows), então é testável com sinais sintéticos. A thread
//! que alimenta o `Analyzer` com o áudio do sistema fica em `win_loopback.rs`.

use std::f32::consts::PI;

/// Um quadro de análise (~30 Hz). Todos os valores em 0..1 (pico de amostra normalizado).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct LevelFrame {
    pub rms: f32,
    pub peak: f32,
    pub low: f32,
    pub mid: f32,
    pub high: f32,
    /// Houve uma batida (pico de graves acima da média recente).
    pub beat: bool,
}

/// Fronteiras das bandas (Hz).
const LOW_CUTOFF_HZ: f32 = 200.0;
const MID_CUTOFF_HZ: f32 = 2000.0;
/// Energia mínima de graves (RMS) para contar como batida: ignora ruído de fundo.
const BEAT_MIN_LOW: f32 = 0.02;
/// A energia de graves do quadro precisa superar a média recente por este fator.
const BEAT_RATIO: f32 = 1.45;
/// Intervalo mínimo entre batidas (ms) — limita a ~250 BPM e evita disparos duplos.
const BEAT_MIN_GAP_MS: f32 = 240.0;
/// Quadros iniciais só aquecem a média (sem disparar batida).
const WARMUP_FRAMES: u32 = 12;
/// Peso da média móvel dos graves (quanto maior, mais lenta: ~janela de 0,6 s a 30 Hz).
const LOW_AVG_KEEP: f32 = 0.95;

pub struct Analyzer {
    frame_len: usize,
    frame_ms: f32,
    a_low: f32,
    a_mid: f32,
    // filtros
    lp_low: f32,
    lp_mid: f32,
    // acumuladores do quadro atual
    n: usize,
    sum_sq: f32,
    peak: f32,
    sum_low: f32,
    sum_mid: f32,
    sum_high: f32,
    // batida
    low_avg: f32,
    frames_seen: u32,
    since_beat_ms: f32,
}

fn one_pole(cutoff_hz: f32, sample_rate: f32) -> f32 {
    1.0 - (-2.0 * PI * cutoff_hz / sample_rate).exp()
}

impl Analyzer {
    pub fn new(sample_rate: u32, frame_ms: u32) -> Self {
        let fs = sample_rate.max(8000) as f32;
        let frame_ms = frame_ms.max(10) as f32;
        Self {
            frame_len: ((fs * frame_ms / 1000.0) as usize).max(1),
            frame_ms,
            a_low: one_pole(LOW_CUTOFF_HZ, fs),
            a_mid: one_pole(MID_CUTOFF_HZ, fs),
            lp_low: 0.0,
            lp_mid: 0.0,
            n: 0,
            sum_sq: 0.0,
            peak: 0.0,
            sum_low: 0.0,
            sum_mid: 0.0,
            sum_high: 0.0,
            low_avg: 0.0,
            frames_seen: 0,
            since_beat_ms: f32::MAX,
        }
    }

    /// Consome amostras mono e acrescenta em `out` os quadros que completaram.
    pub fn push(&mut self, mono: &[f32], out: &mut Vec<LevelFrame>) {
        for &x in mono {
            self.lp_low += self.a_low * (x - self.lp_low);
            self.lp_mid += self.a_mid * (x - self.lp_mid);
            let low = self.lp_low;
            let mid = self.lp_mid - self.lp_low;
            let high = x - self.lp_mid;

            self.sum_sq += x * x;
            self.sum_low += low * low;
            self.sum_mid += mid * mid;
            self.sum_high += high * high;
            self.peak = self.peak.max(x.abs());
            self.n += 1;

            if self.n >= self.frame_len {
                out.push(self.finish_frame());
            }
        }
    }

    fn finish_frame(&mut self) -> LevelFrame {
        let n = self.n.max(1) as f32;
        let rms = (self.sum_sq / n).sqrt().min(1.0);
        let low = (self.sum_low / n).sqrt().min(1.0);
        let mid = (self.sum_mid / n).sqrt().min(1.0);
        let high = (self.sum_high / n).sqrt().min(1.0);
        let peak = self.peak.min(1.0);

        self.since_beat_ms += self.frame_ms;
        self.frames_seen = self.frames_seen.saturating_add(1);
        let beat = self.frames_seen > WARMUP_FRAMES
            && low > BEAT_MIN_LOW
            && low > self.low_avg * BEAT_RATIO
            && self.since_beat_ms >= BEAT_MIN_GAP_MS;
        if beat {
            self.since_beat_ms = 0.0;
        }
        self.low_avg = self.low_avg * LOW_AVG_KEEP + low * (1.0 - LOW_AVG_KEEP);

        self.n = 0;
        self.sum_sq = 0.0;
        self.sum_low = 0.0;
        self.sum_mid = 0.0;
        self.sum_high = 0.0;
        self.peak = 0.0;

        LevelFrame { rms, peak, low, mid, high, beat }
    }
}

/// Formato das amostras do buffer WASAPI.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PcmKind {
    F32,
    I16,
    I32,
}

/// Converte um buffer entrelaçado para mono `f32` em -1..1 (média dos canais).
pub fn pcm_to_mono_f32(bytes: &[u8], frames: usize, channels: usize, kind: PcmKind) -> Vec<f32> {
    let channels = channels.max(1);
    let width = match kind {
        PcmKind::I16 => 2,
        PcmKind::F32 | PcmKind::I32 => 4,
    };
    let mut out = Vec::with_capacity(frames);
    for frame in 0..frames {
        let mut acc = 0.0f32;
        let mut counted = 0u32;
        for ch in 0..channels {
            let start = (frame * channels + ch) * width;
            if start + width > bytes.len() {
                break;
            }
            let v = match kind {
                PcmKind::F32 => f32::from_le_bytes([bytes[start], bytes[start + 1], bytes[start + 2], bytes[start + 3]]),
                PcmKind::I16 => i16::from_le_bytes([bytes[start], bytes[start + 1]]) as f32 / 32768.0,
                PcmKind::I32 => {
                    i32::from_le_bytes([bytes[start], bytes[start + 1], bytes[start + 2], bytes[start + 3]]) as f32
                        / 2_147_483_648.0
                }
            };
            acc += v;
            counted += 1;
        }
        out.push(if counted > 0 { (acc / counted as f32).clamp(-1.0, 1.0) } else { 0.0 });
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    const FS: u32 = 48_000;

    fn sine(freq: f32, amp: f32, seconds: f32) -> Vec<f32> {
        let n = (FS as f32 * seconds) as usize;
        (0..n).map(|i| amp * (2.0 * PI * freq * i as f32 / FS as f32).sin()).collect()
    }

    fn run(samples: &[f32]) -> Vec<LevelFrame> {
        let mut a = Analyzer::new(FS, 33);
        let mut out = Vec::new();
        a.push(samples, &mut out);
        out
    }

    #[test]
    fn silence_has_no_level_and_no_beat() {
        let frames = run(&vec![0.0; FS as usize * 2]);
        assert!(!frames.is_empty());
        assert!(frames.iter().all(|f| f.rms == 0.0 && f.peak == 0.0 && !f.beat));
    }

    #[test]
    fn produces_about_30_frames_per_second() {
        let frames = run(&sine(440.0, 0.5, 2.0));
        assert!((55..=65).contains(&frames.len()), "frames: {}", frames.len());
    }

    #[test]
    fn steady_tone_reports_rms_and_never_beats_after_warmup() {
        let frames = run(&sine(440.0, 0.5, 3.0));
        let last = frames.last().unwrap();
        assert!((last.rms - 0.5 / 2f32.sqrt()).abs() < 0.03, "rms {}", last.rms);
        assert!(last.peak > 0.45 && last.peak <= 0.5 + 1e-3);
        assert!(frames.iter().skip(WARMUP_FRAMES as usize + 20).all(|f| !f.beat));
    }

    #[test]
    fn bands_follow_the_frequency_content() {
        let bass = run(&sine(80.0, 0.6, 1.5));
        let treble = run(&sine(6000.0, 0.6, 1.5));
        let b = bass.last().unwrap();
        let t = treble.last().unwrap();
        assert!(b.low > b.mid && b.low > b.high, "graves: {:?}", b);
        assert!(t.high > t.low && t.high > t.mid, "agudos: {:?}", t);
    }

    #[test]
    fn kick_drum_pattern_is_detected_once_per_hit() {
        // 8 kicks (burst de 60 Hz de 90 ms) a cada 500 ms sobre um chiado baixo
        let mut samples = vec![0.0f32; FS as usize * 4];
        let kicks = 8;
        for k in 0..kicks {
            let start = (FS as f32 * (0.6 + k as f32 * 0.5)) as usize;
            let len = (FS as f32 * 0.09) as usize;
            for i in 0..len {
                if start + i < samples.len() {
                    let env = 1.0 - i as f32 / len as f32;
                    samples[start + i] += 0.8 * env * (2.0 * PI * 60.0 * i as f32 / FS as f32).sin();
                }
            }
        }
        for (i, s) in samples.iter_mut().enumerate() {
            *s += 0.01 * (((i * 7919) % 200) as f32 / 100.0 - 1.0); // ruído determinístico
        }
        let frames = run(&samples);
        let beats = frames.iter().filter(|f| f.beat).count();
        assert!((kicks - 1..=kicks + 1).contains(&beats), "batidas: {beats}");
    }

    #[test]
    fn beats_respect_the_minimum_gap() {
        // kicks a cada 100 ms: no máximo ~1 batida por 240 ms
        let mut samples = vec![0.0f32; FS as usize * 2];
        for k in 0..16 {
            let start = (FS as f32 * (0.3 + k as f32 * 0.1)) as usize;
            for i in 0..(FS as usize / 40) {
                if start + i < samples.len() {
                    samples[start + i] += 0.8 * (2.0 * PI * 60.0 * i as f32 / FS as f32).sin();
                }
            }
        }
        let beats = run(&samples).iter().filter(|f| f.beat).count();
        assert!(beats <= 8, "batidas: {beats}");
    }

    #[test]
    fn pcm_conversion_handles_each_format_and_averages_channels() {
        // estéreo F32: L=1.0, R=0.0 -> 0.5
        let mut f32_bytes = Vec::new();
        for v in [1.0f32, 0.0, -1.0, 1.0] {
            f32_bytes.extend_from_slice(&v.to_le_bytes());
        }
        assert_eq!(pcm_to_mono_f32(&f32_bytes, 2, 2, PcmKind::F32), vec![0.5, 0.0]);

        // mono I16 no máximo ≈ 1.0
        let mut i16_bytes = Vec::new();
        for v in [i16::MAX, i16::MIN] {
            i16_bytes.extend_from_slice(&v.to_le_bytes());
        }
        let mono = pcm_to_mono_f32(&i16_bytes, 2, 1, PcmKind::I16);
        assert!(mono[0] > 0.999 && mono[1] == -1.0);

        // I32
        let mut i32_bytes = Vec::new();
        i32_bytes.extend_from_slice(&(i32::MAX / 2).to_le_bytes());
        let mono = pcm_to_mono_f32(&i32_bytes, 1, 1, PcmKind::I32);
        assert!((mono[0] - 0.5).abs() < 0.001);
    }

    #[test]
    fn pcm_conversion_is_safe_on_truncated_buffers() {
        let mono = pcm_to_mono_f32(&[0u8; 3], 4, 2, PcmKind::F32);
        assert_eq!(mono.len(), 4);
        assert!(mono.iter().all(|v| *v == 0.0));
    }
}
