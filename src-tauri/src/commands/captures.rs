//! List and open screenshots under Pictures/Phelierium Captures (Electron-compatible).

use base64::{engine::general_purpose::STANDARD as B64, Engine};
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::SystemTime;
use tauri::{AppHandle, Manager};

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

/// Captura a tela do jogo/monitor ativo (ou a área de trabalho inteira caso explicitamente solicitada)
/// e salva em Pictures/Phelierium Captures.
#[tauri::command]
pub fn capture_screen(
    app: AppHandle,
    game_title: Option<String>,
    target: Option<String>,
) -> Result<CaptureItem, String> {
    // 1. Temporariamente oculta o overlay caso esteja visível para não sair na captura
    let overlay_win = app.get_webview_window("overlay");
    let was_overlay_visible = overlay_win
        .as_ref()
        .and_then(|w| w.is_visible().ok())
        .unwrap_or(false);

    if was_overlay_visible {
        if let Some(ref w) = overlay_win {
            let _ = w.hide();
            // Permite ao compositor do SO redesenhar a tela sem o overlay
            std::thread::sleep(std::time::Duration::from_millis(60));
        }
    }

    // 2. Determina o alvo da captura: alvo explícito ou o monitor onde o jogo/janela ativa está
    let target_id = match target.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        Some(explicit) => explicit.to_string(),
        None => {
            let mon_idx = super::screen_capture::find_game_or_active_monitor_index(game_title.as_deref());
            format!("screen:{mon_idx}")
        }
    };

    let grab_result = super::screen_capture::grab_target_bgra(&target_id);

    // 3. Restaura o overlay caso estivesse aberto antes
    if was_overlay_visible {
        if let Some(ref w) = overlay_win {
            let _ = w.show();
        }
    }

    let (w, h, bgra) = grab_result.map_err(|e| format!("Falha ao capturar ({target_id}): {e}"))?;

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

/// Arquivos acima disso são ignorados (a dropzone é para imagens, não para vídeos/ISOs).
const MAX_IMPORT_BYTES: u64 = 64 * 1024 * 1024;

