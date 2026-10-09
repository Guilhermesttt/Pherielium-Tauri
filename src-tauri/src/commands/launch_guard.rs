//! Validação do que o frontend pode mandar executar. Com XSS, `launcher_open_executable` seria
//! execução remota de código; estas regras reduzem a superfície (não substituem a CSP).

use std::path::{Path, PathBuf};

const ALLOWED_EXTENSIONS: &[&str] = &["exe", "bat", "cmd", "com"];
/// Variáveis que mudam como o Windows resolve programas/DLLs: nunca vêm do frontend.
const BLOCKED_ENV: &[&str] = &["PATH", "PATHEXT", "COMSPEC", "SYSTEMROOT", "WINDIR", "NODE_OPTIONS", "LD_PRELOAD"];

pub fn validate_executable(path: &str) -> Result<PathBuf, String> {
    let p = Path::new(path.trim());
    if path.contains('\0') {
        return Err("Caminho invalido.".into());
    }
    if !p.is_absolute() {
        return Err("O caminho do executavel precisa ser absoluto.".into());
    }
    let s = p.to_string_lossy();
    if s.starts_with(r"\\") && !s.starts_with(r"\?\") {
        return Err("Caminhos de rede (UNC) nao sao permitidos.".into());
    }
    if p.components().any(|c| matches!(c, std::path::Component::ParentDir)) {
        return Err("Caminho com '..' nao e permitido.".into());
    }
    let ext = p.extension().and_then(|e| e.to_str()).map(|e| e.to_ascii_lowercase()).unwrap_or_default();
    if !ALLOWED_EXTENSIONS.contains(&ext.as_str()) {
        return Err(format!("Tipo de arquivo nao permitido: .{ext}"));
    }
    if !p.is_file() {
        return Err(format!("Executable not found: {path}"));
    }
    Ok(p.to_path_buf())
}

pub fn validate_env(key: &str, value: &str) -> Result<(), String> {
    let bad = key.is_empty() || key.contains(['=', '\0']) || value.contains('\0');
    if bad || BLOCKED_ENV.iter().any(|b| b.eq_ignore_ascii_case(key)) {
        return Err(format!("Variavel de ambiente nao permitida: {key}"));
    }
    Ok(())
}

pub fn validate_args(args: &[String]) -> Result<(), String> {
    if args.len() > 64 || args.iter().any(|a| a.contains('\0') || a.len() > 4096) {
        return Err("Argumentos de execucao invalidos.".into());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_relative_unc_and_traversal() {
        assert!(validate_executable("game.exe").is_err());
        assert!(validate_executable(r"\server\share\game.exe").is_err());
        assert!(validate_executable(r"C:\Games\..\Windows\evil.exe").is_err());
    }

    #[test]
    fn rejects_unlisted_extensions() {
        assert!(validate_executable(r"C:\Games\a.ps1").is_err());
        assert!(validate_executable(r"C:\Games\a.dll").is_err());
        assert!(validate_executable(r"C:\Games\a.vbs").is_err());
    }

    #[test]
    fn env_blocks_path_like_and_malformed() {
        assert!(validate_env("PATH", "x").is_err());
        assert!(validate_env("comspec", "x").is_err());
        assert!(validate_env("A=B", "x").is_err());
        assert!(validate_env("", "x").is_err());
        assert!(validate_env("DXVK_HUD", "fps").is_ok());
    }

    #[test]
    fn args_limits() {
        assert!(validate_args(&["-windowed".into()]).is_ok());
        assert!(validate_args(&vec!["a".to_string(); 65]).is_err());
        assert!(validate_args(&["a\0b".into()]).is_err());
    }
}
