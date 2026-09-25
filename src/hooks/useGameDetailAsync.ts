import React from "react";
import type { Game, GameLaunchProfile } from "../types/domain";
import type { SteamAchievement, SteamAppDetails } from "../services/steam";
import type { EpicAppDetails } from "../services/epic";
import type { DisplayOption, GamePanelMod } from "../types/gameDetail";
import type { LauncherLanguage } from "../context/PreferencesContext";
import {
  fetchSteamAchievementDetails,
  fetchSteamAchievementSchema,
  fetchSteamAppDetailsResult,
  getCachedSteamAchievementDetails,
  setCachedSteamAchievementDetails,
  searchSteamGames,
} from "../services/steam";
import { fetchEpicAppDetailsResult, fetchEpicAchievements } from "../services/epic";
import { updateLibraryGame } from "../services/localLibrary";
import {
  getAchievementTierIndex as getUnifiedTierIndex,
  getPlatinaCandidateApiName,
  getRarestAchievementApiName,
  isPlatinaByText,
} from "../utils/trophyTiers";
import { markHubAchievement, incrementHubCount } from "../utils/hubTrophies";
import { normalizeSteamLookup } from "../types/gameDetail";

interface UseGameDetailAsyncProps {
  game: Game | null;
  isOpen: boolean;
  language: LauncherLanguage;
  user: { uid: string } | null;
  userProfile: { steamId?: string } | null;
  onGameHydrated?: (game: Game) => void;
  onLibraryChanged?: () => Promise<void> | void;
}

