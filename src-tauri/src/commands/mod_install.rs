//! Instalação de mods na pasta do jogo, pensada para **nunca deixar o jogo pior do que estava**.
//!
//! O arquivo é extraído primeiro para uma pasta de preparo (se o ZIP estiver corrompido, o jogo
//! nem é tocado); só depois cada arquivo é copiado para o destino. Tudo o que seria sobrescrito
//! ganha uma cópia de segurança, e um manifesto registra o que foi instalado. Se qualquer passo
//! falhar no meio, o que já foi feito é desfeito. Desinstalar é o caminho inverso, lendo o manifesto.
//!
//! Sem Tauri e sem rede: só `std`, `zip` e `sha2`, para ser testado com pastas temporárias.

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::BTreeSet;
use std::fs::{self, File};
use std::io::{self, Read, Write};
use std::path::{Component, Path, PathBuf};
use thiserror::Error;

/// Mods grandes existem (texturas), mas passar disso num único arquivo é praticamente sempre um erro.
pub const MAX_TOTAL_BYTES: u64 = 10 * 1024 * 1024 * 1024;
pub const MAX_FILES: usize = 20_000;

/// Extensões de plugin que, na raiz do arquivo, pertencem à pasta `Data` do jogo (estilo Bethesda).
const DATA_FOLDER_EXTENSIONS: &[&str] = &["esp", "esm", "esl", "bsa", "ba2"];
/// Lixo que sistemas de arquivos e compactadores deixam no ZIP e que não faz parte do mod.
const IGNORED_NAMES: &[&str] = &["__macosx", ".ds_store", "thumbs.db", "desktop.ini"];

#[derive(Debug, Error)]
pub enum InstallError {
    #[error("Formato de arquivo não suportado: .{0}. O Pherielium instala ZIP e 7z automaticamente.")]
    UnsupportedFormat(String),
    #[error("Arquivos .rar ainda não são instalados automaticamente. O arquivo foi baixado: abra com o 7-Zip ou o WinRAR e copie para a pasta do jogo.")]
    RarNotSupported,
    #[error("O arquivo do mod tem senha e não pode ser instalado automaticamente.")]
    PasswordProtected,
    #[error("A pasta do jogo não existe ou não é uma pasta: {0}")]
    GameDirMissing(PathBuf),
    #[error("O arquivo do mod tem um caminho inseguro e não foi instalado: {0}")]
    UnsafePath(String),
    #[error("O arquivo do mod está vazio.")]
    EmptyArchive,
    #[error("O arquivo do mod tem arquivos demais ({0}).")]
    TooManyFiles(usize),
    #[error("O arquivo do mod é grande demais depois de extraído.")]
    TooLarge,
    #[error("O arquivo do mod está corrompido: {0}")]
    CorruptArchive(String),
    #[error("Erro de disco em {context}: {source}")]
    Io {
        context: String,
        #[source]
        source: io::Error,
    },
    #[error("O manifesto de instalação é inválido: {0}")]
    BadManifest(String),
    #[error("Este mod já está instalado. Remova a versão atual antes de instalar de novo.")]
    AlreadyInstalled(String),
}

fn io_err(context: impl Into<String>) -> impl FnOnce(io::Error) -> InstallError {
    let context = context.into();
    move |source| InstallError::Io { context, source }
}

#[derive(Debug, Clone, Copy)]
pub struct Limits {
    pub max_files: usize,
    pub max_total_bytes: u64,
}

