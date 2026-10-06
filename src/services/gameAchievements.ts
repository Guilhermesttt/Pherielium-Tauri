import type { Game } from "../types/domain";
import type { LauncherLanguage } from "../context/PreferencesContext";
import { resolveEpicAchievementAppName } from "./launcher";
import { fetchEpicAchievements } from "./epic";
import {
  fetchSteamAchievementDetails,
  fetchSteamAchievementSchema,
  getCachedSteamAchievementDetails,
  searchSteamGames,
  setCachedSteamAchievementDetails,
  type SteamAchievement,
} from "./steam";
import { normalizeSteamLookup } from "../types/gameDetail";

type LocalAchievementDef = { id: string; name: string; description: string; icon: string };

export interface LoadGameAchievementsOptions {
  language?: LauncherLanguage;
  steamId?: string | null;
  bypassSteamCache?: boolean;
  persistLibrary?: boolean;
  userUid?: string | null;
}

export interface GameAchievementsPhaseResult {
  items: SteamAchievement[];
  sourceAppId: string;
}

export interface GameAchievementsResult extends GameAchievementsPhaseResult {
  error: string | null;
  libraryPatch?: {
    totalAchievements: number;
    completedAchievements: number;
  };
}

export interface LoadGameAchievementsCallbacks {
  onCached?: (result: GameAchievementsPhaseResult) => void;
  onLocal?: (result: GameAchievementsPhaseResult) => void;
  onLoadingRemote?: () => void;
}

export interface AchievementUnlockPayload {
  gameId: string;
  achievementId: string;
  earnedTime?: number;
  unlockedAt?: string;
}

function buildProgressKeys(
  game: Game,
  resolvedAppId: string,
  localSteamAppId: string,
): string[] {
  return Array.from(new Set([
    game.id,
    localSteamAppId ? `steam_${localSteamAppId}` : "",
    localSteamAppId,
    resolvedAppId ? `steam_${resolvedAppId}` : "",
    resolvedAppId,
    game.steamAppId ? `steam_${game.steamAppId}` : "",
    game.steamAppId,
  ])).filter(Boolean) as string[];
}

async function readLocalAchievementDefinitions(game: Game): Promise<{
  localDefs: LocalAchievementDef[] | null;
  localSteamAppId: string;
}> {
  let localDefs: LocalAchievementDef[] | null = null;
  let localSteamAppId = "";
  try {
    if (window.electronAPI?.getLocalAchievementDefinitions) {
      const raw = await window.electronAPI.getLocalAchievementDefinitions(game.id);
      const rawDefs = (raw as any)?.definitions || (raw as any)?.achievements;
      if (rawDefs && Array.isArray(rawDefs) && rawDefs.length > 0) {
        localDefs = rawDefs;
        localSteamAppId = (raw as any).steamAppId || "";
      }
    }
  } catch {
    /* ignore */
  }
  return { localDefs, localSteamAppId };
}

async function readLocalProgress(
  progressKeys: string[],
  gameDir?: string,
): Promise<{
  localProgress: { unlockedAchievements?: Record<string, { unlockedAt?: string }> } | null;
  retroactiveState: Record<string, { earned?: boolean; earnedTime?: number }>;
}> {
  let localProgress: { unlockedAchievements?: Record<string, { unlockedAt?: string }> } | null = null;
  if (window.electronAPI?.getLocalAchievementProgress) {
    for (const key of progressKeys) {
      try {
        const progress = await window.electronAPI.getLocalAchievementProgress(key);
        if (progress?.unlockedAchievements && Object.keys(progress.unlockedAchievements).length > 0) {
          localProgress = progress;
          break;
        }
      } catch {
        /* ignore */
      }
    }
  }

  let retroactiveState: Record<string, { earned?: boolean; earnedTime?: number }> = {};
  if (window.electronAPI?.getLocalAchievementState) {
    for (const key of progressKeys) {
      try {
        const state = await window.electronAPI.getLocalAchievementState(key, gameDir);
        if (state && Object.keys(state).length > 0) {
          retroactiveState = state;
          break;
        }
      } catch {
        /* ignore */
      }
    }
  }

  return { localProgress, retroactiveState };
}

