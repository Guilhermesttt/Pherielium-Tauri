//! Download e instalação automática de mods da Nexus: do clique em "Instalar" até os arquivos na
//! pasta do jogo, sem a pessoa abrir pasta nenhuma.
//!
//! Dois caminhos até o link de download:
//! - **Premium:** a API devolve o link direto; o download começa assim que o botão é clicado.
//! - **Grátis:** a Nexus só entrega o link a quem clica em "Download lento" no site, que abre um
//!   link `nxm://` com `key` e `expires`. O Pherielium recebe esse link (ver `nexus_nxm_*`) e segue
//!   sozinho dali.
//!
//! A instalação em si mora em `mod_install` (preparo, backup, manifesto e desfazer).

use once_cell::sync::Lazy;
use reqwest::Url;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{command, AppHandle, Emitter};
use tauri_plugin_deep_link::DeepLinkExt;

use super::mod_install::{self, InstallError, InstallRequest, Limits};
use super::nexus::{
    load_nexus_key, nexus_client, nexus_download_dir, nexus_get, nexus_status_error, validate_numeric_id, validate_slug,
};

const STATE_EVENT: &str = "nexus:download-state";
const NXM_SCHEME: &str = "nxm";
/// Quanto tempo um pedido "preparado" espera o link `nxm://` chegar (a Nexus também expira o link).
const PENDING_TTL: Duration = Duration::from_secs(15 * 60);
/// Mais que isso num único arquivo de mod é praticamente sempre um erro.
const MAX_DOWNLOAD_BYTES: u64 = 8 * 1024 * 1024 * 1024;
const PROGRESS_EVERY: Duration = Duration::from_millis(250);

// ── Pastas do app ────────────────────────────────────────────────────────────

fn data_root() -> PathBuf {
    dirs::data_local_dir().unwrap_or_else(|| PathBuf::from(".")).join("Pherielium")
}
fn staging_dir() -> PathBuf {
    data_root().join("mod-staging")
}
fn backups_dir() -> PathBuf {
    data_root().join("mod-backups")
}
fn manifests_dir() -> PathBuf {
    data_root().join("mod-manifests")
}

/// `true` se `path` (já existente) está dentro de `root`. Evita que o front aponte comandos
/// de apagar/instalar para qualquer lugar do disco.
fn is_inside(root: &Path, path: &Path) -> bool {
    match (root.canonicalize(), path.canonicalize()) {
        (Ok(root), Ok(path)) => path.starts_with(root),
        _ => false,
    }
}

// ── Link nxm:// ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NxmLink {
    pub game_domain: String,
    pub mod_id: String,
    pub file_id: String,
    pub key: Option<String>,
    pub expires: Option<String>,
}

/// `nxm://<jogo>/mods/<id>/files/<id>?key=...&expires=...&user_id=...`
pub fn parse_nxm(raw: &str) -> Result<NxmLink, String> {
    let url = Url::parse(raw.trim()).map_err(|_| "Link nxm inválido.".to_string())?;
    if url.scheme() != NXM_SCHEME {
        return Err("Não é um link nxm.".to_string());
    }
    let game_domain = url.host_str().unwrap_or("").to_lowercase();
    validate_slug(&game_domain, "Jogo")?;

    let segments: Vec<&str> = url.path_segments().map(|s| s.collect()).unwrap_or_default();
    let (mod_id, file_id) = match segments.as_slice() {
        ["mods", mod_id, "files", file_id] => (*mod_id, *file_id),
        _ => return Err("Link nxm em formato inesperado.".to_string()),
    };
    validate_numeric_id(mod_id, "Mod")?;
    validate_numeric_id(file_id, "Arquivo")?;

    let query: HashMap<String, String> = url.query_pairs().map(|(k, v)| (k.into_owned(), v.into_owned())).collect();
    let token = |name: &str| {
        query
            .get(name)
            .filter(|v| !v.is_empty() && v.len() <= 256 && v.chars().all(|c| c.is_ascii_alphanumeric() || "-_".contains(c)))
            .cloned()
    };
    Ok(NxmLink {
        game_domain,
        mod_id: mod_id.to_string(),
        file_id: file_id.to_string(),
        key: token("key"),
        expires: token("expires"),
    })
}

// ── Nomes e endereços ────────────────────────────────────────────────────────

