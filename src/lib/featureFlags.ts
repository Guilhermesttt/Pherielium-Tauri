/**
 * Flags locais (localStorage) para reverter uma fatia isoladamente sem lançar versão.
 *
 * Todas usam o prefixo `pherielium_`. Quem lê precisa sobreviver a armazenamento bloqueado: nesse caso vale o padrão.
 * Não é um sistema de configuração remota; flags remotas ficam para o `app_config` do protocolo v2 (ver docs/backend-audit/PLAN.md).
 */

export const FLAG_PREFIX = "pherielium_";

export interface FlagStorage {
  getItem(key: string): string | null;
}

function defaultStorage(): FlagStorage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch (error) {
    // Acessar localStorage pode lançar em WebViews com dados de site bloqueados.
    console.warn("[featureFlags] localStorage indisponível; usando os padrões:", error);
    return null;
  }
}

/** Lê o valor bruto da flag `pherielium_<name>`; `null` se ausente ou ilegível. */
export function readFlag(name: string, storage: FlagStorage | null = defaultStorage()): string | null {
  if (!storage) return null;
  try {
    return storage.getItem(`${FLAG_PREFIX}${name}`);
  } catch (error) {
    console.warn(`[featureFlags] não foi possível ler ${name}:`, error);
    return null;
  }
}

/**
 * Flag booleana. "1"/"true"/"on" ligam, "0"/"false"/"off" desligam; qualquer outro valor (ou ausência) usa `defaultOn`.
 */
export function isFlagOn(name: string, defaultOn: boolean, storage?: FlagStorage | null): boolean {
  const raw = readFlag(name, storage);
  if (raw === null) return defaultOn;
  const value = raw.trim().toLowerCase();
  if (value === "1" || value === "true" || value === "on") return true;
  if (value === "0" || value === "false" || value === "off") return false;
  return defaultOn;
}

/** Flag de modo (ex.: "off" | "log" | "enforce"). Valor fora da lista cai no padrão. */
export function readModeFlag<T extends string>(
  name: string,
  allowed: readonly T[],
  fallback: T,
  storage?: FlagStorage | null,
): T {
  const raw = readFlag(name, storage);
  if (raw === null) return fallback;
  const value = raw.trim().toLowerCase();
  return (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}
