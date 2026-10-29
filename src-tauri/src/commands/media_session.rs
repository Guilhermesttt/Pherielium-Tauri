//! Mídia do Windows (Spotify, navegador, players) pelo controle de transporte do sistema (GSMTC),
//! chamado direto pela API WinRT.
//!
//! Antes cada consulta, cada capa e cada clique em play/pause/próxima abria um PowerShell: de
//! 300 ms a mais de 1 s por chamada, e uma consulta a cada 1,5 s competindo com o clique do
//! usuário. É por isso que pausar e trocar de faixa demoravam. Aqui são chamadas diretas
//! (alguns milissegundos), sem processo novo.
//!
//! Todas as funções bloqueiam (esperam o `IAsyncOperation`): chame-as de `spawn_blocking`.

use serde_json::{json, Value};

/// Posição na janela de reprodução (em ms Unix) a partir do `DateTime` do Windows
/// (100 ns desde 1601-01-01). Separado para ser testável.
pub fn windows_ticks_to_unix_ms(ticks_100ns: i64) -> i64 {
    const EPOCH_DIFF_MS: i64 = 11_644_473_600_000;
    ticks_100ns / 10_000 - EPOCH_DIFF_MS
}

/// O Pherielium não deve se mostrar como a mídia que ele mesmo toca (sons do app, vídeos do hub).
pub fn is_own_media(title: &str, source_app: &str) -> bool {
    let title = title.to_uppercase();
    title.contains("PHERIELIUM") || title.contains("PHELIERIUM") || source_app.to_lowercase().contains("pherielium")
}

#[cfg(target_os = "windows")]
mod imp {
    use super::{is_own_media, json, windows_ticks_to_unix_ms, Value};
    use windows::Media::Control::{
        GlobalSystemMediaTransportControlsSession as Session,
        GlobalSystemMediaTransportControlsSessionManager as Manager,
        GlobalSystemMediaTransportControlsSessionPlaybackStatus as Status,
    };
    use windows::Media::MediaPlaybackType;
    use windows::Storage::Streams::DataReader;
    use windows::Win32::System::Com::{CoInitializeEx, COINIT_MULTITHREADED};

    fn ensure_apartment() {
        // SAFETY: inicializa o COM da thread atual; "já inicializado" (S_FALSE/erro) é inofensivo.
        unsafe {
            let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        }
    }

    struct Picked {
        session: Session,
        title: String,
        artist: String,
        playing: bool,
    }

    /// A sessão que está tocando; se nenhuma toca, a primeira com título (a mesma regra de antes).
    fn pick_session() -> Option<Picked> {
        ensure_apartment();
        let manager = Manager::RequestAsync().ok()?.get().ok()?;
        let sessions = manager.GetSessions().ok()?;
        let mut fallback: Option<Picked> = None;
        for i in 0..sessions.Size().ok()? {
            let Ok(session) = sessions.GetAt(i) else { continue };
            let Ok(props) = session.TryGetMediaPropertiesAsync().and_then(|op| op.get()) else { continue };
            let title = props.Title().map(|t| t.to_string()).unwrap_or_default();
            if title.is_empty() {
                continue;
            }
            let source = session.SourceAppUserModelId().map(|s| s.to_string()).unwrap_or_default();
            if is_own_media(&title, &source) {
                continue;
            }
            let artist = props.Artist().map(|a| a.to_string()).unwrap_or_default();
            let playing = session
                .GetPlaybackInfo()
                .and_then(|info| info.PlaybackStatus())
                .map(|s| s == Status::Playing)
                .unwrap_or(false);
            let picked = Picked { session, title, artist, playing };
            if playing {
                return Some(picked);
            }
            fallback.get_or_insert(picked);
        }
        fallback
    }

    pub fn info() -> Value {
        let Some(picked) = pick_session() else {
            return json!({ "hasMedia": false, "isPlaying": false });
        };
        let video = picked
            .session
            .TryGetMediaPropertiesAsync()
            .and_then(|op| op.get())
            .and_then(|props| props.PlaybackType())
            .and_then(|kind| kind.Value())
            .map(|kind| kind == MediaPlaybackType::Video)
            .unwrap_or(false);
        let (mut position, mut duration, mut updated_ms) = (0.0_f64, 0.0_f64, 0_i64);
        if let Ok(timeline) = picked.session.GetTimelineProperties() {
            let secs = |t: windows::Foundation::TimeSpan| t.Duration as f64 / 10_000_000.0;
            if let (Ok(start), Ok(end), Ok(pos)) = (timeline.StartTime(), timeline.EndTime(), timeline.Position()) {
                duration = (secs(end) - secs(start)).max(0.0);
                position = (secs(pos) - secs(start)).max(0.0);
            }
            if let Ok(updated) = timeline.LastUpdatedTime() {
                updated_ms = windows_ticks_to_unix_ms(updated.UniversalTime);
            }
        }
        json!({
            "hasMedia": true,
            "title": picked.title,
            "artist": picked.artist,
            "isPlaying": picked.playing,
            "playbackType": if video { "video" } else { "music" },
            "positionSeconds": position,
            "durationSeconds": duration,
            "updatedAtMs": updated_ms,
        })
    }