/// Nome de arquivo seguro para o Windows: sem pastas, sem caracteres proibidos, nunca vazio.
pub fn sanitize_filename(raw: &str) -> String {
    let last = raw.rsplit(['/', '\\']).next().unwrap_or("");
    let cleaned: String = last
        .chars()
        .map(|c| if c.is_control() || "<>:\"/\\|?*".contains(c) { '_' } else { c })
        .collect();
    let cleaned = cleaned.trim().trim_matches('.').to_string();
    if cleaned.is_empty() { "mod.zip".to_string() } else { cleaned.chars().take(150).collect() }
}

/// `<mod>-<arquivo>-<nome>.zip` (como o download nomeia os arquivos do CDN sem nome próprio)
/// → `(mod, arquivo, nome sem extensão)`. `None` para qualquer outro nome.
pub fn parse_download_name(filename: &str) -> Option<(String, String, String)> {
    let mut parts = filename.splitn(3, '-');
    let (mod_id, file_id, rest) = (parts.next()?, parts.next()?, parts.next()?);
    let is_id = |s: &str| !s.is_empty() && s.len() <= 12 && s.bytes().all(|b| b.is_ascii_digit());
    if !is_id(mod_id) || !is_id(file_id) || rest.is_empty() {
        return None;
    }
    let stem = Path::new(rest).file_stem()?.to_string_lossy().into_owned();
    Some((mod_id.to_string(), file_id.to_string(), stem))
}

