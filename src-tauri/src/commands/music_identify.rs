//! Identifica a música que toca no PC com a AudD (https://audd.io) e devolve os gêneros.
//!
//! Fluxo: grava ~5 s do áudio do PC (loopback do Windows, nunca o microfone) → WAV mono 16 kHz/16 bit
//! → POST multipart à AudD com `return=apple_music,spotify` → título, artista e gêneros.
//! A chave da AudD vem das configurações do usuário e nunca fica no frontend nem no repositório.

use serde::Serialize;
use serde_json::Value;
use std::time::Duration;
use tauri::command;

const AUDD_URL: &str = "https://api.audd.io/";
const TARGET_RATE: u32 = 16_000;
const HTTP_TIMEOUT: Duration = Duration::from_secs(12);

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IdentifiedTrack {
    pub title: String,
    pub artist: String,
    pub genres: Vec<String>,
}

/// Reamostragem linear simples (suficiente para reconhecimento).
pub fn resample_linear(input: &[f32], from_rate: u32, to_rate: u32) -> Vec<f32> {
    if input.is_empty() || from_rate == 0 || to_rate == 0 {
        return Vec::new();
    }
    if from_rate == to_rate {
        return input.to_vec();
    }
    let ratio = from_rate as f64 / to_rate as f64;
    let out_len = ((input.len() as f64) / ratio).floor() as usize;
    (0..out_len)
        .map(|i| {
            let pos = i as f64 * ratio;
            let idx = pos.floor() as usize;
            let frac = (pos - idx as f64) as f32;
            let a = input[idx.min(input.len() - 1)];
            let b = input[(idx + 1).min(input.len() - 1)];
            a + (b - a) * frac
        })
        .collect()
}

/// WAV PCM 16 bit mono.
pub fn wav_bytes(samples: &[f32], rate: u32) -> Vec<u8> {
    let data_len = (samples.len() * 2) as u32;
    let mut out = Vec::with_capacity(44 + samples.len() * 2);
    out.extend_from_slice(b"RIFF");
    out.extend_from_slice(&(36 + data_len).to_le_bytes());
    out.extend_from_slice(b"WAVEfmt ");
    out.extend_from_slice(&16u32.to_le_bytes());
    out.extend_from_slice(&1u16.to_le_bytes()); // PCM
    out.extend_from_slice(&1u16.to_le_bytes()); // mono
    out.extend_from_slice(&rate.to_le_bytes());
    out.extend_from_slice(&(rate * 2).to_le_bytes());
    out.extend_from_slice(&2u16.to_le_bytes());
    out.extend_from_slice(&16u16.to_le_bytes());
    out.extend_from_slice(b"data");
    out.extend_from_slice(&data_len.to_le_bytes());
    for s in samples {
        let v = (s.clamp(-1.0, 1.0) * i16::MAX as f32) as i16;
        out.extend_from_slice(&v.to_le_bytes());
    }
    out
}

/// RMS do trecho: evita enviar silêncio.
pub fn rms(samples: &[f32]) -> f32 {
    if samples.is_empty() {
        return 0.0;
    }
    (samples.iter().map(|s| s * s).sum::<f32>() / samples.len() as f32).sqrt()
}

/// Lê a resposta da AudD. `None` quando não reconheceu (`result: null`) ou deu erro.
pub fn parse_audd(json: &Value) -> Option<IdentifiedTrack> {
    if json.get("status").and_then(Value::as_str) != Some("success") {
        return None;
    }
    let result = json.get("result")?;
    if result.is_null() {
        return None;
    }
    let title = result.get("title").and_then(Value::as_str)?.to_string();
    let artist = result.get("artist").and_then(Value::as_str).unwrap_or_default().to_string();

    let mut genres: Vec<String> = Vec::new();
    let mut push_all = |v: Option<&Value>| {
        if let Some(arr) = v.and_then(Value::as_array) {
            for g in arr.iter().filter_map(Value::as_str) {
                let g = g.trim();
                // "Music" é a categoria raiz da Apple, não diz nada do estilo
                if !g.is_empty() && !g.eq_ignore_ascii_case("music") && !genres.iter().any(|x| x.eq_ignore_ascii_case(g)) {
                    genres.push(g.to_string());
                }
            }
        }
    };
    push_all(result.pointer("/apple_music/genreNames"));
    push_all(result.pointer("/spotify/genres"));
    push_all(result.pointer("/spotify/artists/0/genres"));
    push_all(result.get("genres"));

    Some(IdentifiedTrack { title, artist, genres })
}