/// Nome de pasta seguro a partir do título do jogo (mesma regra das capturas).
fn safe_folder_name(title: &str) -> String {
    title
        .trim()
        .chars()
        .map(|c| if r#"\/:*?"<>|"#.contains(c) { '_' } else { c })
        .collect()
}

/// Caminho livre dentro de `dir`: se `name` já existe, usa "nome (2).ext", "nome (3).ext"...
fn unique_destination(dir: &Path, name: &str) -> PathBuf {
    let first = dir.join(name);
    if !first.exists() {
        return first;
    }
    let path = Path::new(name);
    let stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or("imagem");
    let ext = path.extension().and_then(|e| e.to_str());
    for n in 2..10_000 {
        let candidate = match ext {
            Some(ext) => format!("{stem} ({n}).{ext}"),
            None => format!("{stem} ({n})"),
        };
        let full = dir.join(candidate);
        if !full.exists() {
            return full;
        }
    }
    dir.join(format!("{stem}-{}", std::process::id()))
}

/// Copia para `dir` só as imagens válidas de `paths`. Devolve `(copiados, ignorados)`.
/// Ignora: pastas, não-imagens, arquivos inexistentes/grandes demais. Nunca sobrescreve.
fn import_images_into(dir: &Path, paths: &[String]) -> (Vec<PathBuf>, u32) {
    let mut copied = Vec::new();
    let mut skipped = 0u32;
    for raw in paths {
        let src = PathBuf::from(raw);
        let valid = src.is_file()
            && is_image(&src)
            && fs::metadata(&src).map(|m| m.len() <= MAX_IMPORT_BYTES).unwrap_or(false);
        if !valid {
            skipped += 1;
            continue;
        }
        let name = src.file_name().and_then(|n| n.to_str()).unwrap_or("imagem.png");
        let dest = unique_destination(dir, name);
        match fs::copy(&src, &dest) {
            Ok(_) => copied.push(dest),
            Err(_) => skipped += 1,
        }
    }
    (copied, skipped)
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportResult {
    pub imported: Vec<CaptureItem>,
    pub skipped: u32,
}

/// Dropzone do notch: copia as imagens soltas para Pictures/Phelierium Captures (na pasta do
/// jogo atual, se houver). A cópia é feita aqui no Rust: a capability do overlay é mínima.
#[tauri::command]
pub fn capture_import_files(paths: Vec<String>, game_title: Option<String>) -> Result<ImportResult, String> {
    let folder = match game_title.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        Some(title) => captures_dir()?.join(safe_folder_name(title)),
        None => captures_dir()?,
    };
    fs::create_dir_all(&folder).map_err(|e| format!("Falha ao criar pasta das capturas: {e}"))?;

    let (copied, skipped) = import_images_into(&folder, &paths);
    let imported = copied
        .into_iter()
        .map(|path| {
            let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("imagem.png").to_string();
            let stamp = SystemTime::now()
                .duration_since(SystemTime::UNIX_EPOCH)
                .map(|d| d.as_millis())
                .unwrap_or(0);
            let path_str = path.to_string_lossy().to_string();
            let url = thumbnail_data_url(&path).unwrap_or_else(|| path_str.clone());
            CaptureItem {
                id: format!("{stamp}:{name}"),
                name,
                path: path_str,
                url,
                created_at: stamp.to_string(),
                game_title: game_title.clone(),
            }
        })
        .collect();
    Ok(ImportResult { imported, skipped })
}

#[tauri::command]
pub fn get_capture_full_image(path: String) -> Result<String, String> {
    let p = PathBuf::from(path.trim());
    if !p.exists() || !p.is_file() {
        return Err("Arquivo de captura nao encontrado.".into());
    }
    if !is_image(&p) {
        return Err("Arquivo nao e uma imagem suportada.".into());
    }
    let bytes = fs::read(&p).map_err(|e| format!("Falha ao ler arquivo: {e}"))?;
    let ext = p.extension().and_then(|e| e.to_str()).unwrap_or("png").to_lowercase();
    let mime = match ext.as_str() {
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "bmp" => "image/bmp",
        _ => "image/png",
    };
    let b64 = B64.encode(&bytes);
    Ok(format!("data:{mime};base64,{b64}"))
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

#[cfg(test)]
mod import_tests {
    use super::*;

    fn temp_dir(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "pherielium-import-{tag}-{}-{}",
            std::process::id(),
            SystemTime::now().duration_since(SystemTime::UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0)
        ));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn folder_names_drop_forbidden_characters() {
        assert_eq!(safe_folder_name("  Hades II: Remake?  "), "Hades II_ Remake_");
        assert_eq!(safe_folder_name(r"A/B\C"), "A_B_C");
    }

    #[test]
    fn unique_destination_never_overwrites() {
        let dir = temp_dir("unique");
        fs::write(dir.join("foto.png"), b"x").unwrap();
        fs::write(dir.join("foto (2).png"), b"x").unwrap();
        assert_eq!(unique_destination(&dir, "foto.png"), dir.join("foto (3).png"));
        assert_eq!(unique_destination(&dir, "nova.png"), dir.join("nova.png"));
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn imports_only_valid_images_and_counts_the_rest() {
        let src = temp_dir("src");
        let dst = temp_dir("dst");
        fs::write(src.join("a.PNG"), b"png").unwrap();
        fs::write(src.join("b.jpg"), b"jpg").unwrap();
        fs::write(src.join("nota.txt"), b"txt").unwrap();
        fs::create_dir_all(src.join("pasta.png")).unwrap(); // pasta com nome de imagem
        let paths: Vec<String> = ["a.PNG", "b.jpg", "nota.txt", "pasta.png", "nao-existe.png"]
            .iter()
            .map(|n| src.join(n).to_string_lossy().to_string())
            .collect();

        let (copied, skipped) = import_images_into(&dst, &paths);
        assert_eq!(copied.len(), 2);
        assert_eq!(skipped, 3);
        assert!(dst.join("a.PNG").exists() && dst.join("b.jpg").exists());
        let _ = fs::remove_dir_all(&src);
        let _ = fs::remove_dir_all(&dst);
    }

    #[test]
    fn importing_the_same_file_twice_keeps_both() {
        let src = temp_dir("dup-src");
        let dst = temp_dir("dup-dst");
        fs::write(src.join("a.png"), b"1").unwrap();
        let paths = vec![src.join("a.png").to_string_lossy().to_string()];
        import_images_into(&dst, &paths);
        let (copied, _) = import_images_into(&dst, &paths);
        assert_eq!(copied, vec![dst.join("a (2).png")]);
        let _ = fs::remove_dir_all(&src);
        let _ = fs::remove_dir_all(&dst);
    }
}