fn percent_decode(input: &str) -> String {
    let bytes = input.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            // trabalha em bytes: fatiar o &str no meio de um caractere acentuado daria pânico
            let decoded = std::str::from_utf8(&bytes[i + 1..i + 3])
                .ok()
                .and_then(|hex| u8::from_str_radix(hex, 16).ok());
            if let Some(value) = decoded {
                out.push(value);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

/// A API devolve o endereço do CDN; só se aceita HTTPS em domínios da própria Nexus.
pub fn validate_cdn_url(raw: &str) -> Result<Url, String> {
    let url = Url::parse(raw).map_err(|_| "A Nexus devolveu um endereço de download inválido.".to_string())?;
    let host = url.host_str().unwrap_or("").to_lowercase();
    let trusted = host == "nexusmods.com"
        || host.ends_with(".nexusmods.com")
        || host == "nexus-cdn.com"
        || host.ends_with(".nexus-cdn.com");
    if url.scheme() == "https" && trusted {
        Ok(url)
    } else {
        Err("A Nexus devolveu um endereço de download fora dos servidores dela; por segurança, não baixei.".to_string())
    }
}

fn file_name_from_url(url: &Url) -> String {
    let last = url.path_segments().and_then(|mut s| s.next_back()).unwrap_or("");
    sanitize_filename(&percent_decode(last))
}

// ── Pasta do jogo ────────────────────────────────────────────────────────────

/// Recusa pastas em que instalar mods seria perigoso: raiz do disco, pasta do Windows ou o perfil
/// inteiro do usuário. `windir`/`home` entram por parâmetro para o teste não depender da máquina.
pub fn is_safe_game_dir(canon: &Path, windir: Option<&Path>, home: Option<&Path>) -> bool {
    // `C:\` (ou `\\?\C:\`) tem só prefixo e raiz: é o disco inteiro, não a pasta de um jogo
    if canon.components().count() <= 2 {
        return false;
    }
    if let Some(win) = windir {
        if canon.starts_with(win) {
            return false;
        }
    }
    if let Some(h) = home {
        if canon == h {
            return false;
        }
    }
    true
}

fn resolve_game_dir(raw: &str) -> Result<PathBuf, String> {
    let path = Path::new(raw.trim());
    if raw.trim().is_empty() || !path.is_dir() {
        return Err("A pasta do jogo não existe. Escolha a pasta de instalação do jogo.".to_string());
    }
    let canon = path.canonicalize().map_err(|_| "Não foi possível acessar a pasta do jogo.".to_string())?;
    let windir = std::env::var_os("WINDIR").map(PathBuf::from).and_then(|p| p.canonicalize().ok());
    let home = dirs::home_dir().and_then(|p| p.canonicalize().ok());
    if is_safe_game_dir(&canon, windir.as_deref(), home.as_deref()) {
        Ok(canon)
    } else {
        Err("Essa pasta não é segura para instalar mods. Escolha a pasta do jogo.".to_string())
    }
}

// ── Estado compartilhado com a tela ──────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct DownloadState {
    pub id: String,
    pub status: String,
    pub game_domain: String,
    pub mod_id: String,
    pub file_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub received_bytes: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total_bytes: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub filename: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub installed: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub installed_files: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub backed_up_files: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub manifest_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub installation_error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mod_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mod_author: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub picture_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_code: Option<String>,
    pub updated_at: u64,
}

#[derive(Debug, Clone)]
struct Pending {
    game_folder: String,
    mod_name: String,
    mod_author: String,
    picture_url: String,
    version: String,
    created: Instant,
}

#[derive(Default)]
struct Registry {
    pending: HashMap<String, Pending>,
    current: Option<DownloadState>,
}

static REGISTRY: Lazy<Mutex<Registry>> = Lazy::new(|| Mutex::new(Registry::default()));

fn pending_key(domain: &str, mod_id: &str, file_id: &str) -> String {
    format!("{domain}/{mod_id}/{file_id}")
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn publish(app: &AppHandle, mut state: DownloadState) {
    state.updated_at = now_ms();
    if let Ok(mut registry) = REGISTRY.lock() {
        registry.current = Some(state.clone());
    }
    // emit_to: só a janela principal precisa deste estado
    if let Err(err) = app.emit_to("main", STATE_EVENT, &state) {
        log::warn!("[nexus] não foi possível emitir o estado do download: {err}");
    }
}

fn fail(app: &AppHandle, mut state: DownloadState, code: &str, message: impl Into<String>) {
    state.status = "error".to_string();
    state.error = Some(message.into());
    state.error_code = Some(code.to_string());
    publish(app, state);
}

// ── Pipeline ─────────────────────────────────────────────────────────────────

/// Pede o link de download à API. Sem `key`/`expires` só funciona para contas Premium.
async fn resolve_download_url(link: &NxmLink, api_key: &str) -> Result<Url, String> {
    let mut endpoint = format!(
        "/games/{}/mods/{}/files/{}/download_link.json",
        link.game_domain, link.mod_id, link.file_id
    );
    if let (Some(key), Some(expires)) = (&link.key, &link.expires) {
        endpoint.push_str(&format!("?key={key}&expires={expires}"));
    }
    let (value, _rate) = nexus_get(&endpoint, api_key).await?;
    let uri = value
        .as_array()
        .and_then(|list| list.first())
        .and_then(|item| item["URI"].as_str())
        .ok_or_else(|| "A Nexus não devolveu um link de download.".to_string())?;
    validate_cdn_url(uri)
}

async fn download_to(
    app: &AppHandle,
    url: &Url,
    dir: &Path,
    state: &mut DownloadState,
) -> Result<PathBuf, String> {
    tokio::fs::create_dir_all(dir)
        .await
        .map_err(|e| format!("Não foi possível criar a pasta de downloads: {e}"))?;
    let filename = file_name_from_url(url);
    let final_path = dir.join(&filename);
    let part_path = dir.join(format!("{filename}.part"));

    let mut response = nexus_client()
        .get(url.clone())
        .timeout(Duration::from_secs(60 * 60))
        .send()
        .await
        .map_err(|_| "Sem conexão para baixar o mod. Verifique sua internet.".to_string())?;
    if !response.status().is_success() {
        return Err(nexus_status_error(response.status()));
    }
    let total = response.content_length();
    if total.map(|t| t > MAX_DOWNLOAD_BYTES).unwrap_or(false) {
        return Err("O arquivo do mod é grande demais para baixar automaticamente.".to_string());
    }

    state.status = "downloading".to_string();
    state.filename = Some(filename.clone());
    state.total_bytes = total;
    state.received_bytes = Some(0);
    publish(app, state.clone());

    use tokio::io::AsyncWriteExt;
    let mut file = tokio::fs::File::create(&part_path)
        .await
        .map_err(|e| format!("Não foi possível gravar o download: {e}"))?;
    let mut received: u64 = 0;
    let mut last_emit = Instant::now();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|_| "A conexão caiu durante o download.".to_string())?
    {
        received += chunk.len() as u64;
        if received > MAX_DOWNLOAD_BYTES {
            let _ = tokio::fs::remove_file(&part_path).await;
            return Err("O arquivo do mod é grande demais para baixar automaticamente.".to_string());
        }
        file.write_all(&chunk).await.map_err(|e| format!("Erro ao gravar o download: {e}"))?;
        if last_emit.elapsed() >= PROGRESS_EVERY {
            state.received_bytes = Some(received);
            publish(app, state.clone());
            last_emit = Instant::now();
        }
    }
    file.flush().await.map_err(|e| format!("Erro ao gravar o download: {e}"))?;
    drop(file);

    // arquivo incompleto nunca vira "pronto": o tamanho tem de bater com o que a Nexus anunciou
    if let Some(expected) = total {
        if received != expected {
            let _ = tokio::fs::remove_file(&part_path).await;
            return Err("O download veio incompleto. Tente de novo.".to_string());
        }
    }
    // o CDN às vezes serve o arquivo sob um identificador sem extensão: o nome ganha a do conteúdo
    let has_known_ext = final_path
        .extension()
        .and_then(|e| e.to_str())
        .is_some_and(|e| matches!(e.to_lowercase().as_str(), "zip" | "7z" | "rar"));
    // e o nome do identificador vira "<mod>-<arquivo>-<nome do mod>", para a lista de baixados saber
    // de qual mod é cada arquivo (ver `parse_download_name`) e para reinstalar não acumular cópias
    let final_path = match (has_known_ext, mod_install::sniff_archive_extension(&part_path)) {
        (false, Some(ext)) => {
            // sem barras: `sanitize_filename` ficaria só com o que vem depois da última
            let name = state.mod_name.as_deref().unwrap_or("mod").replace(['/', '\\'], "_");
            let named = sanitize_filename(&format!("{}-{}-{}", state.mod_id, state.file_id, name));
            state.filename = Some(format!("{named}.{ext}"));
            dir.join(format!("{named}.{ext}"))
        }
        _ => final_path,
    };
    tokio::fs::rename(&part_path, &final_path)
        .await
        .map_err(|e| format!("Não foi possível finalizar o download: {e}"))?;
    state.received_bytes = Some(received);
    Ok(final_path)
}

#[derive(Debug)]
struct InstallOutcome {
    installed_files: usize,
    backed_up_files: usize,
    manifest_path: PathBuf,
}

/// Instala o ZIP na pasta do jogo. Se este mod já estava instalado (outra versão), a anterior é
/// desfeita primeiro, devolvendo os arquivos originais, para a atualização não acumular cópias.
fn install_archive(
    archive: &Path,
    game_dir: &Path,
    game_domain: &str,
    mod_id: &str,
    mod_name: &str,
) -> Result<InstallOutcome, InstallError> {
    let install_id = format!("{game_domain}-{mod_id}");
    let manifest_path = mod_install::manifest_path_for(&manifests_dir(), &install_id);
    if manifest_path.exists() {
        mod_install::uninstall(&manifest_path)?;
    }
    let manifest = mod_install::install_zip(&InstallRequest {
        archive,
        game_dir,
        staging_root: &staging_dir(),
        backup_root: &backups_dir(),
        manifest_dir: &manifests_dir(),
        install_id: &install_id,
        mod_name,
        limits: Limits::default(),
    })?;
    Ok(InstallOutcome {
        installed_files: manifest.files.len(),
        backed_up_files: manifest.files.iter().filter(|f| f.backup.is_some()).count(),
        manifest_path,
    })
}

fn install_error_code(error: &InstallError) -> &'static str {
    match error {
        InstallError::GameDirMissing(_) => "GAME_FOLDER_NOT_SET",
        InstallError::UnsafePath(_) => "INVALID_PATH",
        InstallError::Io { source, .. } if source.kind() == std::io::ErrorKind::StorageFull => "STORAGE_FULL",
        _ => "INSTALL_FAILED",
    }
}

