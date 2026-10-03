import React from "react";
import type { Game, GameLaunchProfile } from "../types/domain";
import type { SteamAchievement, SteamAppDetails } from "../services/steam";
import type { EpicAppDetails } from "../services/epic";
import type { DisplayOption, GamePanelMod } from "../types/gameDetail";
import type { LauncherLanguage } from "../context/PreferencesContext";
import {
  fetchSteamAppDetailsResult,
  searchSteamGames,
} from "../services/steam";
import { fetchEpicAppDetailsResult } from "../services/epic";
import {
  achievementUnlockBelongsToGame,
  loadGameAchievements,
  patchGameAchievementUnlock,
} from "../services/gameAchievements";
import { epicStoreDetailsMatch } from "../utils/epicDetailsMatch";
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
  currentPresenceGame?: string | null;
}

export function useGameDetailAsync({
  game,
  isOpen,
  language,
  user,
  userProfile,
  onGameHydrated,
  onLibraryChanged,
  currentPresenceGame,
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
    if (!isOpen || !game) {
      setIsRunning(false);
      return;
    }
    const checkRunning = async () => {
      try {
        if (game.executablePath) {
          const running = await window.electronAPI?.isExecutableRunning(game.executablePath);
          if (running) {
            setIsRunning(true);
            return;
          }
        }
        if (
          currentPresenceGame &&
          game.title &&
          (currentPresenceGame.trim().toLowerCase() === game.title.trim().toLowerCase() ||
            currentPresenceGame.toLowerCase().includes(game.title.toLowerCase()) ||
            game.title.toLowerCase().includes(currentPresenceGame.toLowerCase()))
        ) {
          setIsRunning(true);
          return;
        }
        setIsRunning(false);
      } catch {
        setIsRunning(false);
      }
    };
    void checkRunning();
    const interval = setInterval(checkRunning, 5000);
    return () => clearInterval(interval);
  }, [isOpen, game?.executablePath, game?.title, currentPresenceGame]);

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
          const isMatch = epicStoreDetailsMatch({
            expectedTitle: game.title,
            expectedCatalogId: game.epicCatalogId,
            expectedLaunchId: game.epicLaunchId,
            expectedProductSlug: game.productSlug,
            resultTitle: d.title,
            resultCatalogId: d.catalogId,
            resultProductSlug: d.productSlug,
            resultAppName: d.epicLaunchId || game.epicLaunchId,
          });
          if (!isMatch) {
            if (!cancelled) setIsEpicAppDetailsLoading(false);
            return;
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

      try {
        const result = await loadGameAchievements(
          game,
          {
            language,
            steamId: userProfile?.steamId,
            bypassSteamCache: refetchKey > 0,
            persistLibrary: Boolean(user?.uid),
            userUid: user?.uid,
          },
          {
            onCached: (phase) => {
              if (cancelled) return;
              setAchievementSourceAppId(phase.sourceAppId);
              setAchievementItems(phase.items);
              setIsAchievementsLoading(false);
            },
            onLocal: (phase) => {
              if (cancelled) return;
              setAchievementSourceAppId(phase.sourceAppId);
              setAchievementItems(phase.items);
              setIsAchievementsLoading(false);
            },
            onLoadingRemote: () => {
              if (!cancelled) setIsAchievementsLoading(true);
            },
          },
        );

        if (cancelled) return;

        if (result.items.length > 0) {
          setAchievementSourceAppId(result.sourceAppId);
          setAchievementItems(result.items);
        }
        setAchievementsError(result.error);

        if (user?.uid && result.libraryPatch) {
          const { totalAchievements, completedAchievements } = result.libraryPatch;
          const hasChanged =
            game.totalAchievements !== totalAchievements
            || game.completedAchievements !== completedAchievements;

          if (hasChanged) {
            void updateLibraryGame(user.uid, game.id, {
              totalAchievements,
              completedAchievements,
              achievementsUpdatedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }).catch(() => { }).then(() => onLibraryChangedRef.current?.());

            if (onGameHydratedRef.current) {
              onGameHydratedRef.current({
                ...game,
                totalAchievements,
                completedAchievements,
              });
            }
          }
        }
      } catch {
        if (!cancelled) {
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
      if (!achievementUnlockBelongsToGame(game, payload)) return;

      setAchievementItems((prev) => {
        const { items: next, changed } = patchGameAchievementUnlock(prev, payload);
        if (!changed) return prev;

        const unlocked = next.find((ach) =>
          ach.apiName.toLowerCase() === payload.achievementId.toLowerCase());
        if (user?.uid && unlocked) {
          try {
            markHubAchievement(user.uid, game.id, unlocked.apiName);
            const isPlatina = isPlatinaByText(unlocked as any);
            const isRarest = unlocked.apiName === getRarestAchievementApiName(prev as any)
              || unlocked.apiName === getPlatinaCandidateApiName(prev as any);
            const tierIdx = getUnifiedTierIndex(unlocked as any, prev.length, {
              isRarest: Boolean(isRarest),
              isPlatinaText: Boolean(isPlatina),
            });
            incrementHubCount(user.uid, game.id, tierIdx);
          } catch { /* ignore */ }
        }

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
