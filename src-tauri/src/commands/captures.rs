//! List and open screenshots under Pictures/Phelierium Captures (Electron-compatible).

use base64::{engine::general_purpose::STANDARD as B64, Engine};
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::SystemTime;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureItem {
    pub id: String,
    pub name: String,
    pub path: String,
    pub url: String,
    pub created_at: String,
    pub game_title: Option<String>,
}

fn pictures_dir() -> Result<PathBuf, String> {
    #[cfg(windows)]
    {
        let userprofile =
            std::env::var("USERPROFILE").map_err(|_| "USERPROFILE nao definido.".to_string())?;
        Ok(PathBuf::from(userprofile).join("Pictures"))
    }
    #[cfg(not(windows))]
    {
        let home = std::env::var("HOME").map_err(|_| "HOME nao definido.".to_string())?;
        let xdg = std::env::var("XDG_PICTURES_DIR").ok();
        if let Some(dir) = xdg {
            return Ok(PathBuf::from(dir));
        }
        Ok(PathBuf::from(home).join("Pictures"))
    }
}

pub fn captures_dir() -> Result<PathBuf, String> {
    let dir = pictures_dir()?.join("Phelierium Captures");
    fs::create_dir_all(&dir).map_err(|e| format!("Falha ao criar pasta de capturas: {e}"))?;
    Ok(dir)
}

fn is_image(path: &Path) -> bool {
    matches!(
        path
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_ascii_lowercase())
            .as_deref(),
        Some("png" | "jpg" | "jpeg" | "webp" | "bmp")
    )
}

fn file_created_at(meta: &fs::Metadata) -> SystemTime {
    meta.modified()
        .or_else(|_| meta.created())
        .unwrap_or(SystemTime::UNIX_EPOCH)
}

fn to_iso(ts: SystemTime) -> String {
    let secs = ts
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    // Compact ISO-ish stamp without chrono dependency
    format!("{secs}")
}

fn thumbnail_data_url(path: &Path) -> Option<String> {
    let img = image::open(path).ok()?;
    let thumb = img.thumbnail(480, 270);
    let mut buf = Vec::new();
    let mut cursor = std::io::Cursor::new(&mut buf);
    thumb.write_to(&mut cursor, image::ImageFormat::Jpeg).ok()?;
    let b64 = B64.encode(&buf);
    Some(format!("data:image/jpeg;base64,{b64}"))
}

fn collect_images(root: &Path, out: &mut Vec<(PathBuf, Option<String>, SystemTime)>) {
    let Ok(entries) = fs::read_dir(root) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            let game_title = path
                .file_name()
                .and_then(|n| n.to_str())
                .map(|s| s.to_string());
            if let Ok(files) = fs::read_dir(&path) {
                for file in files.flatten() {
                    let file_path = file.path();
                    if file_path.is_file() && is_image(&file_path) {
                        let meta = file.metadata().ok();
                        let ts = meta
                            .as_ref()
                            .map(file_created_at)
                            .unwrap_or(SystemTime::UNIX_EPOCH);
                        out.push((file_path, game_title.clone(), ts));
                    }
                }
            }
        } else if path.is_file() && is_image(&path) {
            let meta = entry.metadata().ok();
            let ts = meta
                .as_ref()
                .map(file_created_at)
                .unwrap_or(SystemTime::UNIX_EPOCH);
            out.push((path, None, ts));
        }
    }
}

#[tauri::command]
pub fn list_recent_captures(limit: Option<u32>) -> Result<Vec<CaptureItem>, String> {
    let root = captures_dir()?;
    let mut files: Vec<(PathBuf, Option<String>, SystemTime)> = Vec::new();
    collect_images(&root, &mut files);
    files.sort_by(|a, b| b.2.cmp(&a.2));

    let max = limit.unwrap_or(60).clamp(1, 120) as usize;
    let mut items = Vec::with_capacity(max.min(files.len()));

    for (path, game_title, ts) in files.into_iter().take(max) {
        let name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("capture.png")
            .to_string();
        let path_str = path.to_string_lossy().to_string();
        let mtime_ms = ts
            .duration_since(SystemTime::UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0);
        let url = thumbnail_data_url(&path).unwrap_or_else(|| path_str.clone());
        items.push(CaptureItem {
            id: format!("{mtime_ms}:{name}"),
            name,
            path: path_str,
            url,
            created_at: to_iso(ts),
            game_title,
        });
    }

    Ok(items)
}

#[tauri::command]
pub fn open_captures_folder() -> Result<(), String> {
    let dir = captures_dir()?;
    open::that(&dir).map_err(|e| format!("Falha ao abrir pasta de capturas: {e}"))
}

#[tauri::command]
pub fn get_captures_dir() -> Result<String, String> {
    Ok(captures_dir()?.to_string_lossy().to_string())
}

/// Captura a tela inteira (ou o monitor principal) e salva em Pictures/Phelierium Captures.
#[tauri::command]
pub fn capture_screen(game_title: Option<String>) -> Result<CaptureItem, String> {
    let (w, h, bgra) = super::screen_capture::grab_target_bgra("desktop")?;
    let mut rgb = Vec::with_capacity((w * h * 3) as usize);
    for px in bgra.chunks_exact(4) {
        rgb.extend_from_slice(&[px[2], px[1], px[0]]);
    }
    let img = image::RgbImage::from_raw(w, h, rgb)
        .ok_or_else(|| "Falha ao montar a captura.".to_string())?;

    let folder = match game_title
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        Some(title) => {
            let safe: String = title
                .chars()
                .map(|c| if r#"\/:*?"<>|"#.contains(c) { '_' } else { c })
                .collect();
            captures_dir()?.join(safe)
        }
        None => captures_dir()?,
    };
    fs::create_dir_all(&folder).map_err(|e| format!("Falha ao criar pasta da captura: {e}"))?;

    let stamp = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let name = format!("phelierium-{stamp}.png");
    let path = folder.join(&name);
    img.save(&path)
        .map_err(|e| format!("Falha ao salvar captura: {e}"))?;

    let path_str = path.to_string_lossy().to_string();
    let url = thumbnail_data_url(&path).unwrap_or_else(|| path_str.clone());
    Ok(CaptureItem {
        id: format!("{stamp}:{name}"),
        name,
        path: path_str,
        url,
        created_at: stamp.to_string(),
        game_title,
    })
}

#[tauri::command]
pub fn delete_capture(path: String) -> Result<(), String> {
    let root = captures_dir()?
        .canonicalize()
        .map_err(|e| format!("Pasta de capturas inválida: {e}"))?;
    let target = PathBuf::from(path.trim());
    if target.as_os_str().is_empty() {
        return Err("Caminho da captura vazio.".into());
    }
    let canon = target
        .canonicalize()
        .map_err(|_| "Captura não encontrada.".to_string())?;
    if !canon.starts_with(&root) {
        return Err("Arquivo fora da pasta de capturas.".into());
    }
    if !canon.is_file() || !is_image(&canon) {
        return Err("Arquivo não é uma captura.".into());
    }
    fs::remove_file(&canon).map_err(|e| format!("Falha ao excluir captura: {e}"))?;
    if let Some(parent) = canon.parent() {
        if parent != root.as_path() {
            if let Ok(mut entries) = fs::read_dir(parent) {
                if entries.next().is_none() {
                    let _ = fs::remove_dir(parent);
                }
            }
        }
    }
    Ok(())
}
