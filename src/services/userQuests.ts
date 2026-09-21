// src/services/userQuests.ts
// Sistema de Missões e Marcos de Engajamento para Novos Jogadores (Phelierium Quests)
// Concede XP e marcos diretos de subida de nível para novos jogadores ao realizar ações fundamentais:
// 1. Adicionar o primeiro amigo
// 2. Adicionar o primeiro jogo à biblioteca
// 3. Conectar uma plataforma externa (Steam / Epic Games / Discord)
// 4. Personalizar foto e perfil
// 5. Conquistar o primeiro troféu
// 6. Marcar o primeiro jogo como favorito
// 7. Iniciar a primeira sessão de jogo pelo hub

import { calculatePlayerLevelFromXp } from "../utils/trophyTiers";
import { progressionEventBus } from "./progressionEvents";
import { getAllUserHubPointsFromStorage } from "../utils/hubTrophies";

export type QuestId =
  | "first_friend"
  | "first_game"
  | "connect_platform"
  | "customize_profile"
  | "first_trophy"
  | "favorite_game"
  | "launch_game";

export interface UserQuest {
  id: QuestId;
  title: string;
  description: string;
  xpReward: number;
  instantLevelUp?: boolean;
  completed: boolean;
  completedAt?: string;
  category: "social" | "library" | "identity" | "mastery";
  iconName: string;
}

export const QUEST_DEFINITIONS: Array<Omit<UserQuest, "completed" | "completedAt">> = [
  {
    id: "first_friend",
    title: "Primeira Amizade",
    description: "Adicione seu primeiro amigo no ecossistema Phelierium.",
    xpReward: 60,
    instantLevelUp: true,
    category: "social",
    iconName: "Users",
  },
  {
    id: "first_game",
    title: "Iniciando a Coleção",
    description: "Cadastre ou sincronize seu primeiro jogo na biblioteca.",
    xpReward: 45,
    instantLevelUp: true,
    category: "library",
    iconName: "Gamepad2",
  },
  {
    id: "connect_platform",
    title: "Conexão de Plataforma",
    description: "Conecte sua conta Steam, Epic Games ou Discord ao launcher.",
    xpReward: 30,
    category: "library",
    iconName: "Link",
  },
  {
    id: "customize_profile",
    title: "Identidade Gamer",
    description: "Personalize sua foto de avatar ou sua bio no perfil.",
    xpReward: 30,
    category: "identity",
    iconName: "Sparkles",
  },
  {
    id: "favorite_game",
    title: "Jogo Favorito",
    description: "Marque qualquer jogo com estrela de favorito na biblioteca.",
    xpReward: 15,
    category: "library",
    iconName: "Star",
  },
  {
    id: "launch_game",
    title: "Primeira Jogatina",
    description: "Inicie qualquer jogo diretamente pelo launcher.",
    xpReward: 30,
    category: "mastery",
    iconName: "Play",
  },
  {
    id: "first_trophy",
    title: "Caçador de Troféus",
    description: "Desbloqueie sua primeira conquista em um jogo integrado.",
    xpReward: 45,
    category: "mastery",
    iconName: "Trophy",
  },
];

const getQuestsStorageKey = (uid: string) => `phelierium_quests:${uid}`;
const getQuestsXpKey = (uid: string) => `phelierium_quests_xp:${uid}`;

export function getUserCompletedQuests(uid: string): Record<QuestId, { completedAt: string }> {
  try {
    const raw = localStorage.getItem(getQuestsStorageKey(uid));
    return raw ? JSON.parse(raw) : ({} as any);
  } catch {
    return {} as any;
  }
}

export function getUserQuestsXp(uid: string): number {
  try {
    const raw = localStorage.getItem(getQuestsXpKey(uid));
    return Number(raw) || 0;
  } catch {
    return 0;
  }
}

export function getAllQuestsWithStatus(uid: string): UserQuest[] {
  const completedMap = getUserCompletedQuests(uid);
  return QUEST_DEFINITIONS.map((q) => {
    const record = completedMap[q.id];
    return {
      ...q,
      completed: Boolean(record),
      completedAt: record?.completedAt,
    };
  });
}

export function isQuestsDismissed(uid: string): boolean {
  try {
    return localStorage.getItem(`phelierium_quests_dismissed:${uid}`) === "1";
  } catch {
    return false;
  }
}

