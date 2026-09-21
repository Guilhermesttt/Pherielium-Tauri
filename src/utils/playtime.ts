import type { Game } from "../types/domain";

const safeNonNegativeNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

export const getGamePlayedMinutes = (game: Game) => Math.max(
  Math.round(safeNonNegativeNumber(game.steamPlaytimeMinutes)),
  Math.round(safeNonNegativeNumber(game.locallyTrackedMinutes)),
  Math.round(safeNonNegativeNumber((game as any).minutesPlayed)),
  Math.round(safeNonNegativeNumber(game.hoursPlayed) * 60),
);

export const getGamePlayedHours = (game: Game) =>
  getGamePlayedMinutes(game) / 60;

export const calculateTotalPlayedMinutes = (games: Game[]) =>
  games.reduce((total, game) => total + getGamePlayedMinutes(game), 0);

export const formatPlayedHours = (
  hours: number,
  locale = "pt-BR",
) => new Intl.NumberFormat(locale, {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
}).format(Math.round(safeNonNegativeNumber(hours) * 10) / 10);
