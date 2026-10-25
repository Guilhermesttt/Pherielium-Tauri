import type { SteamAchievement } from "../../../services/steam";

/** O último troféu desbloqueado de um jogo (para o bloco de informações da Home). */
export interface LastTrophy {
  name: string;
  /** Instante do desbloqueio, em milissegundos. */
  unlockedAtMs: number;
}

/**
 * O troféu desbloqueado mais recentemente. Só conta quem tem data de desbloqueio: um troféu
 * marcado como obtido sem data (retroativo) não dá para dizer "há quanto tempo", então fica de fora.
 * `unlockTime` vem em segundos (Steam).
 */
export function pickLastUnlocked(items: readonly SteamAchievement[]): LastTrophy | null {
  let best: SteamAchievement | null = null;
  for (const item of items) {
    if (!item.achieved || !(item.unlockTime > 0)) continue;
    if (!best || item.unlockTime > best.unlockTime) best = item;
  }
  return best ? { name: best.name, unlockedAtMs: best.unlockTime * 1000 } : null;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * "agora", "há 5 min", "há 3 h", "ontem", "há 12 d", "há 4 meses", "há 2 anos".
 * Instante no futuro (relógio adiantado) conta como "agora".
 */
export function formatAgo(timestampMs: number, now: number): string {
  const elapsed = Math.max(0, now - timestampMs);
  if (elapsed < MINUTE) return "agora";
  if (elapsed < HOUR) return `há ${Math.floor(elapsed / MINUTE)} min`;
  if (elapsed < DAY) return `há ${Math.floor(elapsed / HOUR)} h`;
  const days = Math.floor(elapsed / DAY);
  if (days === 1) return "ontem";
  if (days < 60) return `há ${days} d`;
  const months = Math.floor(days / 30);
  return months < 24 ? `há ${months} meses` : `há ${Math.floor(days / 365)} anos`;
}

/** Duração de uma sessão: "12 min", "1h12", "3h05". Menos de um minuto vira "agora". */
export function formatSession(elapsedMs: number): string {
  const minutes = Math.floor(Math.max(0, elapsedMs) / MINUTE);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  return `${h}h${String(minutes % 60).padStart(2, "0")}`;
}

/**
 * Quando a sessão atual começou: o instante em que a Home viu o jogo rodando; sem isso, o
 * `lastPlayedAt` do jogo, desde que seja um instante válido, passado e de até 24h atrás (depois
 * disso o jogo "rodando" não é uma sessão que dê para medir). Sem nenhum dos dois, null.
 */
export function resolveSessionStart(
  observedAtMs: number | undefined,
  lastPlayedAt: string | undefined,
  now: number,
): number | null {
  if (observedAtMs !== undefined) return observedAtMs;
  if (!lastPlayedAt) return null;
  const parsed = Date.parse(lastPlayedAt);
  if (Number.isNaN(parsed) || parsed > now || now - parsed > DAY) return null;
  return parsed;
}
