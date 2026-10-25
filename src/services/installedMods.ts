import type { GamePanelMod } from "../types/gameDetail";

/**
 * Lista de mods por jogo que a página de Mods grava no localStorage (um registro `{ [gameId]: mods[] }`
 * por conta). A tela do jogo lê a mesma chave para mostrar o que está instalado.
 */
export const installedModsStorageKey = (uid: string): string => `checkpoint_installed_mods_${uid}`;

const isStatus = (value: unknown): value is GamePanelMod["status"] =>
  value === "downloaded" || value === "installed";

/** Mods registrados para `gameId`; entradas malformadas são ignoradas, nunca lançam. */
export function readInstalledModsForGame(uid: string, gameId: string): GamePanelMod[] {
  let record: unknown;
  try {
    record = JSON.parse(localStorage.getItem(installedModsStorageKey(uid)) || "{}");
  } catch {
    return [];
  }
  if (!record || typeof record !== "object" || Array.isArray(record)) return [];
  const entries = (record as Record<string, unknown>)[gameId];
  if (!Array.isArray(entries)) return [];

  return entries.flatMap((entry): GamePanelMod[] => {
    if (!entry || typeof entry !== "object") return [];
    const { id, name, pictureUrl, enabled, status, manifestPath } = entry as Record<string, unknown>;
    if (typeof id !== "string" || typeof name !== "string") return [];
    return [
      {
        id,
        name,
        pictureUrl: typeof pictureUrl === "string" && pictureUrl ? pictureUrl : undefined,
        enabled: enabled === true,
        status: isStatus(status) ? status : undefined,
        manifestPath: typeof manifestPath === "string" ? manifestPath : undefined,
      },
    ];
  });
}