impl Default for Limits {
    fn default() -> Self {
        Self { max_files: MAX_FILES, max_total_bytes: MAX_TOTAL_BYTES }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct InstalledFile {
    /// Caminho relativo à pasta do jogo, sempre com `/`.
    pub rel: String,
    pub sha256: String,
    /// Caminho relativo dentro de `backup_dir` da cópia do arquivo que existia antes.
    pub backup: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstallManifest {
    pub version: u32,
    pub install_id: String,
    pub mod_name: String,
    pub game_dir: String,
    pub backup_dir: String,
    pub installed_at_unix: u64,
    pub files: Vec<InstalledFile>,
    /// Pastas que o mod criou (não existiam), das mais rasas às mais fundas.
    pub created_dirs: Vec<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Default, PartialEq, Eq)]
pub struct UninstallReport {
    pub restored: usize,
    pub removed: usize,
    /// Arquivos que mudaram depois da instalação (outro mod ou atualização do jogo): ficam como estão.
    pub skipped: usize,
}

pub struct InstallRequest<'a> {
    pub archive: &'a Path,
    pub game_dir: &'a Path,
    /// Onde extrair antes de tocar no jogo.
    pub staging_root: &'a Path,
    /// Onde guardar o que for sobrescrito.
    pub backup_root: &'a Path,
    /// Onde gravar o manifesto (`<install_id>.json`).
    pub manifest_dir: &'a Path,
    pub install_id: &'a str,
    pub mod_name: &'a str,
    pub limits: Limits,
}

// ── Caminhos ─────────────────────────────────────────────────────────────────

/// Normaliza um nome de entrada do ZIP: só componentes normais, sem `..`, raiz ou unidade.
fn clean_entry_path(raw: &str) -> Result<PathBuf, InstallError> {
    let unified = raw.replace('\\', "/");
    let mut out = PathBuf::new();
    for component in Path::new(&unified).components() {
        match component {
            Component::Normal(part) => out.push(part),
            Component::CurDir => {}
            _ => return Err(InstallError::UnsafePath(raw.to_string())),
        }
    }
    // `C:foo` e nomes com `:` viram caminho de unidade/stream alternativo no Windows
    if out.to_string_lossy().contains(':') {
        return Err(InstallError::UnsafePath(raw.to_string()));
    }
    Ok(out)
}

fn is_ignored(rel: &Path) -> bool {
    rel.components().any(|c| {
        c.as_os_str()
            .to_str()
            .map(|name| IGNORED_NAMES.contains(&name.to_lowercase().as_str()))
            .unwrap_or(false)
    })
}

fn rel_to_string(rel: &Path) -> String {
    rel.components()
        .map(|c| c.as_os_str().to_string_lossy().into_owned())
        .collect::<Vec<_>>()
        .join("/")
}

/// Procura uma subpasta ignorando maiúsculas (o jogo pode ter `Data` e o mod `data`).
fn find_dir_ci(parent: &Path, name: &str) -> Option<PathBuf> {
    let wanted = name.to_lowercase();
    fs::read_dir(parent).ok()?.flatten().find_map(|entry| {
        let path = entry.path();
        let matches = entry.file_name().to_string_lossy().to_lowercase() == wanted;
        (matches && path.is_dir()).then_some(path)
    })
}

/// O destino precisa ficar dentro da pasta do jogo, inclusive depois de seguir atalhos
/// (junctions/symlinks) que já existam no caminho.
fn ensure_inside(game_dir_canon: &Path, dest: &Path) -> Result<(), InstallError> {
    let mut probe = dest;
    loop {
        if probe.exists() {
            let canon = probe.canonicalize().map_err(io_err(format!("resolver {}", probe.display())))?;
            return if canon.starts_with(game_dir_canon) {
                Ok(())
            } else {
                Err(InstallError::UnsafePath(dest.display().to_string()))
            };
        }
        match probe.parent() {
            Some(parent) => probe = parent,
            None => return Err(InstallError::UnsafePath(dest.display().to_string())),
        }
    }
}

// ── Onde cada arquivo vai ────────────────────────────────────────────────────

#[derive(Debug, PartialEq, Eq)]
struct Layout {
    /// Pasta de embrulho do ZIP a descartar (ex.: `MeuMod-1.2/`).
    strip: Option<String>,
    /// Subpasta do jogo onde o conteúdo entra (ex.: `Data`); `None` = raiz do jogo.
    dest_subdir: Option<PathBuf>,
}

/// Decide onde o conteúdo do ZIP entra no jogo. Regras, da mais segura à menos:
/// 1. Uma única pasta de embrulho que o jogo **não** tem (`MeuMod-1.2/`) é descartada;
///    se o jogo já tem uma pasta com esse nome (`Data/`, `bin/`), ela é a estrutura do mod e fica.
/// 2. Plugins soltos na raiz (`.esp`, `.bsa`...) vão para a pasta `Data` do jogo, se ela existir.
/// 3. Qualquer outro caso: a estrutura do ZIP é preservada a partir da raiz do jogo.
fn choose_layout(files: &[PathBuf], game_dir: &Path) -> Layout {
    let first_components: BTreeSet<String> = files
        .iter()
        .filter_map(|p| p.components().next())
        .map(|c| c.as_os_str().to_string_lossy().into_owned())
        .collect();
    let has_root_files = files.iter().any(|p| p.components().count() == 1);

    let mut strip = None;
    if first_components.len() == 1 && !has_root_files {
        let wrapper = first_components.iter().next().cloned().unwrap_or_default();
        if find_dir_ci(game_dir, &wrapper).is_none() {
            strip = Some(wrapper);
        }
    }

    let after_strip: Vec<PathBuf> = files
        .iter()
        .map(|p| match &strip {
            Some(w) => p.strip_prefix(w).map(Path::to_path_buf).unwrap_or_else(|_| p.clone()),
            None => p.clone(),
        })
        .collect();

    let has_plugin_at_root = after_strip.iter().any(|p| {
        p.components().count() == 1
            && p.extension()
                .and_then(|e| e.to_str())
                .map(|e| DATA_FOLDER_EXTENSIONS.contains(&e.to_lowercase().as_str()))
                .unwrap_or(false)
    });
    let dest_subdir = if has_plugin_at_root {
        find_dir_ci(game_dir, "Data").and_then(|p| p.file_name().map(PathBuf::from))
    } else {
        None
    };

    Layout { strip, dest_subdir }
}

fn apply_layout(layout: &Layout, rel: &Path) -> PathBuf {
    let stripped = match &layout.strip {
        Some(w) => rel.strip_prefix(w).map(Path::to_path_buf).unwrap_or_else(|_| rel.to_path_buf()),
        None => rel.to_path_buf(),
    };
    match &layout.dest_subdir {
        Some(sub) => sub.join(stripped),
        None => stripped,
    }
}

// ── Hash e cópia ─────────────────────────────────────────────────────────────

fn sha256_of(path: &Path) -> Result<String, InstallError> {
    let mut file = File::open(path).map_err(io_err(format!("ler {}", path.display())))?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 64 * 1024];
    loop {
        let n = file.read(&mut buffer).map_err(io_err(format!("ler {}", path.display())))?;
        if n == 0 {
            break;
        }
        hasher.update(&buffer[..n]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

/// Copia para um nome temporário ao lado do destino e renomeia: o destino nunca fica pela metade.
fn copy_atomic(from: &Path, to: &Path) -> Result<(), InstallError> {
    let tmp = to.with_file_name(format!(
        ".{}.pherielium-tmp",
        to.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default()
    ));
    fs::copy(from, &tmp).map_err(io_err(format!("copiar para {}", to.display())))?;
    if let Err(err) = fs::rename(&tmp, to) {
        let _ = fs::remove_file(&tmp);
        return Err(InstallError::Io { context: format!("finalizar {}", to.display()), source: err });
    }
    Ok(())
}

// ── Preparo (extrair sem tocar no jogo) ──────────────────────────────────────

struct Staged {
    rel: PathBuf,
    path: PathBuf,
}

/// O que já foi extraído, para valer os limites do arquivo inteiro e não só de cada entrada.
#[derive(Default)]
struct StageState {
    staged: Vec<Staged>,
    total_declared: u64,
}

/// Extrai UMA entrada para a pasta de preparo, com todas as proteções. É o mesmo caminho para
/// ZIP e 7z: o formato só muda como se enumeram as entradas.
fn stage_entry(
    raw_name: &str,
    declared_size: u64,
    is_link: bool,
    data: &mut dyn Read,
    staging: &Path,
    limits: Limits,
    state: &mut StageState,
) -> Result<(), InstallError> {
    // atalhos dentro do arquivo podem apontar para fora da pasta do jogo
    if is_link {
        return Err(InstallError::UnsafePath(raw_name.to_string()));
    }
    let rel = clean_entry_path(raw_name)?;
    if rel.as_os_str().is_empty() || is_ignored(&rel) {
        return Ok(());
    }
    if state.staged.len() + 1 > limits.max_files {
        return Err(InstallError::TooManyFiles(state.staged.len() + 1));
    }
    state.total_declared = state.total_declared.saturating_add(declared_size);
    if state.total_declared > limits.max_total_bytes {
        return Err(InstallError::TooLarge);
    }

    let out_path = staging.join(&rel);
    if let Some(parent) = out_path.parent() {
        fs::create_dir_all(parent).map_err(io_err(format!("criar {}", parent.display())))?;
    }
    let mut out = File::create(&out_path).map_err(io_err(format!("criar {}", out_path.display())))?;
    // o tamanho declarado pode mentir: o que importa é o que realmente sai do arquivo
    let copied = io::copy(&mut data.take(limits.max_total_bytes.saturating_add(1)), &mut out)
        .map_err(|e| InstallError::CorruptArchive(format!("{raw_name}: {e}")))?;
    out.flush().map_err(io_err(format!("gravar {}", out_path.display())))?;
    if copied > limits.max_total_bytes {
        return Err(InstallError::TooLarge);
    }
    state.staged.push(Staged { rel, path: out_path });
    Ok(())
}

/// Formato do arquivo pelos primeiros bytes (`zip`, `7z`, `rar`). Os links do CDN da Nexus às vezes
/// terminam num identificador sem extensão, então o nome sozinho não diz o que é o arquivo.
pub fn sniff_archive_extension(archive: &Path) -> Option<&'static str> {
    let mut head = [0u8; 8];
    let read = File::open(archive).and_then(|mut f| f.read(&mut head)).ok()?;
    let head = &head[..read];
    if head.starts_with(b"PK\x03\x04") || head.starts_with(b"PK\x05\x06") {
        Some("zip")
    } else if head.starts_with(&[0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C]) {
        Some("7z")
    } else if head.starts_with(b"Rar!") {
        Some("rar")
    } else {
        None
    }
}

fn archive_extension(archive: &Path) -> String {
    let named = archive.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
    if matches!(named.as_str(), "zip" | "7z" | "rar") {
        return named;
    }
    // extensão ausente ou estranha (ex.: nome = id do CDN): confia no conteúdo
    sniff_archive_extension(archive).map(str::to_string).unwrap_or(named)
}

fn stage_archive(archive: &Path, staging: &Path, limits: Limits) -> Result<Vec<Staged>, InstallError> {
    let state = match archive_extension(archive).as_str() {
        "zip" => stage_zip(archive, staging, limits)?,
        "7z" => stage_7z(archive, staging, limits)?,
        "rar" => return Err(InstallError::RarNotSupported),
        other => return Err(InstallError::UnsupportedFormat(other.to_string())),
    };
    if state.staged.is_empty() {
        return Err(InstallError::EmptyArchive);
    }
    Ok(state.staged)
}

fn stage_zip(archive: &Path, staging: &Path, limits: Limits) -> Result<StageState, InstallError> {
    let file = File::open(archive).map_err(io_err(format!("abrir {}", archive.display())))?;
    let mut zip = zip::ZipArchive::new(file).map_err(|e| InstallError::CorruptArchive(e.to_string()))?;
    let mut state = StageState::default();
    for index in 0..zip.len() {
        let mut entry = zip.by_index(index).map_err(|e| InstallError::CorruptArchive(e.to_string()))?;
        if entry.is_dir() {
            continue;
        }
        let is_link = entry.unix_mode().map(|m| m & 0o170000 == 0o120000).unwrap_or(false);
        let name = entry.name().to_string();
        let size = entry.size();
        stage_entry(&name, size, is_link, &mut entry, staging, limits, &mut state)?;
    }
    Ok(state)
}

/// Bits de atributo do 7z: `REPARSE_POINT` (atalho/junction do Windows) e a extensão Unix, que
/// guarda o modo do arquivo nos 16 bits de cima (é assim que o p7zip marca um symlink).
const ATTR_REPARSE_POINT: u32 = 0x400;
const ATTR_UNIX_EXTENSION: u32 = 0x8000;

fn sevenz_is_link(attributes: u32) -> bool {
    if attributes & ATTR_REPARSE_POINT != 0 {
        return true;
    }
    attributes & ATTR_UNIX_EXTENSION != 0 && ((attributes >> 16) & 0o170000) == 0o120000
}

fn map_7z_error(error: sevenz_rust2::Error) -> InstallError {
    use sevenz_rust2::Error;
    match error {
        Error::PasswordRequired | Error::MaybeBadPassword(_) => InstallError::PasswordProtected,
        other => {
            let text = other.to_string();
            // sem o recurso de senha compilado, um arquivo cifrado chega aqui como método não suportado
            if text.to_lowercase().contains("aes") {
                InstallError::PasswordProtected
            } else {
                InstallError::CorruptArchive(text)
            }
        }
    }
}

fn stage_7z(archive: &Path, staging: &Path, limits: Limits) -> Result<StageState, InstallError> {
    let file = File::open(archive).map_err(io_err(format!("abrir {}", archive.display())))?;
    let mut reader = sevenz_rust2::ArchiveReader::new(file, sevenz_rust2::Password::empty()).map_err(map_7z_error)?;

    // O cabeçalho do 7z diz quantos arquivos e bytes existem ANTES de descomprimir qualquer coisa:
    // uma bomba de descompressão é recusada aqui, sem gastar disco nem tempo.
    let files = &reader.archive().files;
    let payload: Vec<_> = files.iter().filter(|f| !f.is_directory() && !f.is_anti_item()).collect();
    if payload.len() > limits.max_files {
        return Err(InstallError::TooManyFiles(payload.len()));
    }
    let declared: u64 = payload.iter().fold(0u64, |acc, f| acc.saturating_add(f.size()));
    if declared > limits.max_total_bytes {
        return Err(InstallError::TooLarge);
    }

    let mut state = StageState::default();
    let mut failure: Option<InstallError> = None;
    let result = reader.for_each_entries(|entry, data| {
        if entry.is_directory() || entry.is_anti_item() {
            return Ok(true);
        }
        let outcome = stage_entry(
            entry.name(),
            entry.size(),
            sevenz_is_link(entry.windows_attributes()),
            data,
            staging,
            limits,
            &mut state,
        );
        match outcome {
            Ok(()) => Ok(true),
            Err(error) => {
                failure = Some(error);
                Ok(false) // para a leitura; o erro de verdade sai abaixo
            }
        }
    });
    if let Some(error) = failure {
        return Err(error);
    }
    result.map_err(map_7z_error)?;
    Ok(state)
}

// ── Instalar ─────────────────────────────────────────────────────────────────

fn now_unix() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/// Onde fica o manifesto de uma instalação.
pub fn manifest_path_for(manifest_dir: &Path, install_id: &str) -> PathBuf {
    manifest_dir.join(format!("{}.json", safe_id(install_id)))
}

pub fn safe_id(id: &str) -> String {
    let cleaned: String = id
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
        .collect();
    if cleaned.is_empty() { "mod".to_string() } else { cleaned }
}

pub fn install_zip(req: &InstallRequest) -> Result<InstallManifest, InstallError> {
    if !req.game_dir.is_dir() {
        return Err(InstallError::GameDirMissing(req.game_dir.to_path_buf()));
    }
    let game_canon = req
        .game_dir
        .canonicalize()
        .map_err(io_err(format!("resolver {}", req.game_dir.display())))?;
    let id = safe_id(req.install_id);

    // Instalar por cima apagaria as cópias de segurança da instalação anterior; quem chama
    // precisa desinstalar antes (é o que atualizar um mod faz).
    let manifest_path = manifest_path_for(req.manifest_dir, &id);
    if manifest_path.exists() {
        return Err(InstallError::AlreadyInstalled(id));
    }

    let staging = req.staging_root.join(&id);
    let _ = fs::remove_dir_all(&staging);
    fs::create_dir_all(&staging).map_err(io_err(format!("criar {}", staging.display())))?;

    let result = install_staged(req, &id, &game_canon, &staging);
    // o preparo é descartável, deu certo ou não
    let _ = fs::remove_dir_all(&staging);
    result
}

fn install_staged(
    req: &InstallRequest,
    id: &str,
    game_canon: &Path,
    staging: &Path,
) -> Result<InstallManifest, InstallError> {
    let staged = stage_archive(req.archive, staging, req.limits)?;
    let rels: Vec<PathBuf> = staged.iter().map(|s| s.rel.clone()).collect();
    let layout = choose_layout(&rels, game_canon);

    // todos os destinos são validados ANTES de escrever qualquer coisa
    let mut plan: Vec<(PathBuf, PathBuf)> = Vec::with_capacity(staged.len()); // (staged, dest)
    for item in &staged {
        let rel = apply_layout(&layout, &item.rel);
        let dest = game_canon.join(&rel);
        ensure_inside(game_canon, &dest)?;
        plan.push((item.path.clone(), dest));
    }
    plan.sort_by(|a, b| a.1.cmp(&b.1));

    let backup_dir = req.backup_root.join(id);
    let _ = fs::remove_dir_all(&backup_dir);

    let mut manifest = InstallManifest {
        version: 1,
        install_id: id.to_string(),
        mod_name: req.mod_name.to_string(),
        game_dir: game_canon.to_string_lossy().into_owned(),
        backup_dir: backup_dir.to_string_lossy().into_owned(),
        installed_at_unix: now_unix(),
        files: Vec::new(),
        created_dirs: Vec::new(),
    };

    if let Err(error) = apply_plan(&plan, game_canon, &backup_dir, &mut manifest) {
        // desfaz o que já foi feito: o jogo volta ao estado de antes
        let _ = rollback(&manifest);
        let _ = fs::remove_dir_all(&backup_dir);
        return Err(error);
    }

    fs::create_dir_all(req.manifest_dir).map_err(io_err(format!("criar {}", req.manifest_dir.display())))?;
    let manifest_path = manifest_path_for(req.manifest_dir, id);
    let json = serde_json::to_vec_pretty(&manifest).map_err(|e| InstallError::BadManifest(e.to_string()))?;
    if let Err(error) = fs::write(&manifest_path, json).map_err(io_err(format!("gravar {}", manifest_path.display()))) {
        let _ = rollback(&manifest);
        let _ = fs::remove_dir_all(&backup_dir);
        return Err(error);
    }
    Ok(manifest)
}

fn apply_plan(
    plan: &[(PathBuf, PathBuf)],
    game_canon: &Path,
    backup_dir: &Path,
    manifest: &mut InstallManifest,
) -> Result<(), InstallError> {
    let mut created: BTreeSet<PathBuf> = BTreeSet::new();

    for (staged, dest) in plan {
        // pastas que não existiam, anotadas de fora para dentro, para poder remover depois
        let mut missing: Vec<PathBuf> = Vec::new();
        let mut cursor = dest.parent();
        while let Some(dir) = cursor {
            if dir.exists() || dir == game_canon {
                break;
            }
            missing.push(dir.to_path_buf());
            cursor = dir.parent();
        }
        if let Some(parent) = dest.parent() {
            fs::create_dir_all(parent).map_err(io_err(format!("criar {}", parent.display())))?;
        }
        for dir in missing.into_iter().rev() {
            if created.insert(dir.clone()) {
                if let Ok(rel) = dir.strip_prefix(game_canon) {
                    manifest.created_dirs.push(rel_to_string(rel));
                }
            }
        }

        let rel = dest.strip_prefix(game_canon).map_err(|_| InstallError::UnsafePath(dest.display().to_string()))?;
        let rel_text = rel_to_string(rel);

        let backup = if dest.is_file() {
            let backup_path = backup_dir.join(rel);
            if let Some(parent) = backup_path.parent() {
                fs::create_dir_all(parent).map_err(io_err(format!("criar {}", parent.display())))?;
            }
            fs::copy(dest, &backup_path).map_err(io_err(format!("guardar cópia de {}", dest.display())))?;
            Some(rel_text.clone())
        } else if dest.exists() {
            // um diretório no lugar de um arquivo: não há como sobrescrever sem destruir
            return Err(InstallError::UnsafePath(format!("{} é uma pasta no jogo", dest.display())));
        } else {
            None
        };

        // registra ANTES de copiar: se a cópia falhar, o rollback sabe do backup
        manifest.files.push(InstalledFile { rel: rel_text, sha256: String::new(), backup });
        copy_atomic(staged, dest)?;
        let hash = sha256_of(dest)?;
        if let Some(last) = manifest.files.last_mut() {
            last.sha256 = hash;
        }
    }
    manifest.created_dirs.sort_by_key(|d| d.matches('/').count());
    Ok(())
}

/// Desfaz uma instalação em andamento ou concluída, sem checar se algo mudou (uso interno).
fn rollback(manifest: &InstallManifest) -> Result<(), InstallError> {
    let game = Path::new(&manifest.game_dir);
    let backup_dir = Path::new(&manifest.backup_dir);
    for file in manifest.files.iter().rev() {
        let dest = game.join(&file.rel);
        match &file.backup {
            Some(backup) => {
                let source = backup_dir.join(backup);
                if source.is_file() {
                    copy_atomic(&source, &dest)?;
                }
            }
            None => {
                let _ = fs::remove_file(&dest);
            }
        }
    }
    for dir in manifest.created_dirs.iter().rev() {
        let _ = fs::remove_dir(game.join(dir)); // só remove se estiver vazia
    }
    Ok(())
}

// ── Desinstalar ──────────────────────────────────────────────────────────────

pub fn read_manifest(manifest_path: &Path) -> Result<InstallManifest, InstallError> {
    let bytes = fs::read(manifest_path).map_err(io_err(format!("ler {}", manifest_path.display())))?;
    let manifest: InstallManifest =
        serde_json::from_slice(&bytes).map_err(|e| InstallError::BadManifest(e.to_string()))?;
    if manifest.version != 1 {
        return Err(InstallError::BadManifest(format!("versão {} não suportada", manifest.version)));
    }
    Ok(manifest)
}

/// Remove o mod: restaura o que ele sobrescreveu e apaga o que ele criou. Arquivos que mudaram
/// depois da instalação (outro mod, atualização do jogo) não são tocados.
pub fn uninstall(manifest_path: &Path) -> Result<UninstallReport, InstallError> {
    let manifest = read_manifest(manifest_path)?;
    let game = PathBuf::from(&manifest.game_dir);
    if !game.is_dir() {
        return Err(InstallError::GameDirMissing(game));
    }
    let game_canon = game.canonicalize().map_err(io_err(format!("resolver {}", game.display())))?;
    let backup_dir = PathBuf::from(&manifest.backup_dir);
    let mut report = UninstallReport::default();

    for file in manifest.files.iter().rev() {
        let rel = clean_entry_path(&file.rel)?;
        let dest = game_canon.join(&rel);
        ensure_inside(&game_canon, &dest)?;
        if !dest.exists() {
            // já foi removido à mão; se havia original, devolve
            if let Some(backup) = &file.backup {
                let source = backup_dir.join(backup);
                if source.is_file() {
                    copy_atomic(&source, &dest)?;
                    report.restored += 1;
                }
            }
            continue;
        }
        if sha256_of(&dest)? != file.sha256 {
            report.skipped += 1;
            continue;
        }
        match &file.backup {
            Some(backup) => {
                let source = backup_dir.join(backup);
                if source.is_file() {
                    copy_atomic(&source, &dest)?;
                    report.restored += 1;
                } else {
                    report.skipped += 1;
                }
            }
            None => {
                fs::remove_file(&dest).map_err(io_err(format!("remover {}", dest.display())))?;
                report.removed += 1;
            }
        }
    }
    for dir in manifest.created_dirs.iter().rev() {
        let _ = fs::remove_dir(game_canon.join(dir));
    }
    let _ = fs::remove_dir_all(&backup_dir);
    let _ = fs::remove_file(manifest_path);
    Ok(report)
}

#[cfg(test)]
mod tests {
    use super::*;
    use zip::write::SimpleFileOptions;

    struct Sandbox {
        root: PathBuf,
    }

    impl Sandbox {
        fn new() -> Self {
            let root = std::env::temp_dir().join(format!("pherielium-modinstall-{}", uuid::Uuid::new_v4()));
            fs::create_dir_all(root.join("game")).unwrap();
            Self { root }
        }
        fn game(&self) -> PathBuf {
            self.root.join("game")
        }
        fn zip(&self, name: &str, entries: &[(&str, &str)]) -> PathBuf {
            let path = self.root.join(name);
            let mut writer = zip::ZipWriter::new(File::create(&path).unwrap());
            for (entry, content) in entries {
                writer.start_file(*entry, SimpleFileOptions::default()).unwrap();
                writer.write_all(content.as_bytes()).unwrap();
            }
            writer.finish().unwrap();
            path
        }
        /// Cria um .7z. `symlink_attrs` marca a primeira entrada como atalho (atributos do 7z).
        fn sevenz(&self, name: &str, entries: &[(&str, &str)], symlink_attrs: Option<u32>) -> PathBuf {
            let path = self.root.join(name);
            let mut writer = sevenz_rust2::ArchiveWriter::new(File::create(&path).unwrap()).unwrap();
            for (index, (entry, content)) in entries.iter().enumerate() {
                let mut item = sevenz_rust2::ArchiveEntry::new_file(entry);
                if index == 0 {
                    if let Some(attrs) = symlink_attrs {
                        item.windows_attributes = attrs;
                        item.has_windows_attributes = true;
                    }
                }
                writer.push_archive_entry(item, Some(content.as_bytes())).unwrap();
            }
            writer.finish().unwrap();
            path
        }
        fn install(&self, archive: &Path) -> Result<InstallManifest, InstallError> {
            self.install_with(archive, Limits::default())
        }
        fn install_with(&self, archive: &Path, limits: Limits) -> Result<InstallManifest, InstallError> {
            let game = self.game();
            install_zip(&InstallRequest {
                archive,
                game_dir: &game,
                staging_root: &self.root.join("staging"),
                backup_root: &self.root.join("backups"),
                manifest_dir: &self.root.join("manifests"),
                install_id: "skyrim-1-2",
                mod_name: "Teste",
                limits,
            })
        }
        fn read(&self, rel: &str) -> String {
            fs::read_to_string(self.game().join(rel)).unwrap()
        }
    }

    impl Drop for Sandbox {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.root);
        }
    }