async fn run_pipeline(app: AppHandle, link: NxmLink, pending: Option<Pending>) {
    let mut state = DownloadState {
        id: uuid::Uuid::new_v4().to_string(),
        status: "resolving".to_string(),
        game_domain: link.game_domain.clone(),
        mod_id: link.mod_id.clone(),
        file_id: link.file_id.clone(),
        mod_name: pending.as_ref().map(|p| p.mod_name.clone()),
        mod_author: pending.as_ref().map(|p| p.mod_author.clone()),
        picture_url: pending.as_ref().map(|p| p.picture_url.clone()),
        version: pending.as_ref().map(|p| p.version.clone()),
        ..Default::default()
    };
    publish(&app, state.clone());

    let Some(api_key) = load_nexus_key() else {
        return fail(&app, state, "UNKNOWN", "Conecte sua chave da Nexus antes de baixar mods.");
    };

    let url = match resolve_download_url(&link, &api_key).await {
        Ok(url) => url,
        Err(message) => return fail(&app, state, "NETWORK_FAILURE", message),
    };

    let dir = nexus_download_dir(&link.game_domain);
    let path = match download_to(&app, &url, &dir, &mut state).await {
        Ok(path) => path,
        Err(message) => return fail(&app, state, "NETWORK_FAILURE", message),
    };
    state.file_path = Some(path.to_string_lossy().into_owned());

    // sem pasta do jogo configurada, o arquivo fica baixado e a pessoa instala depois
    let game_folder = pending.as_ref().map(|p| p.game_folder.clone()).unwrap_or_default();
    if game_folder.trim().is_empty() {
        state.status = "completed".to_string();
        state.installed = Some(false);
        return publish(&app, state);
    }

    state.status = "installing".to_string();
    publish(&app, state.clone());

    let mod_name = state.mod_name.clone().unwrap_or_else(|| format!("Mod {}", link.mod_id));
    let (domain, mod_id) = (link.game_domain.clone(), link.mod_id.clone());
    let outcome = tokio::task::spawn_blocking(move || {
        let game_dir = resolve_game_dir(&game_folder).map_err(|m| (m, "GAME_FOLDER_NOT_SET"))?;
        install_archive(&path, &game_dir, &domain, &mod_id, &mod_name)
            .map_err(|e| (e.to_string(), install_error_code(&e)))
    })
    .await;

    state.status = "completed".to_string();
    match outcome {
        Ok(Ok(done)) => {
            state.installed = Some(true);
            state.installed_files = Some(done.installed_files);
            state.backed_up_files = Some(done.backed_up_files);
            state.manifest_path = Some(done.manifest_path.to_string_lossy().into_owned());
        }
        // o download deu certo; só a instalação falhou: o arquivo continua baixado
        Ok(Err((message, _code))) => {
            state.installed = Some(false);
            state.installation_error = Some(message);
        }
        Err(_) => {
            state.installed = Some(false);
            state.installation_error = Some("A instalação foi interrompida.".to_string());
        }
    }
    publish(&app, state);
}

