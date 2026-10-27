import { createClient } from "@supabase/supabase-js";
import { invoke } from "@tauri-apps/api/core";
import { createSecureSessionStorage } from "./secureSessionStorage";

const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || "").trim();
const publishableKey = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "").trim();
const legacyAnonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();

/**
 * Preferimos a nova publishable key (sb_publishable_...).
 * O anon JWT legado continua aceito durante a migracao, mas nao tem prioridade.
 */
const supabaseKey = publishableKey || legacyAnonKey;

const isValidSupabaseUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || (import.meta.env.DEV && url.protocol === "http:");
  } catch {
    return false;
  }
};

if (!isValidSupabaseUrl(supabaseUrl)) {
  throw new Error("[Supabase] VITE_SUPABASE_URL ausente ou invalida.");
}

if (!supabaseKey) {
  throw new Error(
    "[Supabase] Configure VITE_SUPABASE_PUBLISHABLE_KEY ou VITE_SUPABASE_ANON_KEY.",
  );
}

const isTauriRuntime = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/**
 * No desktop a sessão (JWT + refresh token) fica no cofre do Windows, não no localStorage.
 * No navegador (dev) não existe cofre, então vale o localStorage.
 */
const authStorage = isTauriRuntime
  ? createSecureSessionStorage(
      {
        get: (key) => invoke<string | null>("secure_storage_get", { key }),
        set: (key, value) => invoke<void>("secure_storage_set", { key, value }),
        remove: (key) => invoke<void>("secure_storage_remove", { key }),
      },
      window.localStorage,
      (message, error) => console.warn(message, error),
    )
  : typeof window !== "undefined"
    ? window.localStorage
    : undefined;

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,

    // Electron usa OAuth externo/deep links; a janela nao deve interpretar
    // automaticamente parametros de auth na URL atual.
    detectSessionInUrl: false,

    storage: authStorage,
  },
});
