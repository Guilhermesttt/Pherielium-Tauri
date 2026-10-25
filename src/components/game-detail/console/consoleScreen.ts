import type { SteamAchievement } from "../../../services/steam";
import type { AchievementFilter } from "../../../types/gameDetail";

/** Uma linha da lista "Conquistas recentes": já desbloqueada ou a próxima a buscar. */
export interface RecentAchievement {
  achievement: SteamAchievement;
  state: "unlocked" | "next";
}

/**
 * As conquistas que valem mostrar na tela do jogo: as desbloqueadas mais recentes primeiro
 * e, se sobrar espaço, as bloqueadas mais fáceis (maior % de jogadores que têm), que são
 * as próximas que a pessoa provavelmente pega. Ocultas e bloqueadas não entram (seriam spoiler).
 */
export function pickRecentAchievements(list: readonly SteamAchievement[], max = 6): RecentAchievement[] {
  const unlocked = list
    .filter((a) => a.achieved)
    .sort((a, b) => (b.unlockTime || 0) - (a.unlockTime || 0))
    .map((achievement) => ({ achievement, state: "unlocked" as const }));
  const next = list
    .filter((a) => !a.achieved && !a.hidden)
    .sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0))
    .map((achievement) => ({ achievement, state: "next" as const }));
  return [...unlocked, ...next].slice(0, Math.max(0, max));
}

/** Tempo jogado em horas e minutos, para mostrar "23h 19m" com as unidades pequenas. */
export function splitPlaytime(hours: number | undefined): { hours: number; minutes: number } {
  const totalMinutes = Math.max(0, Math.round((hours || 0) * 60));
  return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 };
}

/** Progresso de troféus em % inteiro (0 sem conquistas). */
export function trophyPercent(unlocked: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((unlocked / total) * 100)));
}

/**
 * "4,2% dos jogadores têm": uma casa decimal abaixo de 10%, inteiro acima. Sem dado (ou 0, que é
 * como a Steam devolve quando não há estatística global) não mostra nada.
 */
export function formatRarity(percent: number | undefined, suffix: string, locale = "pt-BR"): string | null {
  if (typeof percent !== "number" || !Number.isFinite(percent) || percent <= 0) return null;
  const digits = percent < 10 ? 1 : 0;
  const value = new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(percent);
  return `${value}% ${suffix}`;
}

/** "4,2%": só a porcentagem (uma casa abaixo de 10%), para a coluna de raridade. Sem dado, null. */
export function formatPercent(percent: number | undefined, locale = "pt-BR"): string | null {
  const text = formatRarity(percent, "", locale);
  return text ? text.trim() : null;
}

/** Data curta do desbloqueio ("12 out 2026"). unlockTime vem em segundos (Steam). */
export function formatUnlockDate(unlockTime: number, locale: string): string | null {
  if (!unlockTime || unlockTime <= 0) return null;
  try {
    return new Date(unlockTime * 1000).toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return null;
  }
}

export type RarityKey = "ultra" | "veryRare" | "rare" | "common";

/** Rótulo de raridade pela % global de jogadores que têm o troféu. Sem dado, nenhum. */
export function rarityLabel(percent: number | undefined): RarityKey | null {
  if (typeof percent !== "number" || !Number.isFinite(percent) || percent <= 0) return null;
  if (percent < 1) return "ultra";
  if (percent < 5) return "veryRare";
  if (percent < 15) return "rare";
  return "common";
}

/**
 * A lista da aba de troféus: aplica o filtro e a busca (nome e descrição; a descrição de um troféu
 * oculto e bloqueado não entra, para a busca não vazar spoiler) e ordena: desbloqueados do mais
 * recente para o mais antigo, depois os bloqueados dos mais fáceis para os mais raros.
 */
export function filterTrophies(
  list: readonly SteamAchievement[],
  filter: AchievementFilter,
  query: string,
): SteamAchievement[] {
  const needle = query.trim().toLowerCase();
  return list
    .filter((a) => (filter === "unlocked" ? a.achieved : filter === "locked" ? !a.achieved : true))
    .filter((a) => {
      if (!needle) return true;
      const secret = a.hidden && !a.achieved;
      return a.name.toLowerCase().includes(needle) || (!secret && a.description.toLowerCase().includes(needle));
    })
    .sort((a, b) => {
      if (a.achieved !== b.achieved) return a.achieved ? -1 : 1;
      if (a.achieved) return (b.unlockTime || 0) - (a.unlockTime || 0);
      return (b.percent ?? 0) - (a.percent ?? 0);
    });
}
