//! Formato binário do pacote que segue da captura para o front.
//!
//! Vai pelo `ipc::Channel` como corpo bruto, sem JSON nem base64:
//!
//! ```text
//! offset  tamanho  campo
//!      0        4  seq        u32 LE — contador do pacote (detecta perda/reordenação)
//!      4        4  ts_ms      u32 LE — ms desde o início da sessão (mede latência)
//!      8   4 × N   amostras   f32 LE, estéreo intercalado (L R L R …)
//! ```
//!
//! O worklet do front lê exatamente este layout (`desktopAudioWorklet.js`); se
//! mudar aqui, mude lá — e `HEADER_LEN` junto.

use super::format::PACKET_SAMPLES;

pub const HEADER_LEN: usize = 8;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PacketHeader {
    pub seq: u32,
    pub ts_ms: u32,
}

/// Monta um pacote. `samples` deve ter `PACKET_SAMPLES` amostras.
pub fn encode(header: PacketHeader, samples: &[f32]) -> Vec<u8> {
    let mut out = Vec::with_capacity(HEADER_LEN + samples.len() * 4);
    out.extend_from_slice(&header.seq.to_le_bytes());
    out.extend_from_slice(&header.ts_ms.to_le_bytes());
    for s in samples {
        out.extend_from_slice(&s.to_le_bytes());
    }
    out
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PacketError {
    TooShort,
    /// O corpo depois do cabeçalho não é múltiplo de 4 bytes.
    Misaligned,
}

pub fn decode(bytes: &[u8]) -> Result<(PacketHeader, Vec<f32>), PacketError> {
    if bytes.len() < HEADER_LEN {
        return Err(PacketError::TooShort);
    }
    let body = &bytes[HEADER_LEN..];
    if !body.len().is_multiple_of(4) {
        return Err(PacketError::Misaligned);
    }
    let header = PacketHeader {
        seq: u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]),
        ts_ms: u32::from_le_bytes([bytes[4], bytes[5], bytes[6], bytes[7]]),
    };
    let samples = body
        .as_chunks::<4>()
        .0
        .iter()
        .map(|c| f32::from_le_bytes(*c))
        .collect();
    Ok((header, samples))
}

/// Tamanho de um pacote cheio, em bytes.
pub const FULL_PACKET_BYTES: usize = HEADER_LEN + PACKET_SAMPLES * 4;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roundtrip_preserves_header_and_samples() {
        let samples: Vec<f32> = (0..PACKET_SAMPLES).map(|i| i as f32 / 1000.0 - 0.4).collect();
        let header = PacketHeader { seq: 0xDEAD_BEEF, ts_ms: 123_456 };
        let bytes = encode(header, &samples);
        assert_eq!(bytes.len(), FULL_PACKET_BYTES);
        let (h, s) = decode(&bytes).unwrap();
        assert_eq!(h, header);
        assert_eq!(s, samples);
    }

    #[test]
    fn header_is_little_endian_at_fixed_offsets() {
        // O worklet em JS lê estes offsets; este teste é o contrato.
        let bytes = encode(PacketHeader { seq: 1, ts_ms: 2 }, &[0.0]);
        assert_eq!(&bytes[0..4], &[1, 0, 0, 0]);
        assert_eq!(&bytes[4..8], &[2, 0, 0, 0]);
    }

    #[test]
    fn rejects_truncated_and_misaligned_input() {
        assert_eq!(decode(&[0; 7]), Err(PacketError::TooShort));
        assert_eq!(decode(&[0; 11]), Err(PacketError::Misaligned));
    }
}