#[command]
pub async fn music_identify(api_key: String, seconds: Option<f32>) -> Result<Option<IdentifiedTrack>, String> {
    let key = api_key.trim().to_string();
    if key.is_empty() {
        return Err("Chave da AudD nao configurada.".into());
    }
    let seconds = seconds.unwrap_or(5.0).clamp(3.0, 8.0);

    // captura bloqueante fora da thread async
    let (samples, rate) = tauri::async_runtime::spawn_blocking(move || super::screen_capture::capture_system_audio(seconds))
        .await
        .map_err(|e| e.to_string())??;
    let mono = resample_linear(&samples, rate, TARGET_RATE);
    if rms(&mono) < 0.002 {
        return Ok(None); // nada tocando de verdade: não gasta a cota
    }
    let wav = wav_bytes(&mono, TARGET_RATE);

    let part = reqwest::multipart::Part::bytes(wav)
        .file_name("sample.wav")
        .mime_str("audio/wav")
        .map_err(|e| e.to_string())?;
    let form = reqwest::multipart::Form::new()
        .text("api_token", key)
        .text("return", "apple_music,spotify")
        .part("file", part);

    let client = reqwest::Client::builder().timeout(HTTP_TIMEOUT).build().map_err(|e| e.to_string())?;
    let resp = client.post(AUDD_URL).multipart(form).send().await.map_err(|e| format!("AudD: {e}"))?;
    if !resp.status().is_success() {
        return Err(format!("AudD respondeu {}", resp.status()));
    }
    let json: Value = resp.json().await.map_err(|e| format!("AudD: resposta invalida ({e})"))?;
    if json.get("status").and_then(Value::as_str) == Some("error") {
        let msg = json.pointer("/error/error_message").and_then(Value::as_str).unwrap_or("erro");
        return Err(format!("AudD: {msg}"));
    }
    Ok(parse_audd(&json))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn wav_header_is_valid_pcm16_mono() {
        let wav = wav_bytes(&[0.0, 0.5, -0.5], 16_000);
        assert_eq!(&wav[0..4], b"RIFF");
        assert_eq!(&wav[8..12], b"WAVE");
        assert_eq!(u16::from_le_bytes([wav[20], wav[21]]), 1); // PCM
        assert_eq!(u16::from_le_bytes([wav[22], wav[23]]), 1); // mono
        assert_eq!(u32::from_le_bytes([wav[24], wav[25], wav[26], wav[27]]), 16_000);
        assert_eq!(u32::from_le_bytes([wav[40], wav[41], wav[42], wav[43]]), 6);
        assert_eq!(wav.len(), 44 + 6);
        assert_eq!(i16::from_le_bytes([wav[46], wav[47]]), (0.5 * i16::MAX as f32) as i16);
    }

    #[test]
    fn resample_changes_length_by_the_rate_ratio() {
        let input = vec![0.25f32; 48_000];
        let out = resample_linear(&input, 48_000, 16_000);
        assert!((out.len() as i64 - 16_000).abs() <= 1);
        assert!(out.iter().all(|v| (*v - 0.25).abs() < 1e-5));
        assert_eq!(resample_linear(&input, 48_000, 48_000).len(), 48_000);
        assert!(resample_linear(&[], 48_000, 16_000).is_empty());
    }

    #[test]
    fn rms_of_silence_is_zero() {
        assert_eq!(rms(&[0.0; 100]), 0.0);
        assert!(rms(&[0.5; 100]) > 0.49);
    }

    #[test]
    fn parses_genres_from_apple_music_and_drops_the_root_category() {
        let j = json!({
            "status": "success",
            "result": {
                "artist": "Metallica", "title": "Enter Sandman",
                "apple_music": { "genreNames": ["Metal", "Music", "Rock"] },
                "spotify": { "artists": [{ "name": "Metallica" }] }
            }
        });
        let t = parse_audd(&j).unwrap();
        assert_eq!(t.title, "Enter Sandman");
        assert_eq!(t.genres, vec!["Metal", "Rock"]);
    }

    #[test]
    fn null_result_and_errors_are_none() {
        assert!(parse_audd(&json!({ "status": "success", "result": null })).is_none());
        assert!(parse_audd(&json!({ "status": "error", "error": { "error_code": 901 } })).is_none());
        assert!(parse_audd(&json!({})).is_none());
    }

    #[test]
    fn track_without_genres_still_parses() {
        let j = json!({ "status": "success", "result": { "artist": "X", "title": "Y" } });
        let t = parse_audd(&j).unwrap();
        assert!(t.genres.is_empty());
    }
}
