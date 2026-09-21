import { apiUrl } from "./api";
import type { RetroGame } from "../types/domain";

export interface TheGamesDbGameMatch {
  id: number;
  title: string;
  releaseDate?: string;
  year?: number;
  description: string;
  publisher: string;
  developer: string;
  platform: string;
  frontImage?: string;
  backImage?: string;
  images: string[];
}

const CONSOLE_PLATFORM_ALIASES: Record<string, string[]> = {
  PS2: ["playstation 2", "sony playstation 2", "ps2"],
  PS1: ["playstation", "sony playstation", "ps1", "psx"],
  SNES: ["super nintendo", "snes", "super famicom"],
  NES: ["nintendo entertainment system", "nes", "nintendinho", "famicom"],
  N64: ["nintendo 64", "n64"],
  GBA: ["game boy advance", "gba"],
  GENESIS: ["genesis", "mega drive", "sega genesis"],
  PSP: ["playstation portable", "psp"],
  SWITCH: ["switch", "nintendo switch"],
};

const screenshotCache = new Map<number, Promise<string[]>>();
const resolvedGameIdCache = new Map<string, number>();

function isMissingIpcHandlerError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("No handler registered");
}

async function searchTheGamesDbViaHttp(name: string): Promise<TheGamesDbGameMatch[]> {
  const response = await fetch(apiUrl(`/api/thegamesdb/search?name=${encodeURIComponent(name)}`));
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(String(payload.error || `TheGamesDB respondeu com erro ${response.status}.`));
  }
  const payload = await response.json();
  return Array.isArray(payload.matches) ? payload.matches : [];
}

async function getTheGamesDbScreenshotsViaHttp(gameId: number): Promise<string[]> {
  const response = await fetch(apiUrl(`/api/thegamesdb/games/${gameId}/screenshots`));
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(String(payload.error || `TheGamesDB respondeu com erro ${response.status}.`));
  }
  const payload = await response.json();
  return Array.isArray(payload.screenshots) ? payload.screenshots : [];
}

export async function searchTheGamesDbGames(name: string): Promise<TheGamesDbGameMatch[]> {
  if (window.electronAPI?.searchTheGamesDb) {
    try {
      return await window.electronAPI.searchTheGamesDb({ name });
    } catch (error) {
      if (!isMissingIpcHandlerError(error)) throw error;
    }
  }
  return searchTheGamesDbViaHttp(name);
}

export async function getTheGamesDbScreenshots(gameId: number): Promise<string[]> {
  const cached = screenshotCache.get(gameId);
  if (cached) return cached;

  const request = (async () => {
    if (window.electronAPI?.getTheGamesDbScreenshots) {
      try {
        const result = await window.electronAPI.getTheGamesDbScreenshots({ gameId });
        return result.screenshots;
      } catch (error) {
        if (!isMissingIpcHandlerError(error)) throw error;
      }
    }
    return getTheGamesDbScreenshotsViaHttp(gameId);
  })();

  screenshotCache.set(gameId, request);
  return request;
}

export function pickBestTheGamesDbMatch(
  matches: TheGamesDbGameMatch[],
  game: Pick<RetroGame, "title" | "console">,
): TheGamesDbGameMatch | undefined {
  if (matches.length === 0) return undefined;

  const normalizedTitle = game.title.trim().toLocaleLowerCase("pt-BR");
  const platformHints = CONSOLE_PLATFORM_ALIASES[game.console] ?? [game.console.toLocaleLowerCase("pt-BR")];

  const scored = matches.map((match) => {
    let score = 0;
    const matchTitle = match.title.trim().toLocaleLowerCase("pt-BR");
    if (matchTitle === normalizedTitle) score += 100;
    else if (matchTitle.includes(normalizedTitle) || normalizedTitle.includes(matchTitle)) score += 50;

    const platform = match.platform.toLocaleLowerCase("pt-BR");
    if (platformHints.some((hint) => platform.includes(hint))) score += 30;
    return { match, score };
  });

  scored.sort((left, right) => right.score - left.score);
  return scored[0]?.match;
}

export async function resolveTheGamesDbGameId(game: RetroGame): Promise<number | undefined> {
  if (game.theGamesDbId && game.theGamesDbId > 0) return game.theGamesDbId;

  const cacheKey = `${game.console}:${game.title.trim().toLocaleLowerCase("pt-BR")}`;
  const cachedId = resolvedGameIdCache.get(cacheKey);
  if (cachedId) return cachedId;

  try {
    const matches = await searchTheGamesDbGames(game.title);
    const bestMatch = pickBestTheGamesDbMatch(matches, game);
    if (bestMatch?.id) {
      resolvedGameIdCache.set(cacheKey, bestMatch.id);
      return bestMatch.id;
    }
  } catch {
    // Offline or missing API key — TV falls back to platform wallpaper.
  }

  return undefined;
}

export async function resolveTheGamesDbTvScreenshot(game: RetroGame): Promise<string | undefined> {
  const gameId = await resolveTheGamesDbGameId(game);
  if (!gameId) return undefined;

  try {
    const screenshots = await getTheGamesDbScreenshots(gameId);
    const screenshot = screenshots[0];
    if (!screenshot) return undefined;

    if (/^https?:\/\//i.test(screenshot) && window.electronAPI?.importRetroArtwork) {
      try {
        return await window.electronAPI.importRetroArtwork(screenshot);
      } catch {
        return screenshot;
      }
    }

    return screenshot;
  } catch {
    return undefined;
  }
}