    /// Bytes da capa (JPEG/PNG/...) da sessão escolhida; `None` quando o app não publica imagem.
    pub fn thumbnail_bytes() -> Option<Vec<u8>> {
        let picked = pick_session()?;
        let props = picked.session.TryGetMediaPropertiesAsync().ok()?.get().ok()?;
        let stream = props.Thumbnail().ok()?.OpenReadAsync().ok()?.get().ok()?;
        let size = u32::try_from(stream.Size().ok()?).ok()?;
        if size == 0 {
            return None;
        }
        let reader = DataReader::CreateDataReader(&stream).ok()?;
        reader.LoadAsync(size).ok()?.get().ok()?;
        let mut bytes = vec![0u8; size as usize];
        reader.ReadBytes(&mut bytes).ok()?;
        Some(bytes)
    }

    /// `Some(aceito)` quando havia uma sessão; `None` quando não há mídia alguma.
    pub fn set_playing(playing: bool) -> Option<bool> {
        let picked = pick_session()?;
        let op = if playing { picked.session.TryPlayAsync() } else { picked.session.TryPauseAsync() };
        Some(op.and_then(|op| op.get()).unwrap_or(false))
    }

    pub fn skip(next: bool) -> Option<bool> {
        let picked = pick_session()?;
        let op = if next { picked.session.TrySkipNextAsync() } else { picked.session.TrySkipPreviousAsync() };
        Some(op.and_then(|op| op.get()).unwrap_or(false))
    }
}

#[cfg(not(target_os = "windows"))]
mod imp {
    use super::{json, Value};

    pub fn info() -> Value {
        json!({ "hasMedia": false, "isPlaying": false })
    }
    pub fn thumbnail_bytes() -> Option<Vec<u8>> {
        None
    }
    pub fn set_playing(_playing: bool) -> Option<bool> {
        None
    }
    pub fn skip(_next: bool) -> Option<bool> {
        None
    }
}

pub use imp::{info, set_playing, skip, thumbnail_bytes};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn converts_windows_datetime_to_unix_milliseconds() {
        // 2026-01-01T00:00:00Z = 1_767_225_600 s Unix
        let ticks = (1_767_225_600_i64 * 1_000 + 11_644_473_600_000) * 10_000;
        assert_eq!(windows_ticks_to_unix_ms(ticks), 1_767_225_600_000);
        assert_eq!(windows_ticks_to_unix_ms(11_644_473_600_000 * 10_000), 0);
    }

    #[test]
    fn ignores_the_apps_own_media() {
        assert!(is_own_media("Pherielium - intro", ""));
        assert!(is_own_media("x", "Pherielium.exe"));
        assert!(is_own_media("Phelierium", ""));
        assert!(!is_own_media("Bound For The Floor", "Spotify.exe"));
    }

    /// DIAGNÓSTICO NO HARDWARE: com algo tocando, mede quanto leva cada chamada (era 300 ms+ no PowerShell).
    /// `cargo test --lib media_session_speed -- --ignored --nocapture`
    #[test]
    #[ignore = "depende de uma mídia tocando nesta máquina"]
    fn media_session_speed() {
        let start = std::time::Instant::now();
        let info = info();
        println!("info (1ª, a frio) em {:?}: {info}", start.elapsed());
        let start = std::time::Instant::now();
        let _ = super::info();
        println!("info (2ª) em {:?}", start.elapsed());
        let start = std::time::Instant::now();
        let _ = set_playing(true);
        println!("TryPlay em {:?}", start.elapsed());
        assert_eq!(info["hasMedia"], true, "nada tocando");
        let start = std::time::Instant::now();
        let thumb = thumbnail_bytes();
        println!("capa em {:?}: {} bytes", start.elapsed(), thumb.as_ref().map_or(0, Vec::len));
    }
}