    #[test]
    fn installs_files_keeping_the_structure() {
        let sb = Sandbox::new();
        let zip = sb.zip("m.zip", &[("bin/x64/plugin.dll", "dll"), ("readme.txt", "oi")]);
        let manifest = sb.install(&zip).unwrap();
        assert_eq!(sb.read("bin/x64/plugin.dll"), "dll");
        assert_eq!(sb.read("readme.txt"), "oi");
        assert_eq!(manifest.files.len(), 2);
        assert!(manifest.files.iter().all(|f| f.backup.is_none() && !f.sha256.is_empty()));
    }

    #[test]
    fn strips_a_wrapper_folder_the_game_does_not_have() {
        let sb = Sandbox::new();
        let zip = sb.zip("m.zip", &[("MeuMod-1.2/mods/a.txt", "a"), ("MeuMod-1.2/mods/b.txt", "b")]);
        sb.install(&zip).unwrap();
        assert_eq!(sb.read("mods/a.txt"), "a");
        assert!(!sb.game().join("MeuMod-1.2").exists());
    }

    #[test]
    fn keeps_a_top_folder_the_game_already_has() {
        let sb = Sandbox::new();
        fs::create_dir_all(sb.game().join("Data")).unwrap();
        let zip = sb.zip("m.zip", &[("data/textures/t.dds", "t")]);
        sb.install(&zip).unwrap();
        // `data` (minúsculo) é a pasta `Data` do jogo: a estrutura do mod é preservada
        assert_eq!(fs::read_to_string(sb.game().join("Data/textures/t.dds")).unwrap(), "t");
    }

