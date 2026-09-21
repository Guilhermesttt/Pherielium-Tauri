export type TrophyTier = "platinum" | "gold" | "silver" | "bronze";
export type PSNTier = "bronze" | "silver" | "gold" | "platinum";
export type PhelieriumTier = PSNTier;

export interface PSNTierInfo {
  tier: PSNTier;
  subTier: 1 | 2 | 3;
  name: string;
  baseTierName: string;
  color: string;
  hexColor: string;
  bgClass: string;
  borderClass: string;
  glowColor: string;
  gradientFrom: string;
  gradientTo: string;
}

export type PhelieriumTierInfo = PSNTierInfo;

export interface TrophyTierInfo {
  id: TrophyTier;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  glowColor: string;
  gradientFrom: string;
  gradientTo: string;
  xpValue: number;
}

/** Official PlayStation Trophy point values */
export const TROPHY_POINTS = {
  bronze: 15,
  silver: 30,
  gold: 90,
  platinum: 300,
} as const;

/** 
 * Thresholds oficiais de raridade global Steam -> tier PlayStation (single source of truth)
 * 🥇 Ouro: Conquistas entre 0.1% e 5% do mundo (<5%)
 * 🥈 Prata: Conquistas entre 5% e 10% do mundo (5% a 10%)
 * 🥉 Bronze: Conquistas com mais de 10% do mundo (>10%)
 * 🏆 Platina: Troféu especial concedido automaticamente ao atingir 100% das conquistas do jogo.
 */
export const RARITY_THRESHOLDS = {
  gold: 5,      // < 5% = Ouro
  silver: 10,   // 5% a 10% = Prata
  bronze: 10,   // > 10% = Bronze
  ultraRare: 1, // < 1% = Bônus Ultra-raro (+15 XP)
} as const;

export const ULTRA_RARE_BONUS_XP = 15 as const; // +15 XP em troféus <1%
export const EARLY_BOOST_MAX_LEVEL = 20 as const;
export const EARLY_BOOST_XP = 45 as const; // Lv1-20 custa 45 XP em vez de 60

/** Índice visual usado no AchievementRow (0=platina,1=ouro,2=prata,3=bronze,4=ferro) */
export const ACHIEVEMENT_TIER_COUNT = 5 as const;

/** XP de um troféu individual considerando bônus ultra-raro */
export const getTrophyXp = (tier: TrophyTier, percent?: number): number => {
  const base = TROPHY_POINTS[tier];
  if (tier !== "platinum" && percent != null && percent > 0 && percent < RARITY_THRESHOLDS.ultraRare) {
    return base + ULTRA_RARE_BONUS_XP;
  }
  return base;
};

export const isUltraRare = (percent?: number): boolean => {
  return percent != null && percent > 0 && percent < RARITY_THRESHOLDS.ultraRare;
};

export const TIER_LEVELS: TrophyTierInfo[] = [
  {
    id: "platinum",
    label: "Platina",
    color: "text-[#38bdf8]",
    bgColor: "bg-[#38bdf8]/10",
    borderColor: "border-[#38bdf8]/30",
    glowColor: "shadow-[0_0_12px_rgba(56,189,248,0.35)]",
    gradientFrom: "#38bdf8",
    gradientTo: "#0284c7",
    xpValue: TROPHY_POINTS.platinum,
  },
  {
    id: "gold",
    label: "Ouro",
    color: "text-[#fbbf24]",
    bgColor: "bg-[#fbbf24]/10",
    borderColor: "border-[#fbbf24]/30",
    glowColor: "shadow-[0_0_10px_rgba(251,191,36,0.3)]",
    gradientFrom: "#fbbf24",
    gradientTo: "#d97706",
    xpValue: TROPHY_POINTS.gold,
  },
  {
    id: "silver",
    label: "Prata",
    color: "text-[#f1f5f9]",
    bgColor: "bg-[#f1f5f9]/12",
    borderColor: "border-[#f1f5f9]/35",
    glowColor: "shadow-[0_0_14px_rgba(241,245,249,0.30)]",
    gradientFrom: "#f1f5f9",
    gradientTo: "#94a3b8",
    xpValue: TROPHY_POINTS.silver,
  },
  {
    id: "bronze",
    label: "Bronze",
    color: "text-[#cd7f32]",
    bgColor: "bg-[#cd7f32]/10",
    borderColor: "border-[#cd7f32]/30",
    glowColor: "shadow-[0_0_10px_rgba(205,127,50,0.25)]",
    gradientFrom: "#cd7f32",
    gradientTo: "#8b4513",
    xpValue: TROPHY_POINTS.bronze,
  },
];

export const TROPHY_TIERS = TIER_LEVELS;

