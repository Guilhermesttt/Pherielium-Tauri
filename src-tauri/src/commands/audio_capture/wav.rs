//! Escritor mínimo de WAV (PCM 16 bits) para o diagnóstico de desenvolvimento.
//!
//! Existe só para validar o recorte de áudio SEM depender do front: grava alguns
//! segundos do que a captura enxerga e a pessoa ouve o arquivo (a voz da call
//! tem de estar ausente). Sem crate: o formato é um cabeçalho fixo de 44 bytes.

use super::format::{f32_to_s16, CHANNELS, SAMPLE_RATE};

/// Monta um WAV PCM s16 estéreo 48 kHz a partir de amostras float intercaladas.
pub fn encode_wav_s16(samples: &[f32]) -> Vec<u8> {
    let data_len = (samples.len() * 2) as u32;
    let byte_rate = SAMPLE_RATE * CHANNELS as u32 * 2;
    let block_align = CHANNELS * 2;

    let mut out = Vec::with_capacity(44 + data_len as usize);
    out.extend_from_slice(b"RIFF");
    out.extend_from_slice(&(36 + data_len).to_le_bytes());
    out.extend_from_slice(b"WAVE");
    out.extend_from_slice(b"fmt ");
    out.extend_from_slice(&16u32.to_le_bytes()); // tamanho do bloco fmt
    out.extend_from_slice(&1u16.to_le_bytes()); // PCM
    out.extend_from_slice(&CHANNELS.to_le_bytes());
    out.extend_from_slice(&SAMPLE_RATE.to_le_bytes());
    out.extend_from_slice(&byte_rate.to_le_bytes());
    out.extend_from_slice(&block_align.to_le_bytes());
    out.extend_from_slice(&16u16.to_le_bytes()); // bits por amostra
    out.extend_from_slice(b"data");
    out.extend_from_slice(&data_len.to_le_bytes());
    for s in samples {
        out.extend_from_slice(&f32_to_s16(*s).to_le_bytes());
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn header_describes_48k_stereo_s16() {
        let wav = encode_wav_s16(&[0.0, 0.5, -0.5, 1.0]);
        assert_eq!(&wav[0..4], b"RIFF");
        assert_eq!(&wav[8..12], b"WAVE");
        assert_eq!(u16::from_le_bytes([wav[22], wav[23]]), 2, "canais");
        assert_eq!(u32::from_le_bytes([wav[24], wav[25], wav[26], wav[27]]), 48_000);
        assert_eq!(u16::from_le_bytes([wav[34], wav[35]]), 16, "bits");
    }

    #[test]
    fn sizes_are_consistent() {
        let samples = vec![0.25f32; 960];
        let wav = encode_wav_s16(&samples);
        assert_eq!(wav.len(), 44 + 960 * 2);
        let riff = u32::from_le_bytes([wav[4], wav[5], wav[6], wav[7]]) as usize;
        assert_eq!(riff, wav.len() - 8, "tamanho do RIFF");
        let data = u32::from_le_bytes([wav[40], wav[41], wav[42], wav[43]]) as usize;
        assert_eq!(data, 960 * 2, "tamanho do bloco data");
    }

    #[test]
    fn samples_are_clamped_not_wrapped() {
        let wav = encode_wav_s16(&[3.0, -3.0]);
        assert_eq!(i16::from_le_bytes([wav[44], wav[45]]), i16::MAX);
        assert_eq!(i16::from_le_bytes([wav[46], wav[47]]), -i16::MAX);
    }
}