    #[test]
    fn loose_plugins_go_to_the_data_folder_when_it_exists() {
        let sb = Sandbox::new();
        fs::create_dir_all(sb.game().join("Data")).unwrap();
        let zip = sb.zip("m.zip", &[("Conflict.esp", "esp"), ("Conflict.bsa", "bsa")]);
        sb.install(&zip).unwrap();
        assert_eq!(fs::read_to_string(sb.game().join("Data/Conflict.esp")).unwrap(), "esp");
        assert!(!sb.game().join("Conflict.esp").exists());
    }

    #[test]
    fn loose_plugins_stay_at_the_root_when_there_is_no_data_folder() {
        let sb = Sandbox::new();
        let zip = sb.zip("m.zip", &[("Conflict.esp", "esp")]);
        sb.install(&zip).unwrap();
        assert_eq!(sb.read("Conflict.esp"), "esp");
    }

    #[test]
    fn rejects_zip_slip_and_leaves_the_game_untouched() {
        let sb = Sandbox::new();
        let zip = sb.zip("m.zip", &[("ok.txt", "ok"), ("../evil.txt", "mal")]);
        let err = sb.install(&zip).unwrap_err();
        assert!(matches!(err, InstallError::UnsafePath(_)), "{err:?}");
        assert!(!sb.root.join("evil.txt").exists());
        assert!(!sb.game().join("ok.txt").exists());
    }