function mergeDefsWithLocalProgress(
  localDefs: LocalAchievementDef[],
  localProgress: { unlockedAchievements?: Record<string, { unlockedAt?: string }> } | null,
  retroactiveState: Record<string, { earned?: boolean; earnedTime?: number }>,
): SteamAchievement[] {
  return localDefs.map((def) => {
    const unlocked = localProgress?.unlockedAchievements?.[def.id]
      || localProgress?.unlockedAchievements?.[def.id.toLowerCase()];
    const emuState = retroactiveState[def.id] || retroactiveState[def.id.toLowerCase()];
    const achieved = Boolean(unlocked || emuState?.earned);
    const unlockTime = unlocked?.unlockedAt
      ? Math.floor(new Date(unlocked.unlockedAt).getTime() / 1000)
      : emuState?.earnedTime || 0;
    return {
      apiName: def.id,
      name: def.name,
      description: def.description,
      icon: def.icon,
      iconGray: "",
      hidden: false,
      achieved,
      unlockTime,
      percent: 0,
    };
  });
}

function mapEpicAchievement(ach: Record<string, unknown>): SteamAchievement {
  return {
    apiName: String(ach.apiName || ach.name || ""),
    name: String(ach.name || ach.display_name || "Conquista"),
    description: String(ach.description || ach.unlockedDescription || ""),
    achieved: Boolean(ach.achieved || ach.unlocked),
    icon: String(ach.icon || ach.icon_link || ach.iconLink || ach.unlockedIconLink || ""),
    iconGray: String(ach.iconGray || ach.locked_icon_link || ach.icon || ""),
    hidden: Boolean(ach.hidden),
    percent: typeof ach.percent === "number" ? ach.percent : (ach.rarity as any)?.percent ?? 0,
    unlockTime: typeof ach.unlockTime === "number" && ach.unlockTime > 0
      ? ach.unlockTime
      : ach.unlockDate || ach.unlock_date
        ? Math.round(new Date(String(ach.unlockDate || ach.unlock_date)).getTime() / 1000)
        : 0,
  };
}

async function loadEpicAchievements(game: Game): Promise<GameAchievementsResult | null> {
  const appName = resolveEpicAchievementAppName(game);
  const sandboxId = game.epicNamespace
    || (game.epicCatalogId?.includes(":") ? game.epicCatalogId.split(":")[0] : undefined);

  const tryOnline = async (targetAppName: string) => {
    const achRes = await fetchEpicAchievements(sandboxId, targetAppName);
    if (!achRes.list?.length) return null;
    const items = achRes.list.map((ach) => mapEpicAchievement(ach as unknown as Record<string, unknown>));
    return {
      items,
      sourceAppId: "epic-online",
      error: null,
      libraryPatch: {
        totalAchievements: achRes.total || items.length,
        completedAchievements: achRes.completed || items.filter((item) => item.achieved).length,
      },
    } satisfies GameAchievementsResult;
  };

  try {
    const primary = await tryOnline(appName);
    if (primary) return primary;
    if (game.title && game.title !== appName) {
      const fallback = await tryOnline(game.title);
      if (fallback) return fallback;
    }
  } catch {
    /* fallback below */
  }

  if (window.electronAPI?.getEpicLocalAchievements) {
    const catalogItemId = game.epicCatalogId?.includes(":")
      ? game.epicCatalogId.split(":")[1]
      : game.epicCatalogId;
    const fullLaunchId = (game.epicNamespace && game.epicCatalogId && game.epicLaunchId)
      ? `${game.epicNamespace}:${catalogItemId}:${game.epicLaunchId}`
      : game.epicLaunchId;

    const localResult = await window.electronAPI.getEpicLocalAchievements({
      gameId: catalogItemId || game.id,
      title: game.title,
      epicCatalogId: catalogItemId || game.epicCatalogId,
      epicLaunchId: fullLaunchId || game.epicLaunchId,
      executablePath: game.executablePath,
    }).catch(() => null);

    if (localResult?.achievements?.length) {
      const items = localResult.achievements.map((ach) => ({
        ...mapEpicAchievement(ach as unknown as Record<string, unknown>),
        percent: (ach as any).percent ?? 0,
      }));
      return {
        items,
        sourceAppId: "epic-local",
        error: null,
        libraryPatch: {
          totalAchievements: localResult.total || items.length,
          completedAchievements: localResult.unlocked || items.filter((item) => item.achieved).length,
        },
      };
    }
  }

  return null;
}

