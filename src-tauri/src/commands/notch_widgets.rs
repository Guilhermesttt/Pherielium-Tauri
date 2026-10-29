//! Dados dos widgets da notch que vêm da internet: letra da música e clima.
//!
//! Passam pelo Rust (e não pelo `fetch` do front) para não abrir hosts novos no `connect-src` da CSP
//! e para ter um tempo limite e um User-Agent identificável. Nenhum serviço pede chave de API:
//! LRCLIB (letras sincronizadas, comunitário) e Open-Meteo (clima, gratuito para uso não comercial).

use serde::{Deserialize, Serialize};
use std::time::Duration;
use tauri::command;

const HTTP_TIMEOUT: Duration = Duration::from_secs(6);
const USER_AGENT: &str = concat!("Pherielium/", env!("CARGO_PKG_VERSION"), " (https://github.com/Guilhermesttt/Pherielium-Tauri)");

fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(HTTP_TIMEOUT)
        .user_agent(USER_AGENT)
        .build()
        .map_err(|e| format!("cliente HTTP indisponível: {e}"))
}

// ── Letras ──────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LyricLine {
    pub time_ms: u64,
    pub text: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Lyrics {
    /// Linhas com tempo (vazio quando só existe a letra sem sincronia).
    pub synced: Vec<LyricLine>,
    /// Letra corrida, sem tempos.
    pub plain: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LrclibTrack {
    synced_lyrics: Option<String>,
    plain_lyrics: Option<String>,
    duration: Option<f64>,
}

/// Converte uma letra LRC (`[mm:ss.xx] texto`) em linhas ordenadas. Aceita várias marcas de tempo na
/// mesma linha (refrões repetidos) e ignora metadados como `[ar:Artista]`.
pub fn parse_lrc(lrc: &str) -> Vec<LyricLine> {
    let mut lines = Vec::new();
    for raw in lrc.lines() {
        let mut rest = raw.trim();
        let mut times = Vec::new();
        while let Some(stripped) = rest.strip_prefix('[') {
            let Some(close) = stripped.find(']') else { break };
            match parse_timestamp(&stripped[..close]) {
                Some(ms) => times.push(ms),
                None => {
                    // `[ar:...]`, `[ti:...]`: metadado, a linha inteira não é letra
                    if times.is_empty() {
                        rest = "";
                    }
                    break;
                }
            }
            rest = stripped[close + 1..].trim_start();
        }
        if times.is_empty() {
            continue;
        }
        let text = rest.trim().to_string();
        for time_ms in times {
            lines.push(LyricLine { time_ms, text: text.clone() });
        }
    }
    lines.sort_by_key(|l| l.time_ms);
    lines
}

fn parse_timestamp(tag: &str) -> Option<u64> {
    let (minutes, seconds) = tag.split_once(':')?;
    let minutes: u64 = minutes.parse().ok()?;
    let seconds: f64 = seconds.parse().ok()?;
    if !(0.0..60.0).contains(&seconds) {
        return None;
    }
    Some(minutes * 60_000 + (seconds * 1000.0).round() as u64)
}

fn into_lyrics(track: LrclibTrack) -> Option<Lyrics> {
    let synced = track.synced_lyrics.as_deref().map(parse_lrc).unwrap_or_default();
    let plain = track.plain_lyrics.filter(|p| !p.trim().is_empty());
    if synced.is_empty() && plain.is_none() {
        return None;
    }
    Some(Lyrics { synced, plain })
}

/// Palavras que marcam versão/edição, não o nome da música ("Remastered", "Live", "feat.", "Official Video"...).
const NOISE_WORDS: &[&str] = &[
    "remaster", "live", "version", "edit", "mono", "stereo", "feat", "ft.", "official", "video", "audio", "lyric",
    "explicit", "deluxe", "bonus", "radio", "single", "mix", "clean",
];

fn is_noise(text: &str) -> bool {
    let lower = text.to_lowercase();
    NOISE_WORDS.iter().any(|w| lower.contains(w))
}

/// Tira do título o que atrapalha a busca: "(Remastered 2011)", "[Official Video]", "- Live at ...",
/// "feat. X". Se sobrar nada, devolve o original.
pub fn clean_track_title(title: &str) -> String {
    let mut out = String::new();
    let mut depth_closer: Option<char> = None;
    let mut group = String::new();
    for c in title.chars() {
        match depth_closer {
            Some(closer) => {
                if c == closer {
                    // grupo fechado: só some se for ruído; senão volta com os delimitadores
                    if !is_noise(&group) {
                        let opener = if closer == ')' { '(' } else { '[' };
                        out.push(opener);
                        out.push_str(&group);
                        out.push(closer);
                    }
                    group.clear();
                    depth_closer = None;
                } else {
                    group.push(c);
                }
            }
            None => match c {
                '(' => depth_closer = Some(')'),
                '[' => depth_closer = Some(']'),
                _ => out.push(c),
            },
        }
    }
    // grupo que nunca fechou: devolve como estava
    if depth_closer.is_some() {
        out.push('(');
        out.push_str(&group);
    }
    // "Título - Remastered 2011" / "Título - Live": descarta os trechos de ruído depois do " - "
    let kept: Vec<&str> = out.split(" - ").enumerate().filter(|(i, part)| *i == 0 || !is_noise(part)).map(|(_, p)| p).collect();
    let cleaned = kept.join(" - ").split_whitespace().collect::<Vec<_>>().join(" ");
    if cleaned.is_empty() {
        title.trim().to_string()
    } else {
        cleaned
    }
}

/// Só o artista principal: "A, B", "A & B", "A feat. B", "A x B" viram "A".
pub fn primary_artist(artist: &str) -> String {
    let lower = artist.to_lowercase();
    let mut cut = artist.len();
    for sep in [",", " & ", " feat", " ft.", " ft ", " x ", ";", " with "] {
        if let Some(pos) = lower.find(sep) {
            cut = cut.min(pos);
        }
    }
    artist[..cut].trim().trim_end_matches(" - Topic").trim().to_string()
}

/// Entre os resultados da busca, o melhor: letra sincronizada com a duração mais próxima da faixa
/// (até 8 s de diferença quando a duração é conhecida); sem isso, o primeiro com qualquer letra.
fn best_match(tracks: Vec<LrclibTrack>, target_seconds: Option<f64>) -> Option<Lyrics> {
    let mut scored: Vec<(f64, LrclibTrack)> = tracks
        .into_iter()
        .filter(|t| t.synced_lyrics.as_deref().is_some_and(|l| !parse_lrc(l).is_empty()))
        .map(|t| {
            let diff = match (target_seconds, t.duration) {
                (Some(want), Some(got)) => (want - got).abs(),
                _ => 0.0,
            };
            (diff, t)
        })
        .collect();
    scored.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal));
    if let Some((diff, track)) = scored.into_iter().next() {
        if target_seconds.is_none() || diff <= 8.0 {
            return into_lyrics(track);
        }
    }
    None
}