fn spawn_pipeline(app: &AppHandle, link: NxmLink, pending: Option<Pending>) {
    let app = app.clone();
    tauri::async_runtime::spawn(async move { run_pipeline(app, link, pending).await });
}

// ── Pedidos vindos da tela ───────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrepareRequest {
    pub game_domain: String,
    pub mod_id: String,
    pub file_id: String,
    #[serde(default)]
    pub game_folder: String,
    #[serde(default)]
    pub mod_name: String,
    #[serde(default)]
    pub mod_author: String,
    #[serde(default)]
    pub picture_url: String,
    #[serde(default)]
    pub version: String,
}

/// Registra o que a pessoa quer instalar. Conta Premium baixa na hora; conta grátis espera o link
/// `nxm://` do "Download lento" (a tela abre a página do arquivo na Nexus).
#[command]
pub async fn nexus_prepare_free_download(app: AppHandle, request: PrepareRequest) -> Result<serde_json::Value, String> {
    validate_slug(&request.game_domain, "Jogo")?;
    validate_numeric_id(&request.mod_id, "Mod")?;
    validate_numeric_id(&request.file_id, "Arquivo")?;
    let Some(api_key) = load_nexus_key() else {
        return Err("Conecte sua chave da Nexus antes de baixar mods.".to_string());
    };
    let game_folder = if request.game_folder.trim().is_empty() {
        String::new()
    } else {
        resolve_game_dir(&request.game_folder)?.to_string_lossy().into_owned()
    };
    let auto_install = !game_folder.is_empty();

    let pending = Pending {
        game_folder,
        mod_name: request.mod_name.chars().take(200).collect(),
        mod_author: request.mod_author.chars().take(200).collect(),
        picture_url: request.picture_url.chars().take(1000).collect(),
        version: request.version.chars().take(80).collect(),
        created: Instant::now(),
    };
    let key = pending_key(&request.game_domain, &request.mod_id, &request.file_id);
    if let Ok(mut registry) = REGISTRY.lock() {
        registry.pending.retain(|_, p| p.created.elapsed() < PENDING_TTL);
        registry.pending.insert(key.clone(), pending.clone());
    }

    let (validate, _rate) = nexus_get("/users/validate.json", &api_key).await?;
    let premium = validate["is_premium"].as_bool().unwrap_or(false);
    if premium {
        if let Ok(mut registry) = REGISTRY.lock() {
            registry.pending.remove(&key);
        }
        let link = NxmLink {
            game_domain: request.game_domain,
            mod_id: request.mod_id,
            file_id: request.file_id,
            key: None,
            expires: None,
        };
        spawn_pipeline(&app, link, Some(pending));
    }

    Ok(serde_json::json!({
        "prepared": true,
        "autoInstall": auto_install,
        "direct": premium,
        "expiresAt": if premium { 0 } else { now_ms() + PENDING_TTL.as_millis() as u64 },
    }))
}

