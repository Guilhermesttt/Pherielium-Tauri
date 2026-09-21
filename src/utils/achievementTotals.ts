import type { Game } from "../types/domain";

export interface AchievementTotals {
  unlocked: number;
  available: number;
  gamesWithAchievements: number;
}

const safeCount = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
};

export const calculateAchievementTotals = (games: Game[]): AchievementTotals =>
  games.reduce<AchievementTotals>((totals, game) => {
    const unlocked = safeCount(game.completedAchievements);
    const available = Math.max(safeCount(game.totalAchievements), unlocked);
    return {
      unlocked: totals.unlocked + unlocked,
      available: totals.available + available,
      gamesWithAchievements: totals.gamesWithAchievements + (available > 0 ? 1 : 0),
    };
  }, { unlocked: 0, available: 0, gamesWithAchievements: 0 });