/// Envia a requisição e tenta mais uma vez se o servidor estiver ocupado ou a rede falhar de relance.
async fn send_with_retry(request: reqwest::RequestBuilder) -> Result<reqwest::Response, String> {
    let retry = request.try_clone();
    match request.send().await {
        Ok(response) if !response.status().is_server_error() => Ok(response),
        first => {
            let Some(retry) = retry else {
                return first.map_err(|e| format!("LRCLIB indisponível: {e}"));
            };
            tokio::time::sleep(Duration::from_millis(500)).await;
            retry.send().await.map_err(|e| format!("LRCLIB indisponível: {e}"))
        }
    }
}

async fn search_tracks(client: &reqwest::Client, params: &[(&str, &str)]) -> Result<Vec<LrclibTrack>, String> {
    let response = send_with_retry(client.get("https://lrclib.net/api/search").query(params)).await?;
    if !response.status().is_success() {
        return Err(format!("LRCLIB respondeu {}", response.status()));
    }
    response.json().await.map_err(|e| format!("resposta inválida do LRCLIB: {e}"))
}

/// Busca a letra no LRCLIB pela faixa que está tocando. `None` = não achou (não é erro).
///
/// Tenta, nesta ordem: o casamento exato (com a duração), a busca por título e artista limpos e, por
/// fim, a busca livre. Players trazem títulos como "Música - Remastered 2011" que o LRCLIB não conhece.
#[command]
pub async fn lyrics_lookup(title: String, artist: String, duration_seconds: Option<f64>) -> Result<Option<Lyrics>, String> {
    let raw_title = title.trim();
    if raw_title.is_empty() {
        return Ok(None);
    }
    let client = client()?;
    let duration = duration_seconds.filter(|d| d.is_finite() && *d > 0.0);
    let title = clean_track_title(raw_title);
    let artist = primary_artist(&artist);

    let mut query: Vec<(&str, String)> = vec![("track_name", title.clone()), ("artist_name", artist.clone())];
    if let Some(d) = duration {
        query.push(("duration", (d.round() as u64).to_string()));
    }
    let exact = send_with_retry(client.get("https://lrclib.net/api/get").query(&query)).await?;
    if exact.status().is_success() {
        let track: LrclibTrack = exact.json().await.map_err(|e| format!("resposta inválida do LRCLIB: {e}"))?;
        if let Some(lyrics) = into_lyrics(track) {
            return Ok(Some(lyrics));
        }
    } else if exact.status() != reqwest::StatusCode::NOT_FOUND {
        return Err(format!("LRCLIB respondeu {}", exact.status()));
    }

    let by_name = search_tracks(&client, &[("track_name", &title), ("artist_name", &artist)]).await?;
    if let Some(lyrics) = best_match(by_name, duration) {
        return Ok(Some(lyrics));
    }
    let free = search_tracks(&client, &[("q", &format!("{artist} {title}"))]).await?;
    Ok(best_match(free, duration))
}