    #[test]
    fn rejects_absolute_and_drive_paths() {
        for bad in ["/etc/passwd", "C:/Windows/x.dll", "C:evil.txt"] {
            let sb = Sandbox::new();
            let zip = sb.zip("m.zip", &[(bad, "x")]);
            assert!(matches!(sb.install(&zip).unwrap_err(), InstallError::UnsafePath(_)), "{bad}");
        }
    }

    #[test]
    fn ignores_system_junk_inside_the_zip() {
        let sb = Sandbox::new();
        let zip = sb.zip("m.zip", &[("a.txt", "a"), ("__MACOSX/._a.txt", "x"), ("Thumbs.db", "x")]);
        let manifest = sb.install(&zip).unwrap();
        assert_eq!(manifest.files.len(), 1);
    }

    #[test]
    fn rejects_unsupported_formats_with_a_clear_error() {
        let sb = Sandbox::new();
        let path = sb.root.join("m.tar");
        fs::write(&path, b"x").unwrap();
        assert!(matches!(sb.install(&path).unwrap_err(), InstallError::UnsupportedFormat(ext) if ext == "tar"));
    }

    #[test]
    fn extensionless_archive_is_recognised_by_content() {
        let sb = Sandbox::new();
        let rar = sb.root.join("ab820667-cf10-4a78-a1d7-de4b416e9433");
        fs::write(&rar, b"Rar!\x1a\x07\x00").unwrap();
        assert_eq!(sniff_archive_extension(&rar), Some("rar"));
        assert!(matches!(sb.install(&rar).unwrap_err(), InstallError::RarNotSupported));

        let junk = sb.root.join("notes");
        fs::write(&junk, b"hello").unwrap();
        assert_eq!(sniff_archive_extension(&junk), None);
        assert!(matches!(sb.install(&junk).unwrap_err(), InstallError::UnsupportedFormat(_)));
    }

