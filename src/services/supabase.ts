import { createClient } from "@supabase/supabase-js";

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

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,

    // Electron usa OAuth externo/deep links; a janela nao deve interpretar
    // automaticamente parametros de auth na URL atual.
    detectSessionInUrl: false,

    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  },
});
