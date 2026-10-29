/** Dados da aba "Jogo" da notch, montados a partir do estado do painel do overlay. */
export interface NotchGameTabData {
  title: string;
  art: string | null;
  unlocked: number;
  total: number;
  /** 0..100 */
  percent: number;
  /** últimas conquistas desbloqueadas (mais recente primeiro) */
  recent: { name: string; icon: string | null }[];
  friendsPlaying: { id: string; name: string; avatar: string | null; game: string | null }[];
}

const MAX_RECENT = 4;
const MAX_FRIENDS = 4;

const text = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Instante do desbloqueio em ms, ou 0 quando o item não traz data. */
function unlockStamp(item: Record<string, unknown>): number {
  for (const key of ["unlockedAt", "unlockTime", "unlock_time", "achievedAt"]) {
    const raw = item[key];
    if (typeof raw === "number" && Number.isFinite(raw)) return raw < 1e12 ? raw * 1000 : raw;
    if (typeof raw === "string") {
      const parsed = Date.parse(raw);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return 0;
}

/**
 * Junta o jogo em andamento, o progresso de conquistas e os amigos que estão jogando. Entradas
 * `any` do painel são tratadas como dados soltos: campo ausente ou do tipo errado só some do resultado.
 */
export function buildNotchGameTab(input: {
  title: string | null;
  art?: unknown;
  achievements: unknown[];
  unlocked: number;
  total: number;
  friends: unknown[];
}): NotchGameTabData | null {
  if (!input.title) return null;

  const achieved = input.achievements
    .filter((a): a is Record<string, unknown> => Boolean(a) && typeof a === "object" && Boolean((a as Record<string, unknown>).achieved))
    .map((a, index) => ({ a, index, stamp: unlockStamp(a) }));
  // com data: a mais recente primeiro; sem data: a ordem da lista (as últimas da lista como mais novas)
  achieved.sort((x, y) => (y.stamp - x.stamp) || (y.index - x.index));
  const recent = achieved.slice(0, MAX_RECENT).map(({ a }) => ({
    name: text(a.name) ?? text(a.displayName) ?? "Conquista",
    icon: text(a.icon),
  }));

  const friendsPlaying = input.friends
    .filter((f): f is Record<string, unknown> => Boolean(f) && typeof f === "object")
    .filter((f) => String(f.status ?? "").toLowerCase() === "playing" || Boolean(f.playing))
    .slice(0, MAX_FRIENDS)
    .map((f, i) => ({
      id: text(f.id) ?? `friend-${i}`,
      name: text(f.name) ?? "Amigo",
      avatar: text(f.avatar),
      game: text(f.playing),
    }));

  const total = Math.max(0, Math.floor(input.total));
  const unlocked = Math.min(Math.max(0, Math.floor(input.unlocked)), total || Number.MAX_SAFE_INTEGER);
  return {
    title: input.title,
    art: text(input.art),
    unlocked,
    total,
    percent: total > 0 ? Math.round((unlocked / total) * 100) : 0,
    recent,
    friendsPlaying,
  };
}