    #[test]
    fn rar_is_reported_as_not_supported_with_instructions() {
        let sb = Sandbox::new();
        let path = sb.root.join("m.rar");
        fs::write(&path, b"Rar!").unwrap();
        let err = sb.install(&path).unwrap_err();
        assert!(matches!(err, InstallError::RarNotSupported));
        assert!(err.to_string().contains("7-Zip"));
        assert_eq!(fs::read_dir(sb.game()).unwrap().count(), 0);
    }

    // ── 7z: as mesmas garantias do ZIP ───────────────────────────────────────

    #[test]
    fn sevenz_installs_with_the_same_layout_rules() {
        let sb = Sandbox::new();
        fs::create_dir_all(sb.game().join("Data")).unwrap();
        let archive = sb.sevenz("m.7z", &[("MeuMod-2.0/Conflict.esp", "esp"), ("MeuMod-2.0/Conflict.bsa", "bsa")], None);
        let manifest = sb.install(&archive).unwrap();
        // embrulho descartado e plugins na pasta Data, como no ZIP
        assert_eq!(fs::read_to_string(sb.game().join("Data/Conflict.esp")).unwrap(), "esp");
        assert_eq!(manifest.files.len(), 2);
    }

    #[test]
    fn sevenz_backs_up_overwritten_files_and_uninstall_restores_them() {
        let sb = Sandbox::new();
        fs::write(sb.game().join("config.ini"), "original").unwrap();
        let archive = sb.sevenz("m.7z", &[("config.ini", "modificado"), ("novo/a.txt", "novo")], None);
        sb.install(&archive).unwrap();
        assert_eq!(sb.read("config.ini"), "modificado");
        let report = uninstall(&sb.root.join("manifests/skyrim-1-2.json")).unwrap();
        assert_eq!(report, UninstallReport { restored: 1, removed: 1, skipped: 0 });
        assert_eq!(sb.read("config.ini"), "original");
        assert!(!sb.game().join("novo").exists());
    }