/// Os links `nxm://` entre os argumentos de linha de comando de um processo.
///
/// O Windows abre `pherielium.exe "nxm://..."`. O plugin deep-link ignora esquemas registrados em
/// tempo de execução (só processa os do tauri.conf.json, e `nxm` é opt-in), então o link precisa ser
/// lido direto dos argumentos, tanto na instância que abriu quanto na que já estava aberta.
pub fn nxm_links_in_args<S: AsRef<str>>(args: &[S]) -> Vec<&str> {
    args.iter()
        .map(AsRef::as_ref)
        .filter(|arg| {
            arg.get(..6)
                .map(|prefix| prefix.eq_ignore_ascii_case("nxm://"))
                .unwrap_or(false)
        })
        .collect()
}

/// Segue os links `nxm://` encontrados nos argumentos de linha de comando.
pub fn handle_nxm_args<S: AsRef<str>>(app: &AppHandle, args: &[S]) {
    for link in nxm_links_in_args(args) {
        handle_nxm_url(app, link);
    }
}

/// Recebe um link `nxm://` (do navegador, via protocolo registrado) e segue o download.
pub fn handle_nxm_url(app: &AppHandle, raw: &str) {
    let link = match parse_nxm(raw) {
        Ok(link) => link,
        Err(message) => {
            log::warn!("[nexus] link nxm ignorado: {message}");
            return;
        }
    };
    let pending = REGISTRY.lock().ok().and_then(|mut registry| {
        registry.pending.retain(|_, p| p.created.elapsed() < PENDING_TTL);
        registry.pending.remove(&pending_key(&link.game_domain, &link.mod_id, &link.file_id))
    });
    spawn_pipeline(app, link, pending);
}

#[command]
pub async fn nexus_get_download_state() -> Result<Option<DownloadState>, String> {
    Ok(REGISTRY.lock().ok().and_then(|registry| registry.current.clone()))
}

// ── Instalar / adotar / remover (arquivos já baixados) ──────────────────────

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallDownloadedRequest {
    pub game_domain: String,
    pub mod_id: String,
    #[serde(default)]
    pub file_id: Option<String>,
    pub file_path: String,
    pub game_folder: String,
    #[serde(default)]
    pub mod_name: String,
}

fn validate_archive_path(raw: &str, domain: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(raw);
    if !path.is_file() || !is_inside(&nexus_download_dir(domain), &path) {
        return Err("O arquivo do mod não está na pasta de downloads do Pherielium.".to_string());
    }
    Ok(path)
}

async fn install_existing(request: InstallDownloadedRequest) -> Result<(InstallOutcome, PathBuf), String> {
    validate_slug(&request.game_domain, "Jogo")?;
    validate_numeric_id(&request.mod_id, "Mod")?;
    let archive = validate_archive_path(&request.file_path, &request.game_domain)?;
    let game_dir = resolve_game_dir(&request.game_folder)?;
    let (domain, mod_id, name) = (request.game_domain.clone(), request.mod_id.clone(), request.mod_name.clone());
    let archive_for_task = archive.clone();
    let outcome = tokio::task::spawn_blocking(move || install_archive(&archive_for_task, &game_dir, &domain, &mod_id, &name))
        .await
        .map_err(|_| "A instalação foi interrompida.".to_string())?
        .map_err(|e| e.to_string())?;
    Ok((outcome, archive))
}

#[command]
pub async fn nexus_install_downloaded_mod(request: InstallDownloadedRequest) -> Result<DownloadState, String> {
    let mut state = DownloadState {
        id: uuid::Uuid::new_v4().to_string(),
        game_domain: request.game_domain.clone(),
        mod_id: request.mod_id.clone(),
        file_id: request.file_id.clone().unwrap_or_default(),
        mod_name: Some(request.mod_name.clone()),
        filename: Path::new(&request.file_path).file_name().map(|n| n.to_string_lossy().into_owned()),
        ..Default::default()
    };
    let (outcome, archive) = install_existing(request).await?;
    state.status = "completed".to_string();
    state.file_path = Some(archive.to_string_lossy().into_owned());
    state.installed = Some(true);
    state.installed_files = Some(outcome.installed_files);
    state.backed_up_files = Some(outcome.backed_up_files);
    state.manifest_path = Some(outcome.manifest_path.to_string_lossy().into_owned());
    state.updated_at = now_ms();
    Ok(state)
}

