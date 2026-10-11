//! Formato fixo da captura e conversões de amostra.
//!
//! O cliente de áudio ativado por process loopback NÃO suporta `GetMixFormat`:
//! o formato precisa ser dito explicitamente. Fixamos 48 kHz estéreo — é a taxa
//! nativa do Opus no LiveKit, então não há reamostragem entre a captura e o
//! codificador. float32 é o formato preferido; s16 fica de reserva para quem
//! recusar float.

/// Taxa de amostragem da captura, em Hz.
pub const SAMPLE_RATE: u32 = 48_000;
/// Canais da captura (estéreo, intercalados).
pub const CHANNELS: u16 = 2;
/// Quadros por pacote enviado ao front: 480 quadros = 10 ms a 48 kHz.
pub const PACKET_FRAMES: usize = 480;
/// Amostras (todos os canais) por pacote.
pub const PACKET_SAMPLES: usize = PACKET_FRAMES * CHANNELS as usize;

/// Formato das amostras como o dispositivo as entrega.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SampleFormat {
    F32,
    S16,
}

impl SampleFormat {
    pub const fn bytes_per_sample(self) -> usize {
        match self {
            SampleFormat::F32 => 4,
            SampleFormat::S16 => 2,
        }
    }

    pub const fn bits(self) -> u16 {
        match self {
            SampleFormat::F32 => 32,
            SampleFormat::S16 => 16,
        }
    }

    pub const fn name(self) -> &'static str {
        match self {
            SampleFormat::F32 => "f32",
            SampleFormat::S16 => "s16",
        }
    }
}

/// Ordem em que os formatos são tentados no `Initialize`.
pub const FORMAT_PREFERENCE: [SampleFormat; 2] = [SampleFormat::F32, SampleFormat::S16];

pub fn s16_to_f32(value: i16) -> f32 {
    value as f32 / 32768.0
}

/// float → s16 com clamp e arredondamento; NaN vira silêncio.
pub fn f32_to_s16(value: f32) -> i16 {
    if !value.is_finite() {
        return 0;
    }
    (value.clamp(-1.0, 1.0) * i16::MAX as f32).round() as i16
}

/// Converte bytes little-endian capturados para float intercalado, anexando a
/// `out`. Devolve quantas amostras entraram. Bytes sobrando que não formam uma
/// amostra inteira são ignorados (nunca lê além do buffer).
pub fn decode_into(bytes: &[u8], format: SampleFormat, out: &mut Vec<f32>) -> usize {
    let width = format.bytes_per_sample();
    let count = bytes.len() / width;
    out.reserve(count);
    match format {
        SampleFormat::F32 => {
            for chunk in bytes.as_chunks::<4>().0 {
                let v = f32::from_le_bytes(*chunk);
                // Valor fora de faixa ou NaN do driver nunca chega ao codec.
                out.push(if v.is_finite() { v.clamp(-1.0, 1.0) } else { 0.0 });
            }
        }
        SampleFormat::S16 => {
            for chunk in bytes.as_chunks::<2>().0 {
                out.push(s16_to_f32(i16::from_le_bytes(*chunk)));
            }
        }
    }
    count
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn one_packet_is_ten_milliseconds() {
        let ms = PACKET_FRAMES as f64 * 1000.0 / SAMPLE_RATE as f64;
        assert!((ms - 10.0).abs() < 1e-9);
        assert_eq!(PACKET_SAMPLES, 960);
    }

    #[test]
    fn s16_roundtrip_is_stable() {
        for v in [i16::MIN + 1, -12345, -1, 0, 1, 12345, i16::MAX] {
            let back = f32_to_s16(s16_to_f32(v));
            assert!((back as i32 - v as i32).abs() <= 1, "{v} -> {back}");
        }
    }

    #[test]
    fn f32_to_s16_clamps_and_survives_nan() {
        assert_eq!(f32_to_s16(5.0), i16::MAX);
        assert_eq!(f32_to_s16(-5.0), -i16::MAX);
        assert_eq!(f32_to_s16(f32::NAN), 0);
        assert_eq!(f32_to_s16(f32::INFINITY), 0);
    }

    #[test]
    fn decodes_f32_and_sanitizes() {
        let mut bytes = Vec::new();
        for v in [0.5f32, -2.0, f32::NAN, 0.25] {
            bytes.extend_from_slice(&v.to_le_bytes());
        }
        let mut out = Vec::new();
        assert_eq!(decode_into(&bytes, SampleFormat::F32, &mut out), 4);
        assert_eq!(out, vec![0.5, -1.0, 0.0, 0.25]);
    }

    #[test]
    fn decodes_s16() {
        let bytes: Vec<u8> = [16384i16, -16384].iter().flat_map(|v| v.to_le_bytes()).collect();
        let mut out = Vec::new();
        assert_eq!(decode_into(&bytes, SampleFormat::S16, &mut out), 2);
        assert!((out[0] - 0.5).abs() < 1e-4 && (out[1] + 0.5).abs() < 1e-4);
    }

    #[test]
    fn ragged_tail_is_ignored_not_read() {
        let mut out = Vec::new();
        // 7 bytes: uma amostra f32 inteira + 3 bytes soltos.
        assert_eq!(decode_into(&[0, 0, 0, 0x3f, 1, 2, 3], SampleFormat::F32, &mut out), 1);
        assert_eq!(out.len(), 1);
    }

    #[test]
    fn float_is_preferred_over_s16() {
        assert_eq!(FORMAT_PREFERENCE[0], SampleFormat::F32);
    }
}