    #[test]
    fn sevenz_rejects_zip_slip_and_leaves_the_game_untouched() {
        let sb = Sandbox::new();
        let archive = sb.sevenz("m.7z", &[("ok.txt", "ok"), ("../evil.txt", "mal")], None);
        let err = sb.install(&archive).unwrap_err();
        assert!(matches!(err, InstallError::UnsafePath(_)), "{err:?}");
        assert!(!sb.root.join("evil.txt").exists());
        assert!(!sb.game().join("ok.txt").exists());
    }

    #[test]
    fn sevenz_rejects_absolute_and_drive_paths() {
        for bad in ["/etc/passwd", "C:/Windows/x.dll", "C:evil.txt"] {
            let sb = Sandbox::new();
            let archive = sb.sevenz("m.7z", &[(bad, "x")], None);
            assert!(matches!(sb.install(&archive).unwrap_err(), InstallError::UnsafePath(_)), "{bad}");
        }
    }

    #[test]
    fn sevenz_rejects_symlinks_and_reparse_points() {
        for attrs in [ATTR_REPARSE_POINT, ATTR_UNIX_EXTENSION | (0o120777 << 16)] {
            let sb = Sandbox::new();
            let archive = sb.sevenz("m.7z", &[("atalho", "../fora"), ("ok.txt", "ok")], Some(attrs));
            let err = sb.install(&archive).unwrap_err();
            assert!(matches!(err, InstallError::UnsafePath(_)), "attrs {attrs:#x}: {err:?}");
            assert_eq!(fs::read_dir(sb.game()).unwrap().count(), 0);
        }
    }

    #[test]
    fn sevenz_regular_files_with_unix_mode_are_not_mistaken_for_links() {
        let sb = Sandbox::new();
        let archive = sb.sevenz("m.7z", &[("a.txt", "a")], Some(ATTR_UNIX_EXTENSION | (0o100644 << 16)));
        sb.install(&archive).unwrap();
        assert_eq!(sb.read("a.txt"), "a");
    }

    #[test]
    fn sevenz_enforces_the_file_count_and_size_limits_before_extracting() {
        let sb = Sandbox::new();
        let archive = sb.sevenz("m.7z", &[("a", "1"), ("b", "2"), ("c", "3")], None);
        let err = sb.install_with(&archive, Limits { max_files: 2, max_total_bytes: MAX_TOTAL_BYTES }).unwrap_err();
        assert!(matches!(err, InstallError::TooManyFiles(3)));

        let archive = sb.sevenz("g.7z", &[("a", "0123456789")], None);
        let err = sb.install_with(&archive, Limits { max_files: 10, max_total_bytes: 5 }).unwrap_err();
        assert!(matches!(err, InstallError::TooLarge));
        // recusado pelo cabeçalho: nada foi extraído para o preparo
        assert!(!sb.root.join("staging").join("skyrim-1-2").join("a").exists());
    }

    #[test]
    fn sevenz_corrupt_file_is_reported_without_touching_the_game() {
        let sb = Sandbox::new();
        let path = sb.root.join("m.7z");
        fs::write(&path, b"isto nao e um 7z").unwrap();
        assert!(matches!(sb.install(&path).unwrap_err(), InstallError::CorruptArchive(_)));
        assert_eq!(fs::read_dir(sb.game()).unwrap().count(), 0);
    }

