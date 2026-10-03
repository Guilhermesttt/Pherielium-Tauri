import type { Game } from "../types/domain";
import type { LauncherLanguage } from "../context/PreferencesContext";
import {
  achievementUnlockBelongsToGame,
  loadGameAchievements,
  patchGameAchievementUnlock,
  type AchievementUnlockPayload,
} from "./gameAchievements";
import { invalidateSteamAchievementCache, type SteamAchievement } from "./steam";

export type OverlayAchievementItem = SteamAchievement;

export interface OverlayAchievementsSnapshot {
  loading: boolean;
  items: OverlayAchievementItem[];
  unlocked: number;
  available: number;
}

function toOverlaySnapshot(
  items: SteamAchievement[],
  game: Game,
  loading = false,
): OverlayAchievementsSnapshot {
  const unlockedFromItems = items.filter((achievement) => achievement.achieved).length;
  const availableFromItems = items.length;
  return {
    loading,
    items,
    unlocked: availableFromItems > 0 ? unlockedFromItems : (game.completedAchievements || 0),
    available: availableFromItems || game.totalAchievements || 0,
  };
}

/** Uses the same loader as GameDetailPanel (`loadGameAchievements`). */
export async function loadOverlayAchievementsForGame(
  game: Game,
  options: {
    steamId?: string | null;
    language?: LauncherLanguage;
    bypassSteamCache?: boolean;
  } = {},
): Promise<OverlayAchievementsSnapshot> {
  let latestItems: SteamAchievement[] = [];

  const result = await loadGameAchievements(
    game,
    {
      language: options.language || "pt-BR",
      steamId: options.steamId,
      bypassSteamCache: options.bypassSteamCache,
    },
    {
      onCached: (phase) => {
        latestItems = phase.items;
      },
      onLocal: (phase) => {
        latestItems = phase.items;
      },
    },
  );

  const items = result.items.length > 0 ? result.items : latestItems;
  const snapshot = toOverlaySnapshot(items, game, false);
  if (result.libraryPatch) {
    return {
      ...snapshot,
      unlocked: snapshot.unlocked || result.libraryPatch.completedAchievements,
      available: snapshot.available || result.libraryPatch.totalAchievements,
    };
  }
  return snapshot;
}

export function patchOverlayAchievementUnlock(
  current: OverlayAchievementsSnapshot,
  payload: Pick<AchievementUnlockPayload, "achievementId" | "earnedTime" | "unlockedAt">,
): OverlayAchievementsSnapshot {
  const { items, changed } = patchGameAchievementUnlock(current.items, payload);
  if (!changed) return current;
  return {
    loading: false,
    items,
    unlocked: items.filter((achievement) => achievement.achieved).length,
    available: current.available || items.length,
  };
}

export { achievementUnlockBelongsToGame, invalidateSteamAchievementCache };
