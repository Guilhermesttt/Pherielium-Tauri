// src/lib/trophyInstrumentation.ts
// Phase 5 — Thin wrappers around the hot trophy operations so the
// `trophyMetrics` registry can record p50/p95/p99 latency on each call.
//
// Design choice: instead of modifying `trophyTiers.ts` (which is
// extensively covered by `tests/trophy-tiers.test.ts`), we re-export the
// same functions with a `measureSync` wrapper. Callers that want metrics
// (e.g. the renderer when computing the level banner) import the wrapped
// versions; pure consumers keep importing the originals.

import {
  calculateGameTrophyCounts,
  calculatePlayerLevel,
  getTrophyXp,
  aggregateTrophyCounts,
  calculatePlayerLevelFromGames,
  type RawAchievement,
  type TrophyTier,
  type GameTrophyCounts,
  type PlayerLevelInfo,
} from "../utils/trophyTiers";
import { getDefaultTrophyMetrics } from "./trophyMetrics";

const OP = {
  calculatePlayerLevel: "trophy.calculatePlayerLevel",
  calculatePlayerLevelFromGames: "trophy.calculatePlayerLevelFromGames",
  calculateGameTrophyCounts: "trophy.calculateGameTrophyCounts",
  aggregateTrophyCounts: "trophy.aggregateTrophyCounts",
  getTrophyXp: "trophy.getTrophyXp",
} as const;

/**
 * Compute the PSN-style player level from a single lifetime XP value.
 * Backed by the metrics registry so the latency distribution shows up in
 * `/_internal/metrics`.
 */
export function measureCalculatePlayerLevel(
  totalHours: number,
  totalAchievements: number,
  totalGames: number,
  trophyCounts: GameTrophyCounts,
): PlayerLevelInfo {
  return getDefaultTrophyMetrics().measureSync(
    OP.calculatePlayerLevel,
    () => calculatePlayerLevel(totalHours, totalAchievements, totalGames, trophyCounts),
  );
}

export function measureCalculatePlayerLevelFromGames(
  games: Parameters<typeof calculatePlayerLevelFromGames>[0],
): PlayerLevelInfo {
  return getDefaultTrophyMetrics().measureSync(
    OP.calculatePlayerLevelFromGames,
    () => calculatePlayerLevelFromGames(games),
  );
}

export function measureCalculateGameTrophyCounts(
  achievementsOrTotal: any,
  completed?: number,
  percents?: any,
) {
  return getDefaultTrophyMetrics().measureSync(
    OP.calculateGameTrophyCounts,
    () => {
      if (Array.isArray(achievementsOrTotal)) {
        const total = achievementsOrTotal.length;
        const unlocked = achievementsOrTotal.filter((a) => a.achieved || a.unlocked).length;
        return calculateGameTrophyCounts(total, unlocked, achievementsOrTotal);
      }
      return calculateGameTrophyCounts(Number(achievementsOrTotal) || 0, Number(completed) || 0, percents);
    },
  );
}

export function measureAggregateTrophyCounts(
  perGameCounts: Parameters<typeof aggregateTrophyCounts>[0],
) {
  return getDefaultTrophyMetrics().measureSync(
    OP.aggregateTrophyCounts,
    () => aggregateTrophyCounts(perGameCounts),
  );
}

export function measureGetTrophyXp(tier: TrophyTier, percent?: number): number {
  return getDefaultTrophyMetrics().measureSync(
    OP.getTrophyXp,
    () => getTrophyXp(tier, percent),
  );
}
