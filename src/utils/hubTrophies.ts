/**
 * Hub trophies — rastreia conquistas ganhas VIA HUB (anti-farm).
 * Só conta pro nível o que foi desbloqueado com jogo iniciado pelo hub.
 * Armazena em localStorage por usuário/jogo (leve, imediato).
 * Futuro: sincronizar com Supabase `user_trophies.hub` para validação server-side.
 */

const keyFor = (uid: string, gameId: string) => `hub_trophies:${uid}:${gameId}`;

export function getHubAchievementSet(uid: string, gameId: string): Set<string> {
  try {
    const raw = localStorage.getItem(keyFor(uid, gameId));
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(arr.map(s => String(s).toLowerCase()));
  } catch {
    return new Set();
  }
}

export function markHubAchievement(uid: string, gameId: string, apiName: string): void {
  try {
    const set = getHubAchievementSet(uid, gameId);
    const lower = String(apiName).toLowerCase();
    if (set.has(lower)) return;
    set.add(lower);
    localStorage.setItem(keyFor(uid, gameId), JSON.stringify([...set]));
  } catch (err) {
    console.warn("[hubTrophies] Falha ao marcar conquista local:", err);
  }
}

export function isHubAchievement(uid: string, gameId: string, apiName: string): boolean {
  return getHubAchievementSet(uid, gameId).has(String(apiName).toLowerCase());
}

export function clearHubAchievements(uid: string, gameId: string): void {
  try { localStorage.removeItem(keyFor(uid, gameId)); } catch (err) { console.warn("[hubTrophies] Erro ao limpar conquistas:", err); }
  try { localStorage.removeItem(countsKeyFor(uid, gameId)); } catch (err) { console.warn("[hubTrophies] Erro ao limpar contadores:", err); }
}

const countsKeyFor = (uid: string, gameId: string) => `hub_counts:${uid}:${gameId}`;

export function getHubCounts(uid: string, gameId: string): { platinum: number; gold: number; silver: number; bronze: number } {
  try {
    const raw = localStorage.getItem(countsKeyFor(uid, gameId));
    if (raw) {
      const obj = JSON.parse(raw) as any;
      const c = {
        platinum: Number(obj.platinum ?? 0),
        gold: Number(obj.gold ?? 0),
        silver: Number(obj.silver ?? 0),
        bronze: Number(obj.bronze ?? 0),
      };
      // fallback para migração: se counts zerado mas set tem itens, trata como bronze
      if (c.platinum + c.gold + c.silver + c.bronze === 0) {
        const set = getHubAchievementSet(uid, gameId);
        if (set.size > 0) {
          c.bronze = set.size;
          localStorage.setItem(countsKeyFor(uid, gameId), JSON.stringify(c));
        }
      }
      return c;
    }
    // sem counts mas com set antigo -> migra
    const set = getHubAchievementSet(uid, gameId);
    if (set.size > 0) {
      const c = { platinum: 0, gold: 0, silver: 0, bronze: set.size };
      localStorage.setItem(countsKeyFor(uid, gameId), JSON.stringify(c));
      return c;
    }
    return { platinum: 0, gold: 0, silver: 0, bronze: 0 };
  } catch {
    return { platinum: 0, gold: 0, silver: 0, bronze: 0 };
  }
}

import { calculatePlayerLevelFromXp } from "./trophyTiers";
import { progressionEventBus } from "../services/progressionEvents";

export function getAllUserHubPointsFromStorage(uid: string): number {
  try {
    let total = 0;
    const prefix = `hub_counts:${uid}:`;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) {
        const raw = localStorage.getItem(k);
        if (raw) {
          const c = JSON.parse(raw);
          total += (Number(c.platinum) || 0) * 300 +
                   (Number(c.gold) || 0) * 90 +
                   (Number(c.silver) || 0) * 30 +
                   (Number(c.bronze) || 0) * 15;
        }
      }
    }
    return total;
  } catch {
    return 0;
  }
}

export function incrementHubCount(uid: string, gameId: string, tierIndex: number): void {
  if (tierIndex === 4) return; // Ferro não conta
  try {
    const oldTotalXp = getAllUserHubPointsFromStorage(uid);
    const oldLevelInfo = calculatePlayerLevelFromXp(oldTotalXp);

    const counts = getHubCounts(uid, gameId);
    let gainedXp = 15;
    if (tierIndex === 0) { counts.platinum++; gainedXp = 300; }
    else if (tierIndex === 1) { counts.gold++; gainedXp = 90; }
    else if (tierIndex === 2) { counts.silver++; gainedXp = 30; }
    else if (tierIndex === 3) { counts.bronze++; gainedXp = 15; }
    localStorage.setItem(countsKeyFor(uid, gameId), JSON.stringify(counts));

    const newTotalXp = oldTotalXp + gainedXp;
    const newLevelInfo = calculatePlayerLevelFromXp(newTotalXp);

    progressionEventBus.emitXpGained({
      xpGained: gainedXp,
      totalXp: newTotalXp,
      levelInfo: newLevelInfo,
      tierIndex,
      gameId,
    });

    if (newLevelInfo.level > oldLevelInfo.level) {
      progressionEventBus.emitLevelUp({
        oldLevel: oldLevelInfo.level,
        newLevel: newLevelInfo.level,
        levelInfo: newLevelInfo,
        tierInfo: newLevelInfo.tierInfo,
      });
    }
  } catch (err) {
    console.warn("[hubTrophies] Erro ao incrementar contadores de troféus:", err);
  }
}