export function dismissOnboardingQuests(uid: string): void {
  try {
    localStorage.setItem(`phelierium_quests_dismissed:${uid}`, "1");
  } catch {}
}

/**
 * Determina se o painel de missões de boas-vindas deve ser exibido para o usuário.
 * O painel surge SOMENTE para usuários novos na plataforma:
 * - Contas recém-criadas ou que ainda não concluíram a ambientação inicial.
 * - Usuários iniciantes (poucos jogos, nível inicial) que ainda não completaram a trilha de missões.
 * - Não é exibido se o usuário já for veterano (já tinha jogos/nível/onboarding concluído),
 *   ou se já concluiu todas as 7 missões, ou se dispensou explicitamente o painel.
 */
export function shouldShowOnboardingQuests(
  uid: string,
  userProfile?: {
    createdAt?: string | null;
    created_at?: string | null;
    onboardingCompletedAt?: string | null;
    onboarding_completed_at?: string | null;
  } | null,
  stats?: {
    totalGames?: number;
    level?: number;
  },
): boolean {
  if (!uid) return false;

  // 1. Se o usuário já dispensou manualmente o painel no dispositivo
  if (isQuestsDismissed(uid)) {
    return false;
  }

  // 2. Se já completou todas as missões disponíveis, não exibe mais
  const completedMap = getUserCompletedQuests(uid);
  const completedCount = Object.keys(completedMap).length;
  if (completedCount >= QUEST_DEFINITIONS.length) {
    return false;
  }

  // 3. Verificação de Onboarding geral: se o usuário já finalizou o onboarding geral no passado
  const onboardingAt = userProfile?.onboardingCompletedAt || userProfile?.onboarding_completed_at;
  const legacyOnboardingDone =
    typeof window !== "undefined" &&
    localStorage.getItem(`checkpoint_onboarding_${uid}`) === "1";

  // 4. Marcação de veterano: se o usuário já é jogador consolidado
  const totalGames = stats?.totalGames ?? 0;
  const playerLevel = stats?.level ?? 1;

  if (legacyOnboardingDone && (totalGames > 2 || playerLevel >= 2)) {
    return false;
  }

  if (onboardingAt && (totalGames > 2 || playerLevel >= 2)) {
    return false;
  }

  // 5. Data de criação da conta (se disponível)
  const createdAtStr = userProfile?.createdAt || userProfile?.created_at;
  if (createdAtStr) {
    const createdTimestamp = Date.parse(createdAtStr);
    if (!isNaN(createdTimestamp)) {
      const daysOld = (Date.now() - createdTimestamp) / (1000 * 60 * 60 * 24);
      // Se a conta tem mais de 7 dias e já possui jogos ou onboarding, é usuário antigo
      if (daysOld > 7 && (totalGames > 0 || legacyOnboardingDone || Boolean(onboardingAt))) {
        return false;
      }
    }
  }

  // 6. Cache de primeira visualização: identifica se a conta é nova
  if (typeof window !== "undefined") {
    const firstSeenKey = `phelierium_quests_first_seen:${uid}`;
    const firstSeen = localStorage.getItem(firstSeenKey);

    if (!firstSeen) {
      // Se é o primeiro contato do app com esse usuário mas ele já possui jogos ou nível alto, marca como veterano
      if (totalGames > 2 || playerLevel >= 2 || legacyOnboardingDone || Boolean(onboardingAt)) {
        localStorage.setItem(firstSeenKey, "veteran");
        return false;
      }
      localStorage.setItem(firstSeenKey, new Date().toISOString());
      return true;
    }

    if (firstSeen === "veteran") {
      return false;
    }
  }

  return true;
}

export const isNewUserOnboarding = shouldShowOnboardingQuests;

/**
 * Conclui uma missão para o usuário (idempotente).
 * Se instantLevelUp for true, injeta o XP necessário para garantir a subida de nível imediata.
 */