// ── Clima ───────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Weather {
    pub city: String,
    pub temperature_c: f64,
    /// Descrição em pt-BR ("Limpo", "Chuva"...).
    pub label: String,
    /// "clear" | "partly" | "cloud" | "fog" | "rain" | "snow" | "storm" — o front escolhe o ícone.
    pub kind: &'static str,
    pub is_day: bool,
}

/// Código WMO do Open-Meteo → (descrição, tipo de ícone).
pub fn describe_weather_code(code: u32) -> (&'static str, &'static str) {
    match code {
        0 => ("Limpo", "clear"),
        1 | 2 => ("Parcialmente nublado", "partly"),
        3 => ("Nublado", "cloud"),
        45 | 48 => ("Neblina", "fog"),
        51..=57 => ("Garoa", "rain"),
        61..=67 | 80..=82 => ("Chuva", "rain"),
        71..=77 | 85 | 86 => ("Neve", "snow"),
        95..=99 => ("Tempestade", "storm"),
        _ => ("Indefinido", "cloud"),
    }
}

#[derive(Debug, Deserialize)]
struct GeoResponse {
    results: Option<Vec<GeoPlace>>,
}

#[derive(Debug, Deserialize)]
struct GeoPlace {
    name: String,
    latitude: f64,
    longitude: f64,
}

#[derive(Debug, Deserialize)]
struct ForecastResponse {
    current: ForecastCurrent,
}

#[derive(Debug, Deserialize)]
struct ForecastCurrent {
    temperature_2m: f64,
    weather_code: u32,
    is_day: u8,
}