export function useGameDetailAsync({
  game,
  isOpen,
  language,
  user,
  userProfile,
  onGameHydrated,
  onLibraryChanged,
}: UseGameDetailAsyncProps) {
  const [steamAppDetails, setSteamAppDetails] = React.useState<SteamAppDetails | null>(null);
  const [isSteamAppDetailsLoading, setIsSteamAppDetailsLoading] = React.useState(false);

  const [epicAppDetails, setEpicAppDetails] = React.useState<EpicAppDetails | null>(null);
  const [isEpicAppDetailsLoading, setIsEpicAppDetailsLoading] = React.useState(false);

  const [achievementItems, setAchievementItems] = React.useState<SteamAchievement[]>([]);
  const [achievementSourceAppId, setAchievementSourceAppId] = React.useState<string>("");
  const [isAchievementsLoading, setIsAchievementsLoading] = React.useState(false);
  const [achievementsError, setAchievementsError] = React.useState<string | null>(null);

  const [localScreenshots, setLocalScreenshots] = React.useState<string[]>([]);
  const [gameMods, setGameMods] = React.useState<GamePanelMod[]>([]);
  const [launchProfile, setLaunchProfile] = React.useState<GameLaunchProfile>({});
  const [displayOptions, setDisplayOptions] = React.useState<DisplayOption[]>([]);
  const [isRunning, setIsRunning] = React.useState(false);
  const [refetchKey, setRefetchKey] = React.useState(0);

  const prevAchievedRef = React.useRef<Map<string, number>>(new Map());
  const onGameHydratedRef = React.useRef(onGameHydrated);
  onGameHydratedRef.current = onGameHydrated;
  const onLibraryChangedRef = React.useRef(onLibraryChanged);
  onLibraryChangedRef.current = onLibraryChanged;

  const isSteamGame = Boolean(
    game?.launcherType === "steam" ||
    game?.source === "steam" ||
    (game?.steamAppId && game.steamAppId !== "0" && game.launcherType !== "epic"),
  );

  const isEpicGame = Boolean(
    (game?.launcherType === "epic" ||
      game?.source === "epic" ||
      game?.epicCatalogId ||
      game?.epicLaunchId) && !isSteamGame,
  );

  const retryAchievements = React.useCallback(() => {
    setRefetchKey((prev) => prev + 1);
  }, []);

  // Monitoramento de jogo em execução
  React.useEffect(() => {
    if (!isOpen || !game?.executablePath) {
      setIsRunning(false);
      return;
    }
    const checkRunning = async () => {
      try {
        const running = await window.electronAPI?.isExecutableRunning(game.executablePath!);
        setIsRunning(Boolean(running));
      } catch {
        setIsRunning(false);
      }
    };
    void checkRunning();
    const interval = setInterval(checkRunning, 5000);
    return () => clearInterval(interval);
  }, [isOpen, game?.executablePath]);

  // Limpeza de estado ao trocar de jogo
  React.useEffect(() => {
    setSteamAppDetails(null);
    setEpicAppDetails(null);
    setAchievementItems([]);
    setAchievementSourceAppId("");
    setAchievementsError(null);
    prevAchievedRef.current = new Map();
  }, [game?.id, isOpen]);

  // Fetch Steam App Details
  React.useEffect(() => {
    if (!isOpen || !game?.id || !isSteamGame) {
      setSteamAppDetails(null);
      setIsSteamAppDetailsLoading(false);
      return;
    }
    let cancelled = false;

    const fetchDetails = async () => {
      let resolvedAppId = game.steamAppId;
      if (!resolvedAppId && game.launcherType === "steam") {
        const results = await searchSteamGames(game.title);
        const normalizedTitle = normalizeSteamLookup(game.title);
        const matched = results.find((candidate) => {
          const rawName = typeof candidate.name === "string" ? candidate.name : (typeof candidate.title === "string" ? candidate.title : "");
          return normalizeSteamLookup(rawName) === normalizedTitle;
        });
        if (matched && matched.id != null) {
          resolvedAppId = String(matched.id).trim();
        }
      }

      if (!resolvedAppId) {
        setSteamAppDetails(null);
        return;
      }

      setIsSteamAppDetailsLoading(true);
      const result = await fetchSteamAppDetailsResult(resolvedAppId, language);
      if (cancelled) return;
      if (result.ok && result.data) {
        setSteamAppDetails(result.data);
      } else {
        setSteamAppDetails(null);
      }
      setIsSteamAppDetailsLoading(false);
    };

    void fetchDetails();
    return () => { cancelled = true; };
  }, [isOpen, game?.id, game?.steamAppId, game?.title, game?.launcherType, isSteamGame, language]);

  // Fetch Epic Store Details
  React.useEffect(() => {
    if (!isOpen || !game?.id || !isEpicGame || (!game.epicCatalogId && !game.title && !game.epicLaunchId && !game.productSlug)) {
      setEpicAppDetails(null);
      setIsEpicAppDetailsLoading(false);
      return;
    }
    let cancelled = false;

    const fetchDetails = async () => {
      setIsEpicAppDetailsLoading(true);
      try {
        const parts = decodeURIComponent(game.epicCatalogId || "").split(":");
        const namespace = game.epicCatalogId?.includes(":") ? parts[0] : "";
        const itemId = parts.length >= 2 ? parts[1] : game.epicCatalogId;

        const result = await fetchEpicAppDetailsResult(
          itemId || game.epicCatalogId || "",
          namespace || undefined,
          game.productSlug || undefined,
          language,
          game.title,
          game.epicLaunchId,
        );
        if (cancelled) return;
        if (result.ok && result.data) {
          const d = result.data;
          if (game.title && d.title) {
            const normGame = game.title.toLowerCase().replace(/[^a-z0-9]/g, "");
            const normResult = d.title.toLowerCase().replace(/[^a-z0-9]/g, "");
            const isMatch =
              normGame === normResult ||
              (normGame.length >= 3 && normResult.length >= 3 && (
                normGame.startsWith(normResult) ||
                normResult.startsWith(normGame) ||
                normResult.includes(normGame) ||
                normGame.includes(normResult)
              )) ||
              Boolean(d.catalogId && game.epicCatalogId && d.catalogId.toLowerCase() === game.epicCatalogId.toLowerCase()) ||
              Boolean(d.productSlug && game.productSlug && d.productSlug.toLowerCase() === game.productSlug.toLowerCase());
            if (!isMatch) {
              if (!cancelled) setIsEpicAppDetailsLoading(false);
              return;
            }
          }
          setEpicAppDetails(d);
          const enrichedGame: Game = {
            ...game,
            title: d.title || game.title,
            cardImage: d.cardImage || game.cardImage,
            backgroundImage: d.backgroundImage || game.backgroundImage,
            logoImage: d.logoImage || game.logoImage,
            description: d.description || game.description,
            aboutTheGame: d.aboutTheGame || game.aboutTheGame,
            screenshots: d.screenshots?.length ? d.screenshots : game.screenshots,
            trailerUrl: d.trailerUrl || game.trailerUrl,
            trailerThumbnail: d.trailerThumbnail || game.trailerThumbnail,
            developer: d.developer || game.developer,
            publisher: d.publisher || game.publisher,
            tags: d.tags?.length ? d.tags : game.tags,
            releaseDate: d.releaseDate || game.releaseDate,
            productSlug: d.productSlug || game.productSlug,
          };
          if (user?.uid) {
            void updateLibraryGame(user.uid, game.id, {
              title: enrichedGame.title,
              cardImage: enrichedGame.cardImage,
              backgroundImage: enrichedGame.backgroundImage,
              logoImage: enrichedGame.logoImage,
              description: enrichedGame.description,
              aboutTheGame: enrichedGame.aboutTheGame,
              screenshots: enrichedGame.screenshots,
              trailerUrl: enrichedGame.trailerUrl,
              trailerThumbnail: enrichedGame.trailerThumbnail,
              developer: enrichedGame.developer,
              publisher: enrichedGame.publisher,
              tags: enrichedGame.tags,
              releaseDate: enrichedGame.releaseDate,
              productSlug: enrichedGame.productSlug,
              updatedAt: new Date().toISOString(),
            }).then(() => onLibraryChangedRef.current?.()).catch(() => { });
          }
          if (onGameHydratedRef.current) {
            onGameHydratedRef.current(enrichedGame);
          }
        }
      } catch (err) {
        console.warn("[GameDetailPanel] Falha ao buscar detalhes da Epic:", err);
      }
      if (!cancelled) setIsEpicAppDetailsLoading(false);
    };

    void fetchDetails();
    return () => { cancelled = true; };
  }, [isOpen, game?.id, game?.epicCatalogId, game?.title, game?.epicLaunchId, game?.productSlug, isEpicGame, language, user?.uid]);

  // Carregamento de Conquistas (Steam / Epic / Local)
  React.useEffect(() => {
    let cancelled = false;

    const loadAchievements = async () => {
      if (!isOpen || !game?.id) {
        setAchievementItems([]);
        setIsAchievementsLoading(false);
        return;
      }

      setAchievementsError(null);
      let resolvedAppId = String(game.steamAppId || "").trim();

      // FASE 1: Cache em memória instantâneo
      const cached = resolvedAppId
        ? getCachedSteamAchievementDetails(userProfile?.steamId || "", resolvedAppId, language)
        : null;

      if (cached && cached.achievements.length > 0) {
        setAchievementSourceAppId(resolvedAppId);
        setAchievementItems(cached.achievements);
        setIsAchievementsLoading(false);
      }

      // FASE 2: Dados locais no disco (~1ms)
      let localDefs: Array<{ id: string; name: string; description: string; icon: string }> | null = null;
      let localSteamAppId = "";
      try {
        if (window.electronAPI?.getLocalAchievementDefinitions) {
          const raw = await window.electronAPI.getLocalAchievementDefinitions(game.id);
          if (raw && (raw as any).achievements?.length > 0) {
            localDefs = (raw as any).achievements;
            localSteamAppId = (raw as any).steamAppId || "";
          }
        }
      } catch { /* ignore */ }

      if (cancelled) return;

      if (localDefs && localDefs.length > 0 && (!cached || cached.achievements.length === 0)) {
        const progressKeys: string[] = Array.from(new Set([
          game.id,
          localSteamAppId ? `steam_${localSteamAppId}` : "",
          localSteamAppId,
          resolvedAppId ? `steam_${resolvedAppId}` : "",
          resolvedAppId,
          game.steamAppId ? `steam_${game.steamAppId}` : "",
          game.steamAppId,
        ])).filter(Boolean) as string[];
        let localProgress: { unlockedAchievements?: Record<string, { unlockedAt?: string }> } | null = null;
        if (window.electronAPI?.getLocalAchievementProgress) {
          for (const key of progressKeys) {
            try {
              const p = await window.electronAPI.getLocalAchievementProgress(key);
              if (p?.unlockedAchievements && Object.keys(p.unlockedAchievements).length > 0) {
                localProgress = p;
                break;
              }
            } catch { /* ignore */ }
          }
        }

        let retroactiveState: Record<string, { earned?: boolean; earnedTime?: number }> = {};
        if (window.electronAPI?.getLocalAchievementState) {
          for (const key of progressKeys) {
            try {
              const state = await window.electronAPI.getLocalAchievementState(key);
              if (state && Object.keys(state).length > 0) {
                retroactiveState = state;
                break;
              }
            } catch { /* ignore */ }
          }
        }

        if (cancelled) return;

        const merged = localDefs.map((def) => {
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
            achieved,
            unlockTime,
            percent: 0,
          } as SteamAchievement;
        });

        setAchievementSourceAppId(localSteamAppId || resolvedAppId);
        setAchievementItems(merged);
        setIsAchievementsLoading(false);
      } else if (!cached || cached.achievements.length === 0) {
        setIsAchievementsLoading(true);
      }

      // FASE 3: Background sync
      try {
        if (game.launcherType === "epic") {
          let onlineAchievements: any = null;
          const appName = game.epicLaunchId ||
            (game.epicCatalogId && game.epicCatalogId.includes(":")
              ? game.epicCatalogId.split(":")[1]
              : game.epicCatalogId) ||
            game.title;
          const sandboxId = game.epicNamespace || (game.epicCatalogId && game.epicCatalogId.includes(":") ? game.epicCatalogId.split(":")[0] : undefined);

          try {
            const achRes = await fetchEpicAchievements(sandboxId, appName);
            if (achRes.list && achRes.list.length > 0) {
              onlineAchievements = achRes;
            }
          } catch { /* ignore */ }

          if (cancelled) return;

          if (onlineAchievements && onlineAchievements.list.length > 0) {
            setAchievementSourceAppId("epic-online");
            setAchievementItems(onlineAchievements.list);
            setIsAchievementsLoading(false);
            if (user?.uid) {
              void updateLibraryGame(user.uid, game.id, {
                totalAchievements: onlineAchievements.total,
                completedAchievements: onlineAchievements.completed,
                achievementsUpdatedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              }).catch(() => { }).then(() => onLibraryChanged?.());
            }
            return;
          }

          if (window.electronAPI?.getEpicLocalAchievements) {
            const catalogItemId = game.epicCatalogId?.includes(":") ? game.epicCatalogId.split(":")[1] : game.epicCatalogId;
            const fullLaunchId = (game.epicNamespace && game.epicCatalogId && game.epicLaunchId)
              ? `${game.epicNamespace}:${catalogItemId}:${game.epicLaunchId}`
              : game.epicLaunchId;

            const localResult = await window.electronAPI.getEpicLocalAchievements({
              gameId: catalogItemId || game.id,
              title: game.title,
              epicCatalogId: catalogItemId || game.epicCatalogId,
              epicLaunchId: fullLaunchId || game.epicLaunchId,
              executablePath: game.executablePath,
            });
            if (cancelled) return;
            if (localResult.achievements && localResult.achievements.length > 0) {
              setAchievementSourceAppId("epic-local");
              setAchievementItems(
                localResult.achievements.map((a: any) => ({
                  ...a,
                  percent: a.percent ?? 0,
                })),
              );
              setIsAchievementsLoading(false);
              if (user?.uid) {
                void updateLibraryGame(user.uid, game.id, {
                  totalAchievements: localResult.total,
                  completedAchievements: localResult.unlocked,
                  achievementsUpdatedAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                }).catch(() => { }).then(() => onLibraryChanged?.());
              }
              return;
            }
          }

          setAchievementSourceAppId("epic-online");
          if (!localDefs) {
            setAchievementsError("Nenhuma conquista encontrada.");
          }
          return;
        }

        if (!resolvedAppId) {
          const results = await searchSteamGames(game.title);
          const normalizedTitle = normalizeSteamLookup(game.title);
          const matched = results.find((candidate) => {
            const rawName = typeof candidate.name === "string" ? candidate.name : typeof candidate.title === "string" ? candidate.title : "";
            return normalizeSteamLookup(rawName) === normalizedTitle;
          });
          if (matched && matched.id != null) {
            resolvedAppId = String(matched.id).trim();
          }
        }

        if (!resolvedAppId) {
          if (localDefs) {
            setIsAchievementsLoading(false);
            return;
          }
          setAchievementsError("Este jogo não possui Steam App ID.");
          setIsAchievementsLoading(false);
          return;
        }

        let result = game.launcherType === "local"
          ? await fetchSteamAchievementSchema(resolvedAppId, language)
          : userProfile?.steamId
            ? await fetchSteamAchievementDetails(userProfile.steamId, resolvedAppId, language)
            : await fetchSteamAchievementSchema(resolvedAppId, language);

        if (cancelled) return;

        if (result.achievements && result.achievements.length > 0 && window.electronAPI?.saveLocalAchievementDefinitions) {
          try {
            await window.electronAPI.saveLocalAchievementDefinitions(
              game.id,
              result.achievements.map((ach) => ({
                id: ach.apiName,
                name: ach.name,
                description: ach.description,
                icon: ach.icon,
              })),
              String(resolvedAppId)
            );
          } catch { /* ignore */ }
        }

        setAchievementSourceAppId(resolvedAppId);
        let mergedAchievements = result.achievements;

        if (game.launcherType === "local") {
          const progressKeys: string[] = Array.from(new Set([
            game.id,
            localSteamAppId ? `steam_${localSteamAppId}` : "",
            localSteamAppId,
            resolvedAppId ? `steam_${resolvedAppId}` : "",
            resolvedAppId,
            game.steamAppId ? `steam_${game.steamAppId}` : "",
            game.steamAppId,
          ])).filter(Boolean) as string[];

          let localProgress: { unlockedAchievements?: Record<string, { unlockedAt?: string }> } | null = null;
          if (window.electronAPI?.getLocalAchievementProgress) {
            for (const key of progressKeys) {
              try {
                const p = await window.electronAPI.getLocalAchievementProgress(key);
                if (p?.unlockedAchievements && Object.keys(p.unlockedAchievements).length > 0) {
                  localProgress = p;
                  break;
                }
              } catch { /* ignore */ }
            }
          }

          let retroactiveState: Record<string, { earned?: boolean; earnedTime?: number }> = {};
          if (window.electronAPI?.getLocalAchievementState) {
            for (const key of progressKeys) {
              try {
                const state = await window.electronAPI.getLocalAchievementState(key);
                if (state && Object.keys(state).length > 0) {
                  retroactiveState = state;
                  break;
                }
              } catch { /* ignore */ }
            }
          }

          const savedAchievements: Record<string, { unlockedAt?: string }> =
            localProgress?.unlockedAchievements ?? {};
          const progressById = new Map(
            Object.entries(savedAchievements).map(([id, value]) => [
              id.toLowerCase(),
              value,
            ]),
          );

          if (mergedAchievements.length > 0) {
            mergedAchievements = mergedAchievements.map((achievement) => {
              const saved = progressById.get(achievement.apiName.toLowerCase());
              const emu = retroactiveState[achievement.apiName] || retroactiveState[achievement.apiName.toLowerCase()];
              const prevLocal = localDefs?.find((d) => d.id.toLowerCase() === achievement.apiName.toLowerCase());
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
          } else if (localDefs && localDefs.length > 0) {
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
                achieved,
                unlockTime: achieved ? (unlockTime || Math.floor(Date.now() / 1000)) : 0,
                percent: 0,
              } as SteamAchievement;
            });
          }
        }

        if (mergedAchievements.length > 0) {
          setAchievementItems(mergedAchievements);
          setCachedSteamAchievementDetails(
            userProfile?.steamId || "",
            resolvedAppId,
            { achievements: mergedAchievements, total: mergedAchievements.length, unlocked: mergedAchievements.filter(a => a.achieved).length },
            language,
          );
        }

        if (user?.uid && (mergedAchievements.length > 0 || !game.totalAchievements)) {
          const unlockedCount = mergedAchievements.filter((a) => a.achieved).length;
          const finalUnlockedCount = (unlockedCount === 0 && (game.completedAchievements || 0) > 0 && game.launcherType === "local")
            ? game.completedAchievements
            : unlockedCount;
          const newTotal = mergedAchievements.length || game.totalAchievements || 0;

          const hasChanged =
            game.totalAchievements !== newTotal ||
            game.completedAchievements !== finalUnlockedCount;

          if (hasChanged) {
            void updateLibraryGame(user.uid, game.id, {
              totalAchievements: newTotal,
              completedAchievements: finalUnlockedCount,
              achievementsUpdatedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }).catch(() => { }).then(() => onLibraryChangedRef.current?.());

            if (onGameHydratedRef.current) {
              onGameHydratedRef.current({
                ...game,
                totalAchievements: newTotal,
                completedAchievements: finalUnlockedCount,
              });
            }
          }
        }

        if (result.achievements.length === 0 && !localDefs) {
          setAchievementsError(
            !userProfile?.steamId && game.launcherType !== "local"
              ? "Conecte sua conta Steam para carregar conquistas."
              : "Nenhuma conquista encontrada."
          );
        }
      } catch {
        if (!cancelled && !localDefs && (!cached || cached.achievements.length === 0)) {
          setAchievementsError("Nenhuma conquista encontrada.");
        }
      } finally {
        if (!cancelled) {
          setIsAchievementsLoading(false);
        }
      }
    };

    void loadAchievements();
    return () => { cancelled = true; };
  }, [game?.id, game?.launcherType, game?.steamAppId, game?.title, isOpen, language, refetchKey, user?.uid, userProfile?.steamId]);

  // Realtime Achievement Unlock Listener
  React.useEffect(() => {
    if (!game?.id) return;
    if (!window.electronAPI?.onRealtimeAchievementUnlock) return;

    const handler = window.electronAPI.onRealtimeAchievementUnlock((payload) => {
      const { achievementId, earnedTime, unlockedAt } = payload;
      const payloadSteamAppId = payload.gameId.match(/^steam_(\d+)$/i)?.[1];
      const belongsToCurrentGame =
        String(game.id) === String(payload.gameId) ||
        (payloadSteamAppId && String(game.steamAppId || "") === payloadSteamAppId) ||
        String(game.steamAppId || "") === String(payload.gameId);
      if (!belongsToCurrentGame) return;

      setAchievementItems((prev) => {
        let changed = false;
        const next = prev.map((ach) => {
          const isMatch = ach.apiName.toLowerCase() === achievementId.toLowerCase();
          if (!isMatch || ach.achieved) return ach;
          changed = true;
          if (user?.uid) {
            try {
              markHubAchievement(user.uid, game.id, ach.apiName);
              const isPlatina = isPlatinaByText(ach as any);
              const isRarest = ach.apiName === getRarestAchievementApiName(prev as any) || ach.apiName === getPlatinaCandidateApiName(prev as any);
              const tierIdx = getUnifiedTierIndex(ach as any, prev.length, { isRarest: Boolean(isRarest), isPlatinaText: Boolean(isPlatina) });
              incrementHubCount(user.uid, game.id, tierIdx);
            } catch { /* ignore */ }
          }
          const unixSecs = earnedTime > 0 ? earnedTime : Math.floor(new Date(unlockedAt).getTime() / 1000);
          return { ...ach, achieved: true, unlockTime: unixSecs };
        });

        if (changed && user?.uid) {
          void updateLibraryGame(user.uid, game.id, {
            totalAchievements: next.length,
            completedAchievements: next.filter((a) => a.achieved).length,
            updatedAt: new Date().toISOString(),
          }).then(() => onLibraryChanged?.()).catch(() => { });
        }
        return next;
      });
    });

    return () => window.electronAPI?.removeRealtimeAchievementUnlock?.(handler);
  }, [game?.id, game?.steamAppId, onLibraryChanged, user?.uid]);

  // Carregar screenshots locais
  React.useEffect(() => {
    if (isOpen && game?.id) {
      window.electronAPI?.getLocalGameScreenshots?.({
        title: game.title,
        launcherType: game.launcherType,
        steamAppId: game.steamAppId,
      }).then((paths) => {
        setLocalScreenshots(paths || []);
      }).catch(() => { });
    }
  }, [isOpen, game?.id, game?.launcherType, game?.steamAppId, game?.title]);

  // Carregar profile de launch e opções de monitor
  React.useEffect(() => {
    if (isOpen && game) {
      setLaunchProfile(game.launchProfile || {});
      (window.electronAPI as any)?.getDisplayOptions?.().then((displays: any) => {
        if (Array.isArray(displays)) {
          setDisplayOptions(displays as DisplayOption[]);
        }
      }).catch(() => { });
    }
  }, [isOpen, game]);

  return {
    steamDetails: {
      data: steamAppDetails,
      loading: isSteamAppDetailsLoading,
      error: null,
      retry: () => {},
    },
    epicDetails: {
      data: epicAppDetails,
      loading: isEpicAppDetailsLoading,
      error: null,
      retry: () => {},
    },
    achievements: {
      data: achievementItems,
      loading: isAchievementsLoading,
      error: achievementsError,
      sourceAppId: achievementSourceAppId,
      retry: retryAchievements,
    },
    localScreenshots,
    gameMods,
    launchProfile,
    setLaunchProfile,
    displayOptions,
    isRunning,
    isSteamGame,
    isEpicGame,
  };
}