export function completeUserQuest(
  uid: string,
  questId: QuestId,
  options?: {
    customRewardXp?: number;
    playSound?: (sound: any) => void;
    onNotify?: (msg: string, type?: "success" | "info") => void;
  },
): { completedNow: boolean; gainedXp: number; levelUp: boolean } {
  if (!uid) return { completedNow: false, gainedXp: 0, levelUp: false };

  // Usuários veteranos não participam das missões de boas-vindas
  if (typeof window !== "undefined") {
    if (localStorage.getItem(`phelierium_quests_first_seen:${uid}`) === "veteran") {
      return { completedNow: false, gainedXp: 0, levelUp: false };
    }
    if (localStorage.getItem(`phelierium_quests_dismissed:${uid}`) === "1") {
      return { completedNow: false, gainedXp: 0, levelUp: false };
    }
  }

  const completedMap = getUserCompletedQuests(uid);
  if (completedMap[questId]) {
    return { completedNow: false, gainedXp: 0, levelUp: false };
  }

  const def = QUEST_DEFINITIONS.find((q) => q.id === questId);
  if (!def) return { completedNow: false, gainedXp: 0, levelUp: false };

  // 1. Marca como concluída
  completedMap[questId] = { completedAt: new Date().toISOString() };
  localStorage.setItem(getQuestsStorageKey(uid), JSON.stringify(completedMap));

  // 2. Calcula XP e verifica Level UP
  const currentTrophyXp = getAllUserHubPointsFromStorage(uid);
  const currentQuestsXp = getUserQuestsXp(uid);
  const oldTotalXp = currentTrophyXp + currentQuestsXp;
  const oldLevelInfo = calculatePlayerLevelFromXp(oldTotalXp);

  let xpToAdd = options?.customRewardXp ?? def.xpReward;

  // Se a missão prevê subida garantida de nível, adiciona pelo menos o restante para o próximo nível
  if (def.instantLevelUp) {
    const remainingToLevel = Math.max(1, oldLevelInfo.xpForNextLevel - oldLevelInfo.currentLevelXp);
    xpToAdd = Math.max(xpToAdd, remainingToLevel);
  }

  const newQuestsXp = currentQuestsXp + xpToAdd;
  localStorage.setItem(getQuestsXpKey(uid), String(newQuestsXp));

  const newTotalXp = currentTrophyXp + newQuestsXp;
  const newLevelInfo = calculatePlayerLevelFromXp(newTotalXp);

  const didLevelUp = newLevelInfo.level > oldLevelInfo.level;

  // 3. Emite eventos no EventBus
  progressionEventBus.emitXpGained({
    xpGained: xpToAdd,
    totalXp: newTotalXp,
    levelInfo: newLevelInfo,
  });

  if (didLevelUp) {
    progressionEventBus.emitLevelUp({
      oldLevel: oldLevelInfo.level,
      newLevel: newLevelInfo.level,
      levelInfo: newLevelInfo,
      tierInfo: newLevelInfo.tierInfo,
    });
  }

  if (options?.onNotify) {
    options.onNotify(
      `Missão Concluída: ${def.title}! +${xpToAdd} XP${didLevelUp ? ` • LEVEL UP! NV. ${newLevelInfo.level}` : ""}`,
      "success",
    );
  }

  return { completedNow: true, gainedXp: xpToAdd, levelUp: didLevelUp };
}

/**
 * Auto-verificação periódica de ações já realizadas pelo novo usuário.
 */
export function autoCheckExistingQuests(
  uid: string,
  state: {
    hasSteam?: boolean;
    hasEpic?: boolean;
    hasDiscord?: boolean;
    gamesCount?: number;
    friendsCount?: number;
    favoritesCount?: number;
    achievementsCount?: number;
  },
  options?: {
    playSound?: (sound: any) => void;
    onNotify?: (msg: string, type?: "success" | "info") => void;
  },
): void {
  if (!uid) return;

  if (typeof window !== "undefined") {
    if (localStorage.getItem(`phelierium_quests_first_seen:${uid}`) === "veteran") {
      return;
    }
    if (localStorage.getItem(`phelierium_quests_dismissed:${uid}`) === "1") {
      return;
    }
  }

  if ((state.friendsCount ?? 0) > 0) {
    completeUserQuest(uid, "first_friend", options);
  }
  if ((state.gamesCount ?? 0) > 0) {
    completeUserQuest(uid, "first_game", options);
  }
  if (state.hasSteam || state.hasEpic || state.hasDiscord) {
    completeUserQuest(uid, "connect_platform", options);
  }
  if ((state.favoritesCount ?? 0) > 0) {
    completeUserQuest(uid, "favorite_game", options);
  }
  if ((state.achievementsCount ?? 0) > 0) {
    completeUserQuest(uid, "first_trophy", options);
  }
}