/// Clima atual de uma cidade digitada pelo usuário (sem localização automática: nada de GPS ou IP).
#[command]
pub async fn weather_lookup(city: String) -> Result<Option<Weather>, String> {
    let city = city.trim();
    if city.is_empty() {
        return Ok(None);
    }
    let client = client()?;
    let geo: GeoResponse = client
        .get("https://geocoding-api.open-meteo.com/v1/search")
        .query(&[("name", city), ("count", "1"), ("language", "pt")])
        .send()
        .await
        .map_err(|e| format!("busca de cidade indisponível: {e}"))?
        .json()
        .await
        .map_err(|e| format!("resposta inválida da busca de cidade: {e}"))?;
    let Some(place) = geo.results.and_then(|r| r.into_iter().next()) else {
        return Ok(None);
    };
    let forecast: ForecastResponse = client
        .get("https://api.open-meteo.com/v1/forecast")
        .query(&[
            ("latitude", place.latitude.to_string()),
            ("longitude", place.longitude.to_string()),
            ("current", "temperature_2m,weather_code,is_day".to_string()),
        ])
        .send()
        .await
        .map_err(|e| format!("clima indisponível: {e}"))?
        .json()
        .await
        .map_err(|e| format!("resposta inválida do clima: {e}"))?;
    let (label, kind) = describe_weather_code(forecast.current.weather_code);
    Ok(Some(Weather {
        city: place.name,
        temperature_c: forecast.current.temperature_2m,
        label: label.to_string(),
        kind,
        is_day: forecast.current.is_day == 1,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_timestamps_and_sorts_lines() {
        let lrc = "[00:12.50] segunda\n[00:01.00] primeira\n[01:02.345] terceira";
        let lines = parse_lrc(lrc);
        assert_eq!(
            lines,
            vec![
                LyricLine { time_ms: 1_000, text: "primeira".into() },
                LyricLine { time_ms: 12_500, text: "segunda".into() },
                LyricLine { time_ms: 62_345, text: "terceira".into() },
            ]
        );
    }

    #[test]
    fn repeated_chorus_stamps_expand_into_one_line_each() {
        let lines = parse_lrc("[00:10.00][00:40.00] refrão");
        assert_eq!(lines.len(), 2);
        assert_eq!(lines[0].time_ms, 10_000);
        assert_eq!(lines[1].time_ms, 40_000);
        assert!(lines.iter().all(|l| l.text == "refrão"));
    }

    #[test]
    fn metadata_tags_are_not_lyrics() {
        let lrc = "[ar:Artista]\n[ti:Título]\n[length: 03:20]\n[00:05.00] letra";
        let lines = parse_lrc(lrc);
        assert_eq!(lines, vec![LyricLine { time_ms: 5_000, text: "letra".into() }]);
    }

    #[test]
    fn empty_instrumental_gaps_keep_an_empty_text() {
        let lines = parse_lrc("[00:30.00]");
        assert_eq!(lines, vec![LyricLine { time_ms: 30_000, text: String::new() }]);
    }

    #[test]
    fn garbage_yields_no_lines() {
        assert!(parse_lrc("").is_empty());
        assert!(parse_lrc("sem tempo nenhum").is_empty());
        assert!(parse_lrc("[99:99:99] x").is_empty());
        assert!(parse_lrc("[00:75.00] segundos demais").is_empty());
    }

    #[test]
    fn track_without_any_lyrics_is_none() {
        assert!(into_lyrics(LrclibTrack { synced_lyrics: None, plain_lyrics: Some("  ".into()), duration: None }).is_none());
        let only_plain = into_lyrics(LrclibTrack { synced_lyrics: None, plain_lyrics: Some("oi".into()), duration: None }).unwrap();
        assert!(only_plain.synced.is_empty());
        assert_eq!(only_plain.plain.as_deref(), Some("oi"));
    }

    #[test]
    fn cleans_noise_out_of_track_titles() {
        assert_eq!(clean_track_title("Bound For The Floor - Remastered 2011"), "Bound For The Floor");
        assert_eq!(clean_track_title("Song (feat. Someone)"), "Song");
        assert_eq!(clean_track_title("Song [Official Video]"), "Song");
        assert_eq!(clean_track_title("Song - Live at Wembley"), "Song");
        assert_eq!(clean_track_title("Song (Live)  [Remastered]"), "Song");
    }

    #[test]
    fn keeps_parts_of_the_title_that_are_not_noise() {
        assert_eq!(clean_track_title("Heroes (We Could Be)"), "Heroes (We Could Be)");
        assert_eq!(clean_track_title("Where Is My Mind? - Pixies"), "Where Is My Mind? - Pixies");
        assert_eq!(clean_track_title("(Remastered)"), "(Remastered)");
        assert_eq!(clean_track_title("Aberto (sem fim"), "Aberto (sem fim");
    }

    #[test]
    fn keeps_only_the_main_artist() {
        assert_eq!(primary_artist("Local H"), "Local H");
        assert_eq!(primary_artist("Artist A, Artist B"), "Artist A");
        assert_eq!(primary_artist("Artist A & Artist B"), "Artist A");
        assert_eq!(primary_artist("Artist A feat. B"), "Artist A");
        assert_eq!(primary_artist("Artist - Topic"), "Artist");
    }

    fn track(synced: Option<&str>, duration: Option<f64>) -> LrclibTrack {
        LrclibTrack { synced_lyrics: synced.map(String::from), plain_lyrics: None, duration }
    }

    #[test]
    fn best_match_prefers_the_closest_duration() {
        let tracks = vec![
            track(Some("[00:01.00] longe"), Some(260.0)),
            track(Some("[00:01.00] perto"), Some(201.0)),
            track(None, Some(200.0)),
        ];
        let lyrics = best_match(tracks, Some(200.0)).unwrap();
        assert_eq!(lyrics.synced[0].text, "perto");
    }

    #[test]
    fn best_match_rejects_a_very_different_duration() {
        assert!(best_match(vec![track(Some("[00:01.00] x"), Some(400.0))], Some(200.0)).is_none());
        // sem duração conhecida aceita o primeiro com letra sincronizada
        assert!(best_match(vec![track(Some("[00:01.00] x"), Some(400.0))], None).is_some());
    }

    /// DIAGNÓSTICO COM REDE: busca letras reais no LRCLIB, com títulos "sujos" como os dos players.
    /// `cargo test --lib lyrics_lookup_live -- --ignored --nocapture`
    #[test]
    #[ignore = "usa a internet"]
    fn lyrics_lookup_live() {
        for (title, artist, duration) in [
            ("Bound For The Floor - Remastered 2011", "Local H", Some(237.0)),
            ("Blinding Lights", "The Weeknd", Some(200.0)),
            ("Take It", "Staind", None),
        ] {
            let start = std::time::Instant::now();
            let result = tauri::async_runtime::block_on(lyrics_lookup(title.into(), artist.into(), duration));
            match result {
                Ok(Some(l)) => println!("{title}: {} linhas sincronizadas, plain={} em {:?}", l.synced.len(), l.plain.is_some(), start.elapsed()),
                Ok(None) => println!("{title}: sem letra em {:?}", start.elapsed()),
                Err(e) => println!("{title}: ERRO {e} em {:?}", start.elapsed()),
            }
        }
    }

    #[test]
    fn weather_codes_map_to_labels() {
        assert_eq!(describe_weather_code(0), ("Limpo", "clear"));
        assert_eq!(describe_weather_code(3).1, "cloud");
        assert_eq!(describe_weather_code(63).1, "rain");
        assert_eq!(describe_weather_code(75).1, "snow");
        assert_eq!(describe_weather_code(96).1, "storm");
        assert_eq!(describe_weather_code(12345).1, "cloud");
    }
}