    #[test]
    fn sevenz_truncated_archive_never_installs_a_partial_mod() {
        let sb = Sandbox::new();
        let archive = sb.sevenz("m.7z", &[("a.txt", &"x".repeat(5000)), ("b.txt", &"y".repeat(5000))], None);
        let bytes = fs::read(&archive).unwrap();
        fs::write(&archive, &bytes[..bytes.len() / 2]).unwrap();
        assert!(sb.install(&archive).is_err());
        assert_eq!(fs::read_dir(sb.game()).unwrap().count(), 0, "o jogo continua intocado");
    }

    #[test]
    fn sevenz_ignores_system_junk() {
        let sb = Sandbox::new();
        let archive = sb.sevenz("m.7z", &[("a.txt", "a"), ("__MACOSX/._a.txt", "x"), ("Thumbs.db", "x")], None);
        assert_eq!(sb.install(&archive).unwrap().files.len(), 1);
    }

    #[test]
    fn corrupt_zip_is_reported_without_touching_the_game() {
        let sb = Sandbox::new();
        let path = sb.root.join("m.zip");
        fs::write(&path, b"isto nao e um zip").unwrap();
        assert!(matches!(sb.install(&path).unwrap_err(), InstallError::CorruptArchive(_)));
        assert_eq!(fs::read_dir(sb.game()).unwrap().count(), 0);
    }

    #[test]
    fn enforces_the_file_count_limit() {
        let sb = Sandbox::new();
        let zip = sb.zip("m.zip", &[("a", "1"), ("b", "2"), ("c", "3")]);
        let err = sb.install_with(&zip, Limits { max_files: 2, max_total_bytes: MAX_TOTAL_BYTES }).unwrap_err();
        assert!(matches!(err, InstallError::TooManyFiles(_)));
    }

    #[test]
    fn enforces_the_size_limit() {
        let sb = Sandbox::new();
        let zip = sb.zip("m.zip", &[("a", "0123456789")]);
        let err = sb.install_with(&zip, Limits { max_files: 10, max_total_bytes: 5 }).unwrap_err();
        assert!(matches!(err, InstallError::TooLarge));
    }

    #[test]
    fn backs_up_overwritten_files_and_uninstall_restores_them() {
        let sb = Sandbox::new();
        fs::write(sb.game().join("config.ini"), "original").unwrap();
        let zip = sb.zip("m.zip", &[("config.ini", "modificado"), ("novo/arquivo.txt", "novo")]);
        let manifest = sb.install(&zip).unwrap();
        assert_eq!(sb.read("config.ini"), "modificado");
        assert!(manifest.files.iter().any(|f| f.rel == "config.ini" && f.backup.is_some()));
        assert_eq!(manifest.created_dirs, vec!["novo".to_string()]);

        let report = uninstall(&sb.root.join("manifests/skyrim-1-2.json")).unwrap();
        assert_eq!(report, UninstallReport { restored: 1, removed: 1, skipped: 0 });
        assert_eq!(sb.read("config.ini"), "original");
        assert!(!sb.game().join("novo").exists(), "a pasta criada pelo mod some");
        assert!(!sb.root.join("manifests/skyrim-1-2.json").exists());
        assert!(!sb.root.join("backups/skyrim-1-2").exists());
    }

    #[test]
    fn uninstall_does_not_touch_files_changed_after_the_install() {
        let sb = Sandbox::new();
        let zip = sb.zip("m.zip", &[("a.txt", "do mod")]);
        sb.install(&zip).unwrap();
        fs::write(sb.game().join("a.txt"), "outro mod mexeu").unwrap();
        let report = uninstall(&sb.root.join("manifests/skyrim-1-2.json")).unwrap();
        assert_eq!(report, UninstallReport { restored: 0, removed: 0, skipped: 1 });
        assert_eq!(sb.read("a.txt"), "outro mod mexeu");
    }

    #[test]
    fn a_failure_midway_rolls_everything_back() {
        let sb = Sandbox::new();
        fs::write(sb.game().join("a.txt"), "original").unwrap();
        // `b.txt` é uma pasta no jogo: não dá para sobrescrever, e vem depois de `a.txt`
        fs::create_dir_all(sb.game().join("b.txt")).unwrap();
        let zip = sb.zip("m.zip", &[("a.txt", "do mod"), ("b.txt", "do mod"), ("z/c.txt", "do mod")]);
        assert!(sb.install(&zip).is_err());
        assert_eq!(sb.read("a.txt"), "original", "o que já tinha sido trocado volta");
        assert!(!sb.game().join("z").exists());
        assert!(!sb.root.join("manifests/skyrim-1-2.json").exists());
    }

    #[test]
    fn installing_over_an_installed_mod_is_refused_so_backups_survive() {
        let sb = Sandbox::new();
        fs::write(sb.game().join("a.txt"), "original").unwrap();
        let zip = sb.zip("m.zip", &[("a.txt", "v1")]);
        sb.install(&zip).unwrap();
        assert!(matches!(sb.install(&zip).unwrap_err(), InstallError::AlreadyInstalled(_)));
        assert_eq!(sb.read("a.txt"), "v1");
        // desinstalar antes de reinstalar mantém o original a salvo
        uninstall(&sb.root.join("manifests/skyrim-1-2.json")).unwrap();
        sb.install(&zip).unwrap();
        uninstall(&sb.root.join("manifests/skyrim-1-2.json")).unwrap();
        assert_eq!(sb.read("a.txt"), "original");
    }

    #[test]
    fn manifest_paths_use_forward_slashes() {
        let sb = Sandbox::new();
        // um arquivo na raiz impede o descarte da pasta `a`, então o caminho inteiro é mantido
        let zip = sb.zip("m.zip", &[("a\\b\\c.txt", "x"), ("leia.txt", "y")]);
        let manifest = sb.install(&zip).unwrap();
        assert!(manifest.files.iter().any(|f| f.rel == "a/b/c.txt"), "{:?}", manifest.files);
        assert!(manifest.files.iter().all(|f| !f.rel.contains('\\')));
    }
}
