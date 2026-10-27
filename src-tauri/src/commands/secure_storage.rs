//! Cofre de sessão: guarda valores pequenos (a sessão do Supabase) no Gerenciador de
//! Credenciais do Windows, protegido por DPAPI, em vez de `localStorage`, que qualquer
//! script na página consegue ler.
//!
//! O Windows limita cada credencial a 2560 bytes e o keyring grava em UTF-16, então a
//! sessão (JWT + refresh token + usuário) não cabe em uma entrada só. O valor é fatiado
//! em pedaços de `CHUNK_CHARS` caracteres, mais uma entrada `<chave>#n` com a contagem.
//!
//! Este serviço é separado do da chave da Nexus: o front só alcança esta área, nunca os
//! outros segredos do app.

use tauri::command;

const SERVICE: &str = "pherielium-session";
/// 800 caracteres em UTF-16 = 1600 bytes, folga confortável sob o limite de 2560.
const CHUNK_CHARS: usize = 800;
const MAX_VALUE_CHARS: usize = 64 * 1024;

/// Chaves do `supabase-js` (`sb-<ref>-auth-token`, `...-code-verifier`) cabem aqui.
/// Recusar outros formatos impede o front de montar nomes que colidam com os metadados.
fn validate_key(key: &str) -> Result<(), String> {
    let ok = !key.is_empty()
        && key.len() <= 128
        && key
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '_' || c == '-');
    if ok {
        Ok(())
    } else {
        Err("Chave de armazenamento inválida".to_string())
    }
}

fn entry(service: &str, name: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new(service, name).map_err(|e| e.to_string())
}

fn count_name(key: &str) -> String {
    format!("{key}#n")
}

fn chunk_name(key: &str, index: usize) -> String {
    format!("{key}#{index}")
}

fn split_chunks(value: &str) -> Vec<String> {
    let chars: Vec<char> = value.chars().collect();
    chars
        .chunks(CHUNK_CHARS)
        .map(|c| c.iter().collect::<String>())
        .collect()
}

fn read_count(service: &str, key: &str) -> Option<usize> {
    entry(service, &count_name(key))
        .ok()?
        .get_password()
        .ok()?
        .parse()
        .ok()
}

fn delete_quietly(service: &str, name: &str) {
    if let Ok(e) = entry(service, name) {
        // NoEntry é o caso normal (nada para apagar); qualquer outro erro não deve travar o logout
        let _ = e.delete_credential();
    }
}

fn store_get(service: &str, key: &str) -> Result<Option<String>, String> {
    let Some(count) = read_count(service, key) else {
        return Ok(None);
    };
    let mut out = String::new();
    for index in 0..count {
        match entry(service, &chunk_name(key, index))?.get_password() {
            Ok(part) => out.push_str(&part),
            // pedaço faltando = valor corrompido: tratar como ausente, não como sessão parcial
            Err(_) => return Ok(None),
        }
    }
    Ok(Some(out))
}

fn store_set(service: &str, key: &str, value: &str) -> Result<(), String> {
    if value.chars().count() > MAX_VALUE_CHARS {
        return Err("Valor grande demais para o cofre".to_string());
    }
    let previous = read_count(service, key).unwrap_or(0);
    let chunks = split_chunks(value);

    for (index, part) in chunks.iter().enumerate() {
        entry(service, &chunk_name(key, index))?
            .set_password(part)
            .map_err(|e| e.to_string())?;
    }
    // a contagem vai por último: leitura concorrente nunca vê um valor pela metade
    entry(service, &count_name(key))?
        .set_password(&chunks.len().to_string())
        .map_err(|e| e.to_string())?;

    for index in chunks.len()..previous {
        delete_quietly(service, &chunk_name(key, index));
    }
    Ok(())
}

fn store_remove(service: &str, key: &str) {
    let count = read_count(service, key).unwrap_or(0);
    delete_quietly(service, &count_name(key));
    for index in 0..count {
        delete_quietly(service, &chunk_name(key, index));
    }
}

#[command]
pub async fn secure_storage_get(key: String) -> Result<Option<String>, String> {
    validate_key(&key)?;
    tauri::async_runtime::spawn_blocking(move || store_get(SERVICE, &key))
        .await
        .map_err(|e| e.to_string())?
}

#[command]
pub async fn secure_storage_set(key: String, value: String) -> Result<(), String> {
    validate_key(&key)?;
    tauri::async_runtime::spawn_blocking(move || store_set(SERVICE, &key, &value))
        .await
        .map_err(|e| e.to_string())?
}

#[command]
pub async fn secure_storage_remove(key: String) -> Result<(), String> {
    validate_key(&key)?;
    tauri::async_runtime::spawn_blocking(move || store_remove(SERVICE, &key))
        .await
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn key_validation_accepts_supabase_keys_only() {
        assert!(validate_key("sb-abcdefgh-auth-token").is_ok());
        assert!(validate_key("sb-abcdefgh-auth-token-code-verifier").is_ok());
        for bad in ["", "a/b", "a b", "a#1", "a\\b", "../x"] {
            assert!(validate_key(bad).is_err(), "deveria recusar {bad:?}");
        }
        assert!(validate_key(&"a".repeat(129)).is_err());
    }

    #[test]
    fn long_values_are_split_below_the_windows_limit() {
        let value = "é".repeat(CHUNK_CHARS * 3 + 5);
        let chunks = split_chunks(&value);
        assert_eq!(chunks.len(), 4);
        assert!(chunks.iter().all(|c| c.chars().count() <= CHUNK_CHARS));
        assert_eq!(chunks.concat(), value);
        assert!(split_chunks("").is_empty());
    }

    /// Regressão: a sessão do Supabase passa de 2560 bytes e uma única entrada do
    /// Windows a recusaria. Também garante que valor menor não deixa pedaços velhos.
    #[test]
    #[cfg(target_os = "windows")]
    fn roundtrip_across_chunks_and_shrinking() {
        let service = "pherielium-test-secure-storage";
        let key = "sb-teste-auth-token";
        store_remove(service, key);
        assert_eq!(store_get(service, key).unwrap(), None);

        let big = "x".repeat(5000);
        store_set(service, key, &big).expect("gravar grande");
        assert_eq!(store_get(service, key).unwrap().as_deref(), Some(big.as_str()));

        store_set(service, key, "pequeno").expect("regravar menor");
        assert_eq!(store_get(service, key).unwrap().as_deref(), Some("pequeno"));
        // pedaços antigos foram apagados
        assert!(entry(service, &chunk_name(key, 1)).unwrap().get_password().is_err());

        store_remove(service, key);
        assert_eq!(store_get(service, key).unwrap(), None);
    }
}