export const getTrophyTier = (completionPercent: number): TrophyTierInfo => {
  if (completionPercent >= 100) return TIER_LEVELS[0]; // Platina
  if (completionPercent >= 65) return TIER_LEVELS[1];  // Ouro
  if (completionPercent >= 35) return TIER_LEVELS[2];  // Prata
  return TIER_LEVELS[3];                              // Bronze
};

export const getTrophyTierByIndex = (index: number): TrophyTierInfo => {
  return TIER_LEVELS[Math.min(index, TIER_LEVELS.length - 1)];
};

export type TrophyTierType = "PLATINUM" | "GOLD" | "SILVER" | "BRONZE";

export interface RawAchievement {
  apiName?: string;
  id?: string;
  name?: string;
  displayName?: string;
  description?: string;
  icon?: string;
  iconGray?: string;
  percent?: number;
  achieved?: boolean;
  unlockTime?: number;
  hidden?: boolean;
  [key: string]: any;
}

export interface ProcessedAchievement extends RawAchievement {
  key: string;
  tier: TrophyTierType;
  xp: number;
  isPlatina: boolean;
  isVirtual?: boolean;
}

export interface PlatinumResult {
  hasNativePlatinum: boolean;
  platinumTrophy: ProcessedAchievement;
  baseAchievements: RawAchievement[];
  totalBaseAchievements: number;
  unlockedBaseAchievements: number;
  isUnlocked: boolean;
}

/**
 * Validação semântica via Regex (PT/EN/ES) para identificar se a conquista
 * representa 100% de conclusão / Maestria / Troféu de Platina.
 */