async function loadSteamAchievements(
  game: Game,
  options: LoadGameAchievementsOptions,
  localDefs: LocalAchievementDef[] | null,
  localSteamAppId: string,
): Promise<GameAchievementsResult> {
  let resolvedAppId = String(game.steamAppId || "").trim();

  if (!resolvedAppId) {
    const results = await searchSteamGames(game.title);
    const normalizedTitle = normalizeSteamLookup(game.title);
    const matched = results.find((candidate) => {
      const rawName = typeof candidate.name === "string"
        ? candidate.name
        : typeof candidate.title === "string"
          ? candidate.title
          : "";
      return normalizeSteamLookup(rawName) === normalizedTitle;
    });
    if (matched?.id != null) {
      resolvedAppId = String(matched.id).trim();
    }
  }

  if (!resolvedAppId) {
    if (localDefs?.length) {
      return {
        items: [],
        sourceAppId: localSteamAppId,
        error: null,
      };
    }
    return {
      items: [],
      sourceAppId: "",
      error: null,
    };
  }

  const language = options.language || "pt-BR";
  const result = game.launcherType === "local"
    ? await fetchSteamAchievementSchema(resolvedAppId, language)
    : options.steamId
      ? await fetchSteamAchievementDetails(
        options.steamId,
        resolvedAppId,
        language,
        { bypassCache: options.bypassSteamCache },
      )
      : await fetchSteamAchievementSchema(resolvedAppId, language);

  if (result.achievements?.length && window.electronAPI?.saveLocalAchievementDefinitions) {
    try {
      await window.electronAPI.saveLocalAchievementDefinitions(
        game.id,
        result.achievements.map((ach) => ({
          id: ach.apiName,
          name: ach.name,
          description: ach.description,
          icon: ach.icon,
        })),
        String(resolvedAppId),
      );
    } catch {
      /* ignore */
    }
  }

  let mergedAchievements = result.achievements || [];

  if (mergedAchievements.length === 0) {
    const memoryCached = getCachedSteamAchievementDetails(
      options.steamId || "",
      resolvedAppId,
      language,
    );
    if (memoryCached?.achievements.length) {
      mergedAchievements = memoryCached.achievements;
    }
  }

  const progressKeys = buildProgressKeys(game, resolvedAppId, localSteamAppId);
  const gameDir = game.executablePath
    ? game.executablePath.replace(/[/\\][^/\\]+$/, "")
    : undefined;

  if (mergedAchievements.length === 0 && localDefs?.length) {
    const { localProgress, retroactiveState } = await readLocalProgress(progressKeys, gameDir);
    mergedAchievements = mergeDefsWithLocalProgress(localDefs, localProgress, retroactiveState);
  }

  if (game.launcherType === "local") {
    const { localProgress, retroactiveState } = await readLocalProgress(progressKeys, gameDir);
    const savedAchievements: Record<string, { unlockedAt?: string }> =
      localProgress?.unlockedAchievements ?? {};
    const progressById = new Map(
      Object.entries(savedAchievements).map(([id, value]) => [id.toLowerCase(), value]),
    );

    if (mergedAchievements.length > 0) {
      mergedAchievements = mergedAchievements.map((achievement) => {
        const saved = progressById.get(achievement.apiName.toLowerCase());
        const emu = retroactiveState[achievement.apiName]
          || retroactiveState[achievement.apiName.toLowerCase()];
        const prevLocal = localDefs?.find((def) =>
          def.id.toLowerCase() === achievement.apiName.toLowerCase());
        const achieved = Boolean(saved || emu?.earned || (prevLocal as any)?.achieved);
        const unlockTime = saved?.unlockedAt
          ? Math.floor(Date.parse(saved.unlockedAt) / 1000)
          : emu?.earnedTime || (prevLocal as any)?.unlockTime || 0;
        return {
          ...achievement,
          achieved,
          unlockTime: achieved ? (unlockTime || Math.floor(Date.now() / 1000)) : 0,
        };
      });
    } else if (localDefs?.length) {
      mergedAchievements = localDefs.map((def) => {
        const saved = progressById.get(def.id.toLowerCase());
        const emu = retroactiveState[def.id] || retroactiveState[def.id.toLowerCase()];
        const achieved = Boolean(saved || emu?.earned);
        const unlockTime = saved?.unlockedAt
          ? Math.floor(Date.parse(saved.unlockedAt) / 1000)
          : emu?.earnedTime || 0;
        return {
          apiName: def.id,
          name: def.name,
          description: def.description,
          icon: def.icon,
          iconGray: "",
          hidden: false,
          achieved,
          unlockTime: achieved ? (unlockTime || Math.floor(Date.now() / 1000)) : 0,
          percent: 0,
        };
      });
    }
  }

  if (mergedAchievements.length > 0) {
    setCachedSteamAchievementDetails(
      options.steamId || "",
      resolvedAppId,
      {
        achievements: mergedAchievements,
        total: mergedAchievements.length,
        unlocked: mergedAchievements.filter((item) => item.achieved).length,
      },
      language,
    );
  }

  const unlockedCount = mergedAchievements.filter((item) => item.achieved).length;
  const finalUnlockedCount = (
    unlockedCount === 0
    && (game.completedAchievements || 0) > 0
  )
    ? game.completedAchievements
    : unlockedCount;

  return {
    items: mergedAchievements,
    sourceAppId: resolvedAppId,
    error: null,
    libraryPatch: mergedAchievements.length > 0 || !game.totalAchievements
      ? {
        totalAchievements: mergedAchievements.length || game.totalAchievements || 0,
        completedAchievements: finalUnlockedCount || 0,
      }
      : undefined,
  };
}

