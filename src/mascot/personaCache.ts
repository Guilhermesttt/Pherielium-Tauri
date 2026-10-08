import type { Persona } from "./genrePersona";

/** Cache da persona por música: a mesma faixa não é enviada à AudD de novo. */
const STORAGE_KEY = "pherielium_music_persona_cache_v1";
export const PERSONA_CACHE_MAX = 200;

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

export const trackKey = (title: string, artist: string) => `${norm(title)}|${norm(artist)}`;

type Store = Record<string, Persona>;

function read(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? (parsed as Store) : {};
  } catch {
    return {};
  }
}

export function getCachedPersona(key: string): Persona | null {
  const v = read()[key];
  return v === "metal" || v === "pop" || v === "chill" || v === "padrao" ? v : null;
}

export function setCachedPersona(key: string, persona: Persona): void {
  try {
    const store = read();
    delete store[key]; // reinsere no fim: mais recente por último
    store[key] = persona;
    const keys = Object.keys(store);
    for (const old of keys.slice(0, Math.max(0, keys.length - PERSONA_CACHE_MAX))) delete store[old];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* sem storage: só não guarda */
  }
}
