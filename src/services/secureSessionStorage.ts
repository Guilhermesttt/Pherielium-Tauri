/**
 * Armazenamento da sessão do Supabase no cofre do Windows (ver `secure_storage.rs`).
 * `localStorage` é legível por qualquer script da página; o cofre não é.
 *
 * - Fora do Tauri (dev no navegador) usa `localStorage`, que é tudo o que existe ali.
 * - Dentro do Tauri, a primeira leitura migra a sessão que já estava no `localStorage`
 *   para o cofre e apaga a cópia antiga, então ninguém precisa entrar de novo.
 * - Se o cofre falhar, cai no `localStorage` com um aviso: perder o login a cada abertura
 *   seria pior do que manter o comportamento anterior.
 */
export interface SecureSessionBackend {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

/** Subconjunto assíncrono de `Storage` aceito pelo `supabase-js`. */
export interface AsyncAuthStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

type LegacyStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function createSecureSessionStorage(
  backend: SecureSessionBackend,
  legacy: LegacyStorage,
  warn: (message: string, error: unknown) => void = () => {},
): AsyncAuthStorage {
  return {
    async getItem(key) {
      try {
        const stored = await backend.get(key);
        if (stored !== null) return stored;

        const old = legacy.getItem(key);
        if (old === null) return null;
        // migração: grava no cofre e só então apaga a cópia em texto
        await backend.set(key, old);
        legacy.removeItem(key);
        return old;
      } catch (error) {
        warn("[Sessão] Cofre indisponível, lendo do localStorage.", error);
        return legacy.getItem(key);
      }
    },

    async setItem(key, value) {
      try {
        await backend.set(key, value);
        legacy.removeItem(key);
      } catch (error) {
        warn("[Sessão] Cofre indisponível, gravando no localStorage.", error);
        legacy.setItem(key, value);
      }
    },

    async removeItem(key) {
      legacy.removeItem(key);
      try {
        await backend.remove(key);
      } catch (error) {
        warn("[Sessão] Não foi possível limpar o cofre.", error);
      }
    },
  };
}