/** Shared loader used by GameDetailPanel and in-game overlay. */
export async function loadGameAchievements(
  game: Game,
  options: LoadGameAchievementsOptions = {},
  callbacks: LoadGameAchievementsCallbacks = {},
): Promise<GameAchievementsResult> {
  const language = options.language || "pt-BR";
  let resolvedAppId = String(game.steamAppId || "").trim();

  const cached = resolvedAppId
    ? getCachedSteamAchievementDetails(options.steamId || "", resolvedAppId, language)
    : null;

  if (cached?.achievements.length) {
    callbacks.onCached?.({
      items: cached.achievements,
      sourceAppId: resolvedAppId,
    });
  }

  const { localDefs, localSteamAppId } = await readLocalAchievementDefinitions(game);

  if (localDefs?.length && (!cached || cached.achievements.length === 0)) {
    const progressKeys = buildProgressKeys(game, resolvedAppId, localSteamAppId);
    const gameDir = game.executablePath
      ? game.executablePath.replace(/[/\\][^/\\]+$/, "")
      : undefined;
    const { localProgress, retroactiveState } = await readLocalProgress(progressKeys, gameDir);
    const merged = mergeDefsWithLocalProgress(localDefs, localProgress, retroactiveState);
    callbacks.onLocal?.({
      items: merged,
      sourceAppId: localSteamAppId || resolvedAppId,
    });
  } else if (!cached?.achievements.length) {
    callbacks.onLoadingRemote?.();
  }

  try {
    const isEpicGame = game.launcherType === "epic"
      || Boolean(game.epicCatalogId || game.epicLaunchId);

    if (isEpicGame) {
      const epicResult = await loadEpicAchievements(game);
      if (epicResult) return epicResult;

      const progressKeys = buildProgressKeys(game, resolvedAppId, localSteamAppId);
      const gameDir = game.executablePath
        ? game.executablePath.replace(/[/\\][^/\\]+$/, "")
        : undefined;
      const { localProgress, retroactiveState } = await readLocalProgress(progressKeys, gameDir);
      const localItems = localDefs?.length
        ? mergeDefsWithLocalProgress(localDefs, localProgress, retroactiveState)
        : [];

      return {
        items: localItems,
        sourceAppId: "epic-online",
        error: null,
        libraryPatch: {
          totalAchievements: localItems.length || game.totalAchievements || 0,
          completedAchievements: localItems.length
            ? localItems.filter((item) => item.achieved).length
            : (game.completedAchievements || 0),
        },
      };
    }

    return await loadSteamAchievements(game, { ...options, language }, localDefs, localSteamAppId);
  } catch (error: any) {
    return {
      items: cached?.achievements || [],
      sourceAppId: resolvedAppId || localSteamAppId,
      error: !localDefs && !cached?.achievements.length
        ? (error?.message || "Falha ao buscar conquistas. Verifique sua conexão e tente novamente.")
        : null,
    };
  }
}

export function achievementUnlockBelongsToGame(
  game: Game,
  payload: Pick<AchievementUnlockPayload, "gameId">,
): boolean {
  const payloadSteamAppId = String(payload.gameId || "").match(/^steam_(\d+)$/i)?.[1];
  return (
    String(game.id) === String(payload.gameId)
    || (payloadSteamAppId && String(game.steamAppId || "") === payloadSteamAppId)
    || String(game.steamAppId || "") === String(payload.gameId)
  );
}

export function patchGameAchievementUnlock(
  items: SteamAchievement[],
  payload: Pick<AchievementUnlockPayload, "achievementId" | "earnedTime" | "unlockedAt">,
): { items: SteamAchievement[]; changed: boolean } {
  const targetId = payload.achievementId.toLowerCase();
  let changed = false;
  const next = items.map((achievement) => {
    if (achievement.apiName.toLowerCase() !== targetId || achievement.achieved) {
      return achievement;
    }
    changed = true;
    const unlockTime = payload.earnedTime && payload.earnedTime > 0
      ? payload.earnedTime
      : payload.unlockedAt
        ? Math.floor(Date.parse(payload.unlockedAt) / 1000)
        : Math.floor(Date.now() / 1000);
    return { ...achievement, achieved: true, unlockTime };
  });
  return { items: next, changed };
}
