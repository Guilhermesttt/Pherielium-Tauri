import type { UserProfile } from "../types/domain";
import { calculatePlayerLevelFromXp, getPSNTierInfo, type PlayerLevelInfo } from "./trophyTiers";

type ProfileWithLevel = UserProfile & {
  levelProgress?: { total_xp?: number; current_level?: number; progress_pct?: number };
};

/**
 * Nível de um amigo a partir do perfil público (mesma regra do perfil do usuário):
 * XP total quando existe; senão o nível bruto. `null` quando o perfil não informa nível.
 */
export function friendLevelFromProfile(profile: UserProfile | null | undefined): PlayerLevelInfo | null {
  const p = profile as ProfileWithLevel | null | undefined;
  if (!p) return null;
  const xp = Number(p.levelProgress?.total_xp ?? 0);
  if (xp > 0) return calculatePlayerLevelFromXp(xp);
  const raw = Number(p.levelProgress?.current_level ?? p.level ?? 0);
  if (!Number.isFinite(raw) || raw < 1) return null;
  const tier = getPSNTierInfo(raw);
  return {
    level: raw,
    xp: 0,
    progress: Number(p.levelProgress?.progress_pct ?? 0),
    currentLevelXp: 0,
    xpForNextLevel: 0,
    tier: tier.tier,
    subTier: tier.subTier,
    tierName: tier.name,
    rank: tier.name,
    rankColor: tier.color,
    tierInfo: tier,
  };
}
