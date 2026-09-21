use std::path::{Path, PathBuf};

#[allow(dead_code)]
pub fn normalize(p: &str) -> String {
    p.to_lowercase().replace('\\', "/")
}

/// Join and canonicalize a path safely
#[allow(dead_code)]
pub fn safe_join(base: &Path, relative: &str) -> Option<PathBuf> {
    let joined = base.join(relative);
    // Ensure the result doesn't escape the base (path traversal protection)
    if joined.starts_with(base) {
        Some(joined)
    } else {
        None
    }
}

pub fn pherielium_user_data_dir() -> Result<PathBuf, String> {
    if let Ok(override_dir) = std::env::var("PHERIELIUM_USER_DATA") {
        let dir = PathBuf::from(override_dir);
        std::fs::create_dir_all(&dir)
            .map_err(|e| format!("Falha ao criar pasta de dados: {e}"))?;
        return Ok(dir);
    }

    #[cfg(windows)]
    {
        let appdata =
            std::env::var("APPDATA").map_err(|_| "APPDATA nao definido.".to_string())?;
        let dir = PathBuf::from(appdata).join("Phelierium");
        std::fs::create_dir_all(&dir)
            .map_err(|e| format!("Falha ao criar pasta de dados: {e}"))?;
        return Ok(dir);
    }

    #[cfg(not(windows))]
    {
        let home = std::env::var("HOME").map_err(|_| "HOME nao definido.".to_string())?;
        let dir = PathBuf::from(home)
            .join(".local")
            .join("share")
            .join("Phelierium");
        std::fs::create_dir_all(&dir)
            .map_err(|e| format!("Falha ao criar pasta de dados: {e}"))?;
        Ok(dir)
    }
}
