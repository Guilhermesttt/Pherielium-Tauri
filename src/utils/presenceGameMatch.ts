import type { Game } from "../types/domain";
import { getMonitorableExecutablePath } from "../services/launcher";
import { monitorPathsRelated } from "./processIdentity";

/** Resolve library game from confirmed process path or exact title — no fuzzy substring match. */
export function resolveGameFromPresence(
  games: Game[],
  title: string | null | undefined,
  executablePath: string | null | undefined,
): Game | null {
  const normalizedPath = String(executablePath || "").trim();
  if (normalizedPath) {
    const byPath = games.find((game) =>
      monitorPathsRelated(
        normalizedPath,
        getMonitorableExecutablePath(game) || game.executablePath,
      ),
    );
    if (byPath) return byPath;
  }

  const normalizedTitle = String(title || "").trim().toLowerCase();
  if (!normalizedTitle) return null;

  return games.find((game) => game.title.trim().toLowerCase() === normalizedTitle) || null;
}
