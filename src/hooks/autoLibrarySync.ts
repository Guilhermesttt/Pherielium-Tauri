/**
 * Regras (puras) da sincronização automática da biblioteca: quando vale a pena sincronizar Steam/Epic
 * sem o usuário apertar o botão. Sem React, para testar.
 */

export type SyncPlatform = "steam" | "epic";

/** Entre duas sincronizações automáticas da mesma plataforma. */
export const AUTO_SYNC_MIN_INTERVAL_MS = 30 * 60_000;
/** Ao voltar para o app (foco), um intervalo menor basta. */
export const FOCUS_SYNC_MIN_INTERVAL_MS = 10 * 60_000;
/** Depois de fechar um jogo, espera a Steam/Epic registrarem as horas antes de sincronizar. */
export const AFTER_GAME_SYNC_DELAY_MS = 45_000;

export const lastSyncKey = (uid: string, platform: SyncPlatform) => `pherielium_last_sync:${platform}:${uid}`;

type Store = Pick<Storage, "getItem" | "setItem">;

export function readLastSync(uid: string, platform: SyncPlatform, store: Store): number {
  try {
    const n = Number(store.getItem(lastSyncKey(uid, platform)));
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function writeLastSync(uid: string, platform: SyncPlatform, at: number, store: Store): void {
  try {
    store.setItem(lastSyncKey(uid, platform), String(at));
  } catch {
    /* sem storage: só sincroniza com mais frequência */
  }
}

export function isSyncDue(lastAt: number, now: number, minIntervalMs: number): boolean {
  return now - lastAt >= minIntervalMs;
}

/** Plataforma de um jogo (para sincronizar só a dele depois que fecha). */
export function platformOfGame(game: { launcherType?: string | null; steamAppId?: string | null; epicCatalogId?: string | null; epicLaunchId?: string | null }): SyncPlatform | null {
  const type = (game.launcherType || "").toLowerCase();
  if (type === "steam" || game.steamAppId) return "steam";
  if (type === "epic" || game.epicCatalogId || game.epicLaunchId) return "epic";
  return null;
}
