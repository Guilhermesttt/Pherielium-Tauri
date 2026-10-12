//! Ponte entre os pacotes da captura (f32 estéreo 48 kHz com cabeçalho) e o evento que o front já espera.
//!
//! O front (`desktopAudioCapture.ts`) escuta `screen-share:audio` com `{ pcm, sampleRate, channels }`, onde `pcm` é
//! PCM de 16 bits little-endian intercalado em base64. Este módulo só converte; não conhece Tauri nem COM, então é
//! testável sem áudio nem janela.

use base64::{engine::general_purpose::STANDARD as B64, Engine};
use serde_json::{json, Value};

use super::format::{f32_to_s16, CHANNELS, SAMPLE_RATE};
use super::packet::{decode, PacketError};

/// Nome do evento Tauri consumido pelo front.
pub const AUDIO_EVENT: &str = "screen-share:audio";

/// Converte um pacote da sessão de captura no payload do evento `screen-share:audio`.
pub fn packet_to_event_payload(raw: &[u8]) -> Result<Value, PacketError> {
    let (_header, samples) = decode(raw)?;
    let mut pcm = Vec::with_capacity(samples.len() * 2);
    for sample in samples {
        pcm.extend_from_slice(&f32_to_s16(sample).to_le_bytes());
    }
    Ok(json!({
        "pcm": B64.encode(&pcm),
        "sampleRate": SAMPLE_RATE,
        "channels": CHANNELS,
        "format": "s16le",
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::audio_capture::packet::{encode, PacketHeader};

    fn decode_pcm(payload: &Value) -> Vec<i16> {
        let bytes = B64.decode(payload["pcm"].as_str().expect("pcm")).expect("base64");
        bytes.chunks_exact(2).map(|b| i16::from_le_bytes([b[0], b[1]])).collect()
    }

    #[test]
    fn converts_f32_samples_to_s16le_base64() {
        let raw = encode(PacketHeader { seq: 1, ts_ms: 10 }, &[0.0, 1.0, -1.0, 0.5]);
        let payload = packet_to_event_payload(&raw).expect("payload");
        assert_eq!(payload["sampleRate"], 48_000);
        assert_eq!(payload["channels"], 2);
        assert_eq!(payload["format"], "s16le");
        let pcm = decode_pcm(&payload);
        assert_eq!(pcm.len(), 4);
        assert_eq!(pcm[0], 0);
        assert_eq!(pcm[1], i16::MAX);
        assert!(pcm[2] <= -32767);
        assert!((pcm[3] - 16_384).abs() <= 1);
    }

    #[test]
    fn clips_out_of_range_samples_instead_of_wrapping() {
        let raw = encode(PacketHeader { seq: 0, ts_ms: 0 }, &[4.0, -4.0]);
        let pcm = decode_pcm(&packet_to_event_payload(&raw).expect("payload"));
        assert_eq!(pcm[0], i16::MAX);
        assert!(pcm[1] <= -32767);
    }

    #[test]
    fn rejects_truncated_packets() {
        assert_eq!(packet_to_event_payload(&[1, 2, 3]), Err(PacketError::TooShort));
    }
}