export const isPlatinumSemantic = (achievement: Partial<RawAchievement>): boolean => {
  const name = String(achievement.name ?? achievement.displayName ?? achievement.apiName ?? "");
  const desc = String(achievement.description ?? "");
  const combined = `${name} ${desc} ${achievement.apiName ?? ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");

  const PLATINUM_REGEX = /(all\s+achievements|all\s+trophies|unlock\s+all|obtain\s+all|collect\s+all|complete\s+all|earn\s+all|get\s+all|find\s+all|every\s+achievement|every\s+trophy|todas\s+as\s+conquistas|todos\s+os\s+trofeus|desbloqueie\s+todas|obtenha\s+todas|conquiste\s+todas|complete\s+todas|zerar\s+tudo|todos\s+los\s+logros|todos\s+los\s+trofeos|100%|100\s+percent|cem\s+por\s*cento|platin|completionist|perfeccionista|completista|supreme\s+master|grand\s+master|ultimate\s+master|mestre\s+supremo|grande\s+mestre|final\s+verdadeiro)/i;

  return PLATINUM_REGEX.test(combined);
};

/** Alias retrocompatível com o launcher */
export const isPlatinaByText = isPlatinumSemantic;

/**
 * Função definitiva para extrair e processar o Troféu de Platina.
 * - Platina Nativa: identificada semanticamente, removida da lista base (para não distorcer o cálculo de Bronze/Prata/Ouro).
 * - Platina Virtual: injetada para jogos sem platina nativa quando 100% das conquistas base são conquistadas.
 */
export const extractAndProcessPlatinum = (achievements: RawAchievement[]): PlatinumResult => {
  if (!achievements || achievements.length === 0) {
    const virtualPlat: ProcessedAchievement = {
      key: "virtual_platinum",
      apiName: "virtual_platinum",
      name: "Troféu de Platina",
      description: "Obtenha todas as conquistas do jogo.",
      icon: "",
      iconGray: "",
      tier: "PLATINUM",
      xp: 300,
      isPlatina: true,
      isVirtual: true,
      achieved: false,
      percent: 0,
      unlockTime: 0,
    };
    return {
      hasNativePlatinum: false,
      platinumTrophy: virtualPlat,
      baseAchievements: [],
      totalBaseAchievements: 0,
      unlockedBaseAchievements: 0,
      isUnlocked: false,
    };
  }

  // 1. Platina Nativa (Detecção Semântica via Regex)
  const nativeIndex = achievements.findIndex((ach) => isPlatinumSemantic(ach));

  if (nativeIndex !== -1) {
    const nativeRaw = achievements[nativeIndex];
    const key = String(nativeRaw.apiName ?? nativeRaw.id ?? nativeRaw.name ?? `plat_${nativeIndex}`);

    // Crucial: remove a conquista nativa da lista base para não distorcer os tiers matemáticos
    const baseAchievements = achievements.filter((_, idx) => idx !== nativeIndex);
    const totalBaseAchievements = baseAchievements.length;
    const unlockedBaseAchievements = baseAchievements.filter((a) => a.achieved).length;

    // Condição de desbloqueio estrita: todas as conquistas base devem estar liberadas
    const isUnlocked = totalBaseAchievements > 0 && unlockedBaseAchievements === totalBaseAchievements;

    const platinumTrophy: ProcessedAchievement = {
      ...nativeRaw,
      key,
      tier: "PLATINUM",
      xp: 300,
      isPlatina: true,
      isVirtual: false,
      achieved: isUnlocked || Boolean(nativeRaw.achieved),
      unlockTime: nativeRaw.unlockTime ?? (isUnlocked ? Date.now() : 0),
    };

    return {
      hasNativePlatinum: true,
      platinumTrophy,
      baseAchievements,
      totalBaseAchievements,
      unlockedBaseAchievements,
      isUnlocked,
    };
  }

  // 2. Platina Virtual (Gatilho de Interface / Fallback)
  const baseAchievements = [...achievements];
  const totalBaseAchievements = baseAchievements.length;
  const unlockedBaseAchievements = baseAchievements.filter((a) => a.achieved).length;
  const isUnlocked = totalBaseAchievements > 0 && unlockedBaseAchievements === totalBaseAchievements;

  const virtualPlat: ProcessedAchievement = {
    key: "virtual_platinum",
    apiName: "virtual_platinum",
    name: "Troféu de Platina",
    description: "Obtenha todas as conquistas do jogo.",
    icon: "",
    iconGray: "",
    tier: "PLATINUM",
    xp: 300,
    isPlatina: true,
    isVirtual: true,
    achieved: isUnlocked,
    percent: isUnlocked ? 100 : 0,
    unlockTime: isUnlocked ? Date.now() : 0,
  };

  return {
    hasNativePlatinum: false,
    platinumTrophy: virtualPlat,
    baseAchievements,
    totalBaseAchievements,
    unlockedBaseAchievements,
    isUnlocked,
  };
};

/** Retorna o identificador da conquista mais rara (menor % >0) */
export const getRarestAchievementApiName = (
  achievements: Array<{ percent?: number; apiName?: string; id?: string; name?: string }>,
): string | null => {
  let best: { apiName: string; percent: number } | null = null;
  for (const a of achievements) {
    const p = a.percent ?? 0;
    if (p <= 0) continue;
    const id = String(a.apiName ?? a.id ?? a.name ?? "");
    if (!best || p < best.percent) best = { apiName: id, percent: p };
  }
  return best?.apiName ?? null;
};

/** Platina por texto: "todas as conquistas" ou 100% tem prioridade */
export const getPlatinaCandidateApiName = (
  achievements: Array<{ percent?: number; apiName?: string; id?: string; name?: string; description?: string }>,
): string | null => {
  for (const a of achievements) {
    if (isPlatinumSemantic(a as any)) return String((a as any).apiName ?? (a as any).id ?? a.name ?? "");
  }
  return null;
};

export interface UnifiedTierAssignment {
  tierIndex: number; // 0=platina, 1=ouro, 2=prata, 3=bronze, 4=ferro
  tierId: TrophyTier | "iron";
  isPlatina: boolean;
}

/**
 * Constrói o mapa de tiers de cada conquista com base na raridade global oficial:
 * 🥇 Ouro: < 5% (ou conquistas avançadas se offline)
 * 🥈 Prata: 5% a 10% (ou intermediárias se offline)
 * 🥉 Bronze: > 10% (ou iniciais se offline)
 * 🏆 Platina: conquista de 100% / texto de maestria
 */
export const buildGameTierMap = <T extends RawAchievement>(
  achievements: T[],
): Map<string, UnifiedTierAssignment> => {
  const result = new Map<string, UnifiedTierAssignment>();
  if (!achievements || achievements.length === 0) return result;

  const { hasNativePlatinum, platinumTrophy, baseAchievements } = extractAndProcessPlatinum(achievements);

  if (hasNativePlatinum) {
    const platAssignment: UnifiedTierAssignment = { tierIndex: 0, tierId: "platinum", isPlatina: true };
    const platKeys = [platinumTrophy.key, platinumTrophy.apiName, platinumTrophy.id, platinumTrophy.name].filter(Boolean) as string[];
    platKeys.forEach((k) => result.set(k, platAssignment));
  }

  const remaining = baseAchievements.length;
  if (remaining === 0) return result;

  // Ordenar conquistas base por raridade (menor percentual primeiro = mais raras)
  const sorted = [...baseAchievements].sort((a, b) => {
    const pa = typeof a.percent === "number" && a.percent > 0 ? a.percent : 999;
    const pb = typeof b.percent === "number" && b.percent > 0 ? b.percent : 999;
    return pa - pb;
  });

  // Distribuição equilibrada padrão PlayStation / Phelierium:
  // ~12-15% Ouro (mais raras / chefes finais / maestria)
  // ~28-30% Prata (intermediárias / avançadas)
  // ~55-60% Bronze (iniciais / comuns)
  let goldCount = 0;
  let silverCount = 0;

  if (remaining === 1) {
    goldCount = 1;
  } else if (remaining === 2) {
    goldCount = 1;
    silverCount = 1;
  } else if (remaining === 3) {
    goldCount = 1;
    silverCount = 1;
  } else {
    goldCount = Math.max(1, Math.round(remaining * 0.14));
    silverCount = Math.max(1, Math.round(remaining * 0.28));
    // Garantir pelo menos 1 bronze se houver >= 3 conquistas
    if (goldCount + silverCount >= remaining) {
      silverCount = Math.max(1, remaining - goldCount - 1);
    }
  }

  sorted.forEach((item, idx) => {
    const keys = [item.apiName, item.id, item.name].filter(Boolean) as string[];
    let assignment: UnifiedTierAssignment;
    if (idx < goldCount) {
      assignment = { tierIndex: 1, tierId: "gold", isPlatina: false };
    } else if (idx < goldCount + silverCount) {
      assignment = { tierIndex: 2, tierId: "silver", isPlatina: false };
    } else {
      assignment = { tierIndex: 3, tierId: "bronze", isPlatina: false };
    }
    keys.forEach((k) => result.set(k, assignment));
  });

  return result;
};

/**
 * Classificação por conquista fiel ao painel (single source).
 * Se o jogo tiver conquista embutida de desbloquear tudo -> Platina.
 * Demais conquistas distribuídas por raridade entre Ouro (<15%), Prata (15-40%) e Bronze (>40%).
 */
export const getAchievementTierIndex = (
  achievement: { percent?: number; achieved?: boolean; name?: string; description?: string; apiName?: string; id?: string },
  totalInGame: number,
  options?: { isRarest?: boolean; isPlatinaText?: boolean },
): number => {
  if (options?.isPlatinaText || isPlatinaByText(achievement as any)) return 0; // Platina nativa
  if (options?.isRarest) return 1; // A mais rara vira Ouro

  const pct = achievement.percent ?? 0;
  if (pct > 0 && pct < 15) return 1; // Ouro <15%
  if (pct >= 15 && pct <= 40) return 2; // Prata 15-40%
  if (pct > 40) return 3; // Bronze >40%
  return 3; // Fallback para bronze
};

export const getAchievementTierId = (
  achievement: { percent?: number; achieved?: boolean },
  totalInGame: number,
): TrophyTier | "iron" => {
  const idx = getAchievementTierIndex(achievement, totalInGame);
  const map: Array<TrophyTier | "iron"> = ["platinum", "gold", "silver", "bronze", "iron"];
  return map[idx];
};

export interface TrophyOriginCounts {
  platinum: number;
  gold: number;
  silver: number;
  bronze: number;
}

export interface GameTrophyCounts {
  platinum: number;
  gold: number;
  silver: number;
  bronze: number;
  iron: number; // agora reflete a contagem real de conquistas em Ferro (bloqueadas, sem dado global)
  total: number;
  completed: number;
  totalGold?: number;
  totalSilver?: number;
  totalBronze?: number;
  totalPlatinum?: number;
  points?: number;
  hubPoints?: number; // XP só do hub (para level)
  importedPoints?: number; // XP importado (não conta pro level)
  // NOVO: separar por origem (segurança / anti-farm)
  hub?: { platinum: number; gold: number; silver: number; bronze: number }; // ganhos via hub
  imported?: { platinum: number; gold: number; silver: number; bronze: number }; // pré-existentes importados
}

/**
 * Distribui as conquistas de um jogo nas categorias PlayStation:
 * 🥉 Bronze: >10% global
 * 🥈 Prata: 5% a 10% global
 * 🥇 Ouro: <5% global
 * 🏆 Platina: 100% de conclusão do jogo (+300 XP)
 */
export const calculateGameTrophyCounts = (
  totalAchievements: number,
  completedAchievements: number,
  achievementPercents?: Array<{ percent: number; achieved: boolean; name?: string; description?: string; apiName?: string; id?: string; hubUnlocked?: boolean }>,
): GameTrophyCounts => {
  const total = Math.max(0, totalAchievements);
  const completed = Math.min(total, Math.max(0, completedAchievements));

  if (total === 0) {
    return {
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
    };
  }

  // Se temos dados detalhados das conquistas — usamos a regra exata de raridade global
  if (achievementPercents && achievementPercents.length > 0) {
    const tierMap = buildGameTierMap(achievementPercents);
    let tGold = 0, tSilver = 0, tBronze = 0, tIron = 0;
    let uGold = 0, uSilver = 0, uBronze = 0, uPlatinum = 0, uIron = 0;
    let hubPlatinum = 0, hubGold = 0, hubSilver = 0, hubBronze = 0;
    let importedPlatinum = 0, importedGold = 0, importedSilver = 0, importedBronze = 0;
    let ultraRareBonus = 0;

    for (const ach of achievementPercents) {
      const key = String(ach.apiName ?? ach.id ?? ach.name ?? "");
      const info = tierMap.get(key);
      const tierIndex = info ? info.tierIndex : 3;

      // separa hub vs imported: se hubUnlocked === true, conta como hub, senão imported
      const isHub = ach.hubUnlocked === true;

      if (tierIndex === 0) {
        if (ach.achieved) {
          uPlatinum = 1;
          if (isHub) hubPlatinum = 1; else importedPlatinum = 1;
        }
      } else if (tierIndex === 1) {
        tGold++;
        if (ach.achieved) {
          uGold++;
          if (isHub) hubGold++; else importedGold++;
        }
      } else if (tierIndex === 2) {
        tSilver++;
        if (ach.achieved) {
          uSilver++;
          if (isHub) hubSilver++; else importedSilver++;
        }
      } else if (tierIndex === 4) {
        // Ferro: raridade ainda desconhecida, não entra na contagem de troféus "reais"
        tIron++;
        if (ach.achieved) uIron++;
      } else {
        tBronze++;
        if (ach.achieved) {
          uBronze++;
          if (isHub) hubBronze++; else importedBronze++;
        }
      }

      const isUltra = (ach.percent ?? 0) > 0 && (ach.percent ?? 0) < RARITY_THRESHOLDS.ultraRare;
      if (ach.achieved && isUltra && isHub) ultraRareBonus += ULTRA_RARE_BONUS_XP;
    }

    // Platina especial: se o usuário liberou 100% das conquistas listadas, ganha a Platina.
    // Deriva de achievementPercents (fonte de verdade), não dos parâmetros externos,
    // pra não depender de totalAchievements/completedAchievements estarem sincronizados.
    const achievementCount = achievementPercents.length;
    const completedFromList = achievementPercents.filter((a) => a.achieved).length;
    const hasFullCompletion = achievementCount > 0 && completedFromList >= achievementCount;
    if (hasFullCompletion && uPlatinum === 0) {
      uPlatinum = 1;
      // platina de 100% conta como hub se qualquer conquista foi via hub (melhor esforço)
      const anyHub = achievementPercents.some(a => a.achieved && a.hubUnlocked === true);
      if (anyHub) hubPlatinum = 1; else importedPlatinum = 1;
    }

    const tPlatinum = 1;
    const totalTrophies = tGold + tSilver + tBronze + tPlatinum;
    const completedTrophies = uGold + uSilver + uBronze + uPlatinum;

    const points =
      uBronze * TROPHY_POINTS.bronze +
      uSilver * TROPHY_POINTS.silver +
      uGold * TROPHY_POINTS.gold +
      uPlatinum * TROPHY_POINTS.platinum +
      ultraRareBonus;

    const hubPoints =
      hubBronze * TROPHY_POINTS.bronze +
      hubSilver * TROPHY_POINTS.silver +
      hubGold * TROPHY_POINTS.gold +
      hubPlatinum * TROPHY_POINTS.platinum +
      ultraRareBonus;
    const importedPoints =
      importedBronze * TROPHY_POINTS.bronze +
      importedSilver * TROPHY_POINTS.silver +
      importedGold * TROPHY_POINTS.gold +
      importedPlatinum * TROPHY_POINTS.platinum;

    return {
      platinum: uPlatinum,
      gold: uGold,
      silver: uSilver,
      bronze: uBronze,
      iron: tIron, // conquistas ainda sem tier definido (bloqueadas, sem dado global)
      total: totalTrophies,
      completed: completedTrophies,
      totalGold: tGold,
      totalSilver: tSilver,
      totalBronze: tBronze,
      totalPlatinum: tPlatinum,
      points,
      hubPoints,
      importedPoints,
      hub: { platinum: hubPlatinum, gold: hubGold, silver: hubSilver, bronze: hubBronze },
      imported: { platinum: importedPlatinum, gold: importedGold, silver: importedSilver, bronze: importedBronze },
    };
  }

  // Distribuição de fallback proporcional para quando não há lista com percentuais detalhados
  let totalGold = 0;
  let totalSilver = 0;
  let totalBronze = 0;

  if (total === 1) {
    // A única conquista existente é a própria Platina; não sobra slot pra Ouro/Prata/Bronze.
    totalGold = 0;
    totalSilver = 0;
    totalBronze = 0;
  } else if (total === 2) {
    // 1 slot reservado pra Platina (total - 1 = 1), o resto é Ouro.
    totalGold = 1;
    totalSilver = 0;
    totalBronze = 0;
  } else if (total === 3) {
    // 1 slot reservado pra Platina (total - 1 = 2), dividido entre Ouro e Prata.
    totalGold = 1;
    totalSilver = 1;
    totalBronze = 0;
  } else {
    // total >= 4
    totalGold = Math.max(1, Math.round((total - 1) * 0.12));
    totalSilver = Math.max(1, Math.round((total - 1) * 0.28));
    totalBronze = Math.max(1, (total - 1) - totalGold - totalSilver);

    if (totalGold + totalSilver + totalBronze > total - 1) {
      const excess = totalGold + totalSilver + totalBronze - (total - 1);
      if (totalBronze > 1) {
        totalBronze -= Math.min(excess, totalBronze - 1);
      }
    }
  }

  // Desbloqueio progressivo: Bronze -> Prata -> Ouro
  let remaining = completed;
  const unlockedBronze = Math.min(remaining, totalBronze);
  remaining = Math.max(0, remaining - unlockedBronze);
  const unlockedSilver = Math.min(remaining, totalSilver);
  remaining = Math.max(0, remaining - unlockedSilver);
  const unlockedGold = Math.min(remaining, totalGold);

  const hasPlatinum = completed >= total && total > 0;
  const unlockedPlatinum = hasPlatinum ? 1 : 0;
  const totalPlatinum = 1;

  const totalTrophies = totalGold + totalSilver + totalBronze + totalPlatinum;
  const completedTrophies = unlockedBronze + unlockedSilver + unlockedGold + unlockedPlatinum;

  const points =
    unlockedBronze * TROPHY_POINTS.bronze +
    unlockedSilver * TROPHY_POINTS.silver +
    unlockedGold * TROPHY_POINTS.gold +
    unlockedPlatinum * TROPHY_POINTS.platinum;

  // Fallback sem lista detalhada: trata tudo como imported (não conta pro level do hub)
  return {
    platinum: unlockedPlatinum,
    gold: unlockedGold,
    silver: unlockedSilver,
    bronze: unlockedBronze,
    iron: 0, // sem dados detalhados por conquista, não há como estimar Ferro aqui
    total: totalTrophies,
    completed: completedTrophies,
    totalGold,
    totalSilver,
    totalBronze,
    totalPlatinum,
    points,
    hubPoints: 0,
    importedPoints: points,
    hub: { platinum: 0, gold: 0, silver: 0, bronze: 0 },
    imported: { platinum: unlockedPlatinum, gold: unlockedGold, silver: unlockedSilver, bronze: unlockedBronze },
  };
};

/** Tabela oficial de progressão por faixas de nível da PlayStation Network */
interface PSNLevelBracket {
  minLevel: number;
  maxLevel: number;
  xpPerLevel: number;
}

/** Brackets PSN com early-boost Lv1-20 (45 XP) para retenção inicial — ainda fiel ao PSN, só mais rápido no começo */
const PSN_LEVEL_BRACKETS: PSNLevelBracket[] = [
  { minLevel: 1, maxLevel: 20, xpPerLevel: EARLY_BOOST_XP }, // boost: 45 XP
  { minLevel: 21, maxLevel: 99, xpPerLevel: 60 },
  { minLevel: 100, maxLevel: 199, xpPerLevel: 90 },
  { minLevel: 200, maxLevel: 299, xpPerLevel: 450 },
  { minLevel: 300, maxLevel: 399, xpPerLevel: 900 },
  { minLevel: 400, maxLevel: 499, xpPerLevel: 1350 },
  { minLevel: 500, maxLevel: 599, xpPerLevel: 1800 },
  { minLevel: 600, maxLevel: 699, xpPerLevel: 2250 },
  { minLevel: 700, maxLevel: 799, xpPerLevel: 2700 },
  { minLevel: 800, maxLevel: 999, xpPerLevel: 3150 },
];

/**
 * Thresholds de Níveis por Patente no Phelierium:
 * - 🥉 Bronze: Níveis 1 a 24 (Bronze 1: 1-9, Bronze 2: 10-19, Bronze 3: 20-24)
 * - 🥈 Prata: Níveis 25 a 49 (Prata 1: 25-32, Prata 2: 33-41, Prata 3: 42-49)
 * - 🥇 Ouro: Níveis 50 a 99 (Ouro 1: 50-65, Ouro 2: 66-82, Ouro 3: 83-99)
 * - 🏆 Platina: Nível 100+ (O ápice supremo da jornada)
 */
export const TIER_LEVEL_BOUNDARIES = {
  silver: 25,
  gold: 50,
  platinum: 100,
} as const;

/**
 * Retorna as informações visuais e de classificação do Tier PSN
 */
export const getPSNTierInfo = (level: number): PSNTierInfo => {
  const lvl = Math.max(1, level);

  if (lvl >= TIER_LEVEL_BOUNDARIES.platinum) {
    return {
      tier: "platinum",
      subTier: 3,
      name: "Platina",
      baseTierName: "Platina",
      color: "text-[#38bdf8]",
      hexColor: "#38bdf8",
      bgClass: "bg-[#38bdf8]/15",
      borderClass: "border-[#38bdf8]/40",
      glowColor: "shadow-[0_0_20px_rgba(56,189,248,0.4)]",
      gradientFrom: "#38bdf8",
      gradientTo: "#0284c7",
    };
  }

  if (lvl >= TIER_LEVEL_BOUNDARIES.gold) {
    const subTier = (lvl >= 83 ? 3 : lvl >= 66 ? 2 : 1) as 1 | 2 | 3;
    return {
      tier: "gold",
      subTier,
      name: `Ouro ${subTier}`,
      baseTierName: "Ouro",
      color: "text-[#fbbf24]",
      hexColor: "#fbbf24",
      bgClass: "bg-[#fbbf24]/15",
      borderClass: "border-[#fbbf24]/40",
      glowColor: "shadow-[0_0_15px_rgba(251,191,36,0.3)]",
      gradientFrom: "#fbbf24",
      gradientTo: "#d97706",
    };
  }

  if (lvl >= TIER_LEVEL_BOUNDARIES.silver) {
    const subTier = (lvl >= 42 ? 3 : lvl >= 33 ? 2 : 1) as 1 | 2 | 3;
    return {
      tier: "silver",
      subTier,
      name: `Prata ${subTier}`,
      baseTierName: "Prata",
      color: "text-[#f1f5f9]",
      hexColor: "#f1f5f9",
      bgClass: "bg-[#f1f5f9]/15",
      borderClass: "border-[#f1f5f9]/40",
      glowColor: "shadow-[0_0_14px_rgba(241,245,249,0.30)]",
      gradientFrom: "#f1f5f9",
      gradientTo: "#94a3b8",
    };
  }

  const subTier = (lvl >= 20 ? 3 : lvl >= 10 ? 2 : 1) as 1 | 2 | 3;
  return {
    tier: "bronze",
    subTier,
    name: `Bronze ${subTier}`,
    baseTierName: "Bronze",
    color: "text-[#cd7f32]",
    hexColor: "#cd7f32",
    bgClass: "bg-[#cd7f32]/15",
    borderClass: "border-[#cd7f32]/40",
    glowColor: "shadow-[0_0_12px_rgba(205,127,50,0.25)]",
    gradientFrom: "#cd7f32",
    gradientTo: "#8b4513",
  };
};

export interface PlayerLevelInfo {
  level: number;
  xp: number;
  progress: number;
  currentLevelXp: number;
  xpForNextLevel: number;
  tier: PSNTier;
  subTier: number;
  tierName: string;
  rank: string;
  rankColor: string;
  tierInfo: PSNTierInfo;
}

/** Helper: agrega contadores de vários jogos (evita duplicação Home/TrophiesPage) */
export const aggregateTrophyCounts = (
  games: Array<{ totalAchievements?: number; completedAchievements?: number; achievementPercents?: Array<{ percent: number; achieved: boolean; hubUnlocked?: boolean }> }>,
): GameTrophyCounts => {
  const agg: GameTrophyCounts = {
    platinum: 0, gold: 0, silver: 0, bronze: 0, iron: 0,
    total: 0, completed: 0,
    totalGold: 0, totalSilver: 0, totalBronze: 0, totalPlatinum: 0,
    points: 0,
    hubPoints: 0,
    importedPoints: 0,
    hub: { platinum: 0, gold: 0, silver: 0, bronze: 0 },
    imported: { platinum: 0, gold: 0, silver: 0, bronze: 0 },
  };
  for (const g of games) {
    const t = g.totalAchievements ?? 0;
    const c = g.completedAchievements ?? 0;
    const counts = g.achievementPercents
      ? calculateGameTrophyCounts(t, c, g.achievementPercents as any)
      : calculateGameTrophyCounts(t, c);
    agg.platinum += counts.platinum;
    agg.gold += counts.gold;
    agg.silver += counts.silver;
    agg.bronze += counts.bronze;
    agg.iron += counts.iron;
    agg.total += counts.total;
    agg.completed += counts.completed;
    agg.points = (agg.points ?? 0) + (counts.points ?? 0);
    agg.hubPoints = (agg.hubPoints ?? 0) + (counts.hubPoints ?? 0);
    agg.importedPoints = (agg.importedPoints ?? 0) + (counts.importedPoints ?? 0);
    if (counts.hub) {
      agg.hub!.platinum += counts.hub.platinum;
      agg.hub!.gold += counts.hub.gold;
      agg.hub!.silver += counts.hub.silver;
      agg.hub!.bronze += counts.hub.bronze;
    }
    if (counts.imported) {
      agg.imported!.platinum += counts.imported.platinum;
      agg.imported!.gold += counts.imported.gold;
      agg.imported!.silver += counts.imported.silver;
      agg.imported!.bronze += counts.imported.bronze;
    }
  }
  return agg;
};

export const calculatePlayerLevelFromGames = (
  games: Array<{ totalAchievements?: number; completedAchievements?: number; achievementPercents?: { percent: number; achieved: boolean }[] }>,
): PlayerLevelInfo => {
  const agg = aggregateTrophyCounts(games);
  return calculatePlayerLevel(0, 0, 0, agg);
};

/** XP total necessário para atingir cada bracket (útil para testes/debug) */
export const getTotalXpForLevel = (targetLevel: number): number => {
  const lvl = Math.min(999, Math.max(1, targetLevel));
  if (lvl <= 1) return 0;
  let xp = 0;
  let remainingLevels = lvl - 1;
  for (const b of PSN_LEVEL_BRACKETS) {
    const levelsInBracket = b.maxLevel - b.minLevel + 1;
    const take = Math.min(remainingLevels, levelsInBracket);
    xp += take * b.xpPerLevel;
    remainingLevels -= take;
    if (remainingLevels <= 0) break;
  }
  return xp;
};

export const calculatePlayerLevelFromXp = (trophyXp: number): PlayerLevelInfo => {
  let remainingXp = Math.max(0, trophyXp);
  let currentLevel = 1;
  let currentLevelXp = 0;
  let xpForNextLevel: number = EARLY_BOOST_XP;
  let progress = 0;

  for (const bracket of PSN_LEVEL_BRACKETS) {
    const levelsInBracket = bracket.maxLevel - bracket.minLevel + 1;
    const bracketTotalXp = levelsInBracket * bracket.xpPerLevel;

    if (remainingXp >= bracketTotalXp) {
      remainingXp -= bracketTotalXp;
      currentLevel = bracket.maxLevel + 1;
    } else {
      const levelsGained = Math.floor(remainingXp / bracket.xpPerLevel);
      currentLevel += levelsGained;
      currentLevelXp = remainingXp % bracket.xpPerLevel;
      xpForNextLevel = bracket.xpPerLevel;
      progress = xpForNextLevel > 0 ? (currentLevelXp / xpForNextLevel) * 100 : 0;
      break;
    }
  }

  if (currentLevel >= 999) {
    currentLevel = 999;
    currentLevelXp = 0;
    xpForNextLevel = 0;
    progress = 100;
  }

  const tierInfo = getPSNTierInfo(currentLevel);

  return {
    level: currentLevel,
    xp: trophyXp,
    progress: Math.min(100, Math.round(progress)),
    currentLevelXp,
    xpForNextLevel,
    tier: tierInfo.tier,
    subTier: tierInfo.subTier,
    tierName: tierInfo.name,
    rank: tierInfo.name,
    rankColor: tierInfo.color,
    tierInfo,
  };
};

/**
 * Calcula o nível da conta e progresso baseado no sistema oficial da PlayStation Network (PSN).
 * @deprecated totalHours/totalAchievements/totalGames mantidos por compatibilidade mas ignorados; XP é 100% troféu PSN.
 */
export const calculatePlayerLevel = (
  totalHours: number,
  totalAchievements: number,
  totalGames: number,
  trophyCounts: GameTrophyCounts,
): PlayerLevelInfo => {
  // Nível seguro: só conta XP ganho VIA HUB (anti-farm de importação).
  // Se hubPoints existir (novo formato), usa ele; senão fallback para total (compatibilidade).
  let trophyXp: number;
  if (trophyCounts.hubPoints != null) {
    trophyXp = trophyCounts.hubPoints;
  } else if (trophyCounts.hub) {
    const h = trophyCounts.hub;
    trophyXp =
      h.platinum * TROPHY_POINTS.platinum +
      h.gold * TROPHY_POINTS.gold +
      h.silver * TROPHY_POINTS.silver +
      h.bronze * TROPHY_POINTS.bronze;
    // ultra bonus já está em hubPoints quando disponível; sem hubPoints, estima via points
    if (trophyCounts.points != null) {
      const baseTotal =
        trophyCounts.platinum * TROPHY_POINTS.platinum +
        trophyCounts.gold * TROPHY_POINTS.gold +
        trophyCounts.silver * TROPHY_POINTS.silver +
        trophyCounts.bronze * TROPHY_POINTS.bronze;
      const ultra = Math.max(0, (trophyCounts.points ?? 0) - baseTotal);
      // se houver hub mas sem hubPoints, ultra é do hub (imported não tem ultra)
      if (h.platinum + h.gold + h.silver + h.bronze > 0) trophyXp += ultra;
    }
  } else {
    const baseXp =
      trophyCounts.platinum * TROPHY_POINTS.platinum +
      trophyCounts.gold * TROPHY_POINTS.gold +
      trophyCounts.silver * TROPHY_POINTS.silver +
      trophyCounts.bronze * TROPHY_POINTS.bronze;
    trophyXp = trophyCounts.points != null && trophyCounts.points > baseXp ? trophyCounts.points : baseXp;
  }

  return calculatePlayerLevelFromXp(trophyXp);
};