#[command]
pub async fn nexus_adopt_installed_mod(request: InstallDownloadedRequest) -> Result<serde_json::Value, String> {
    let (outcome, _archive) = install_existing(request).await?;
    Ok(serde_json::json!({
        "installedFiles": outcome.installed_files,
        "backedUpFiles": outcome.backed_up_files,
        "manifestPath": outcome.manifest_path.to_string_lossy(),
    }))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoveRequest {
    #[serde(default)]
    pub manifest_path: Option<String>,
    #[serde(default)]
    pub file_path: Option<String>,
    #[serde(default)]
    pub remove_archive: bool,
}

#[command]
pub async fn nexus_remove_installed_mod(request: RemoveRequest) -> Result<serde_json::Value, String> {
    let mut removed_from_game = false;
    if let Some(raw) = request.manifest_path.as_deref().filter(|p| !p.is_empty()) {
        let manifest = PathBuf::from(raw);
        if !manifest.is_file() || !is_inside(&manifests_dir(), &manifest) {
            return Err("O registro de instalação não foi encontrado.".to_string());
        }
        tokio::task::spawn_blocking(move || mod_install::uninstall(&manifest))
            .await
            .map_err(|_| "A remoção foi interrompida.".to_string())?
            .map_err(|e| e.to_string())?;
        removed_from_game = true;
    }

    let mut archive_removed = false;
    if request.remove_archive {
        if let Some(raw) = request.file_path.as_deref().filter(|p| !p.is_empty()) {
            let path = PathBuf::from(raw);
            let downloads_root = data_root().join("nexus-downloads");
            if path.is_file() && is_inside(&downloads_root, &path) {
                archive_removed = tokio::fs::remove_file(&path).await.is_ok();
            }
        }
    }
    Ok(serde_json::json!({ "removedFromGame": removed_from_game, "archiveRemoved": archive_removed }))
}

// ── Protocolo nxm:// (opt-in) ────────────────────────────────────────────────
//
// Registrar o protocolo tira os links "Mod Manager Download" de qualquer outro gerenciador (Vortex,
// Mod Organizer), então só acontece quando a pessoa pede.

#[command]
pub async fn nexus_nxm_status(app: AppHandle) -> Result<serde_json::Value, String> {
    let registered = app.deep_link().is_registered(NXM_SCHEME).map_err(|e| e.to_string())?;
    Ok(serde_json::json!({ "registered": registered }))
}

#[command]
pub async fn nexus_nxm_register(app: AppHandle) -> Result<serde_json::Value, String> {
    app.deep_link().register(NXM_SCHEME).map_err(|e| e.to_string())?;
    Ok(serde_json::json!({ "registered": true }))
}

#[command]
pub async fn nexus_nxm_unregister(app: AppHandle) -> Result<serde_json::Value, String> {
    app.deep_link().unregister(NXM_SCHEME).map_err(|e| e.to_string())?;
    Ok(serde_json::json!({ "registered": false }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn download_names_carry_the_mod_and_file_ids() {
        assert_eq!(
            parse_download_name("107-2345-Cyber Engine Tweaks.zip"),
            Some(("107".into(), "2345".into(), "Cyber Engine Tweaks".into()))
        );
        // nome com hífens: só os dois primeiros pedaços são ids
        assert_eq!(parse_download_name("1-2-a-b-c.7z").map(|p| p.2), Some("a-b-c".to_string()));
        assert_eq!(parse_download_name("ab820667-cf10-4a78-a1d7-de4b416e9433"), None);
        assert_eq!(parse_download_name("107-2345"), None);
    }

    #[test]
    fn picks_nxm_links_out_of_command_line_args() {
        let args = ["C:\\app\\pherielium.exe", "--flag", "nxm://skyrim/mods/1/files/2?key=a", "NXM://skyrim/mods/3/files/4", "https://x"];
        assert_eq!(
            nxm_links_in_args(&args),
            vec!["nxm://skyrim/mods/1/files/2?key=a", "NXM://skyrim/mods/3/files/4"]
        );
        assert!(nxm_links_in_args(&["nx", "é"]).is_empty());
    }

    #[test]
    fn parses_a_free_user_nxm_link() {
        let link = parse_nxm("nxm://skyrimspecialedition/mods/12345/files/67890?key=AbC-123_x&expires=1790000000&user_id=9").unwrap();
        assert_eq!(
            link,
            NxmLink {
                game_domain: "skyrimspecialedition".into(),
                mod_id: "12345".into(),
                file_id: "67890".into(),
                key: Some("AbC-123_x".into()),
                expires: Some("1790000000".into()),
            }
        );
    }

    #[test]
    fn parses_a_link_without_key_for_premium() {
        let link = parse_nxm("nxm://cyberpunk2077/mods/1/files/2").unwrap();
        assert_eq!((link.key, link.expires), (None, None));
    }

    #[test]
    fn rejects_malformed_or_hostile_links() {
        for bad in [
            "https://nexusmods.com/mods/1/files/2",
            "nxm://skyrim/mods/abc/files/2",
            "nxm://skyrim/mods/1/files/2/extra",
            "nxm://skyrim/files/1/mods/2",
            "nxm://../mods/1/files/2",
            "nxm://SKY RIM/mods/1/files/2",
            "isto nao e url",
            "",
        ] {
            assert!(parse_nxm(bad).is_err(), "deveria recusar {bad:?}");
        }
    }

    #[test]
    fn drops_key_and_expires_with_unsafe_characters() {
        let link = parse_nxm("nxm://skyrim/mods/1/files/2?key=a%26b%3Dc&expires=12;34").unwrap();
        assert_eq!((link.key, link.expires), (None, None), "caracteres fora de [A-Za-z0-9_-] não entram na URL da API");
    }

    #[test]
    fn sanitizes_file_names() {
        assert_eq!(sanitize_filename("Conflict Begone-1.2.4.zip"), "Conflict Begone-1.2.4.zip");
        assert_eq!(sanitize_filename("../../Windows/system32/evil.dll"), "evil.dll");
        assert_eq!(sanitize_filename("a<b>c:d.zip"), "a_b_c_d.zip");
        assert_eq!(sanitize_filename("..."), "mod.zip");
        assert_eq!(sanitize_filename(""), "mod.zip");
        assert!(sanitize_filename(&"x".repeat(500)).len() <= 150);
    }

    #[test]
    fn decodes_percent_escapes_in_urls() {
        assert_eq!(percent_decode("Conflict%20Begone%2D1.zip"), "Conflict Begone-1.zip");
        assert_eq!(percent_decode("100%"), "100%");
        assert_eq!(percent_decode("a%zzb"), "a%zzb");
    }

    #[test]
    fn only_trusts_https_nexus_hosts_for_downloads() {
        assert!(validate_cdn_url("https://cf-files.nexusmods.com/cdn/1/2/f.zip?md5=x").is_ok());
        assert!(validate_cdn_url("https://premium-files.nexus-cdn.com/f.zip").is_ok());
        for bad in [
            "http://cf-files.nexusmods.com/f.zip",
            "https://evilnexusmods.com/f.zip",
            "https://nexusmods.com.evil.io/f.zip",
            "https://example.com/f.zip",
            "ftp://nexusmods.com/f.zip",
            "lixo",
        ] {
            assert!(validate_cdn_url(bad).is_err(), "deveria recusar {bad:?}");
        }
    }

    #[test]
    fn derives_the_file_name_from_the_download_url() {
        let url = Url::parse("https://cf-files.nexusmods.com/cdn/1/2/Conflict%20Begone-1-2-4.zip?md5=abc").unwrap();
        assert_eq!(file_name_from_url(&url), "Conflict Begone-1-2-4.zip");
    }

    #[test]
    fn refuses_unsafe_game_folders() {
        let win = Path::new(r"C:\Windows");
        let home = Path::new(r"C:\Users\guilh");
        assert!(!is_safe_game_dir(Path::new(r"C:\"), Some(win), Some(home)), "raiz do disco");
        assert!(!is_safe_game_dir(Path::new(r"C:\Windows\System32"), Some(win), Some(home)));
        assert!(!is_safe_game_dir(home, Some(win), Some(home)), "o perfil inteiro");
        assert!(is_safe_game_dir(Path::new(r"C:\Games\Skyrim"), Some(win), Some(home)));
        assert!(is_safe_game_dir(Path::new(r"C:\Users\guilh\Games\Skyrim"), Some(win), Some(home)));
    }
}