export function getHubPointsForGame(uid: string, gameId: string): number {
  const c = getHubCounts(uid, gameId);
  // usa valores PSN + bônus ultra já está em hubCounts via tier? ultra precisa ser separado
  // por simplicidade, ultra já está contado como tier normal + bônus será adicionado via markHubAchievement com tier
  // aqui só soma base
  return c.platinum * 300 + c.gold * 90 + c.silver * 30 + c.bronze * 15;
}

export function getAllHubPoints(uid: string, games: Array<{ id: string }>): number {
  let total = 0;
  for (const g of games) total += getHubPointsForGame(uid, g.id);
  return total;
}

export function getHubAggregateCounts(uid: string, games?: Array<{ id: string }>): import("./trophyTiers").GameTrophyCounts {
  const agg = {
    platinum: 0,
    gold: 0,
    silver: 0,
    bronze: 0,
    iron: 0,
    total: 0,
    completed: 0,
    totalGold: 0,
    totalSilver: 0,
    totalBronze: 0,
    totalPlatinum: 0,
    points: 0,
    hubPoints: 0,
    importedPoints: 0,
    hub: { platinum: 0, gold: 0, silver: 0, bronze: 0 },
    imported: { platinum: 0, gold: 0, silver: 0, bronze: 0 },
  } as any;

  if (!uid) return agg;

  const processedGames = new Set<string>();

  if (games && games.length > 0) {
    for (const g of games) {
      if (!g?.id || processedGames.has(String(g.id))) continue;
      processedGames.add(String(g.id));
      const c = getHubCounts(uid, String(g.id));
      const pts = c.platinum * 300 + c.gold * 90 + c.silver * 30 + c.bronze * 15;
      agg.platinum += c.platinum;
      agg.gold += c.gold;
      agg.silver += c.silver;
      agg.bronze += c.bronze;
      agg.completed += c.platinum + c.gold + c.silver + c.bronze;
      agg.total += c.platinum + c.gold + c.silver + c.bronze;
      agg.points += pts;
      agg.hubPoints += pts;
      agg.hub!.platinum += c.platinum;
      agg.hub!.gold += c.gold;
      agg.hub!.silver += c.silver;
      agg.hub!.bronze += c.bronze;
    }
  }

  // Varredura de segurança em localStorage para incluir jogos que possuem hub_counts mas que não estão na lista filtrada passada
  try {
    const prefix = `hub_counts:${uid}:`;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) {
        const gameId = k.slice(prefix.length);
        if (gameId && !processedGames.has(gameId)) {
          processedGames.add(gameId);
          const raw = localStorage.getItem(k);
          if (raw) {
            const c = JSON.parse(raw);
            const plat = Number(c.platinum) || 0;
            const gold = Number(c.gold) || 0;
            const silver = Number(c.silver) || 0;
            const bronze = Number(c.bronze) || 0;
            const pts = plat * 300 + gold * 90 + silver * 30 + bronze * 15;
            agg.platinum += plat;
            agg.gold += gold;
            agg.silver += silver;
            agg.bronze += bronze;
            agg.completed += plat + gold + silver + bronze;
            agg.total += plat + gold + silver + bronze;
            agg.points += pts;
            agg.hubPoints += pts;
            agg.hub!.platinum += plat;
            agg.hub!.gold += gold;
            agg.hub!.silver += silver;
            agg.hub!.bronze += bronze;
          }
        }
      }
    }
  } catch {}

  // Inclui XP de missões de engajamento (primeiro amigo, primeiro jogo, personalização, etc.)
  try {
    const questXpRaw = localStorage.getItem(`phelierium_quests_xp:${uid}`);
    const questXp = Number(questXpRaw) || 0;
    if (questXp > 0) {
      agg.points += questXp;
      agg.hubPoints += questXp;
    }
  } catch {}

  return agg;
}

/**
 * Função canônica e centralizada para obter o nível unificado do jogador no ecossistema Phelierium Hub.
 * Todos os componentes (Home, Troféus, Perfil, ProfileDropdown) usam exatamente esta fonte única da verdade.
 */
export function getUserUnifiedLevel(
  uid?: string | null,
  games?: Array<{ id: string }>,
): import("./trophyTiers").PlayerLevelInfo {
  if (!uid) {
    return calculatePlayerLevelFromXp(0);
  }
  const hubAgg = getHubAggregateCounts(uid, games || []);
  const totalXp = Math.max(0, hubAgg.hubPoints || hubAgg.points || 0);
  return calculatePlayerLevelFromXp(totalXp);
}

/**
 * Constrói achievementPercents com flag hubUnlocked para uso no calculateGameTrophyCounts.
 * Se a conquista está achieved e está no set do hub, marca hubUnlocked=true.
 */
export function withHubFlag(
  uid: string,
  gameId: string,
  percents: Array<{ percent: number; achieved: boolean; name?: string; description?: string; apiName?: string; id?: string }>
): Array<{ percent: number; achieved: boolean; name?: string; description?: string; apiName?: string; id?: string; hubUnlocked?: boolean }> {
  const hubSet = getHubAchievementSet(uid, gameId);
  return percents.map(p => {
    const key = String((p as any).apiName ?? (p as any).id ?? p.name ?? "").toLowerCase();
    const isHub = p.achieved && hubSet.has(key);
    return { ...p, hubUnlocked: isHub };
  });
}
