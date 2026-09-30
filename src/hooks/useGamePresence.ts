import { useState, useCallback, useEffect, useRef } from "react";
import { useInterval } from "./useInterval";
import type { Game, UserProfile } from "../types/domain";
import { getMonitorableExecutablePath } from "../services/launcher";
import { fetchSteamAchievementDetails, fetchSteamCurrentGame } from "../services/steam";
import { fetchEpicAchievements } from "../services/epic";
import {
  recordLibrarySession,
  updateLibraryGame,
} from "../services/localLibrary";

interface UseGamePresenceProps {
  userUid?: string;
  userProfile?: UserProfile | null;
  games: Game[];
  onLibraryChanged?: () => Promise<void> | void;
}

export const UNVERIFIED_URI_PRESENCE_TTL_MS = 12 * 60 * 60 * 1000;
export type PresenceVerificationMode = "none" | "provisional" | "process" | "steam";

async function ensureSteamInstalledMap(
  mapRef: React.MutableRefObject<Map<string, string>>,
): Promise<Map<string, string>> {
  if (mapRef.current.size > 0 || !window.electronAPI?.scanInstalledSteamGames) {
    return mapRef.current;
  }
  try {
    const localSteam = await window.electronAPI.scanInstalledSteamGames();
    if (Array.isArray(localSteam)) {
      for (const item of localSteam) {
        if (item.appid && item.executablePath) {
          mapRef.current.set(String(item.appid), item.executablePath);
        }
      }
    }
  } catch {
    // scan falhou ou nao suportado
  }
  return mapRef.current;
}

function resolveMonitorablePathForGame(
  game: Game | null | undefined,
  steamMap: Map<string, string>,
): string | null {
  if (!game) return null;
  const direct = getMonitorableExecutablePath(game);
  if (direct) return direct;
  if (game.steamAppId && steamMap.has(String(game.steamAppId))) {
    return steamMap.get(String(game.steamAppId)) || null;
  }
  if (game.executablePath && /\.exe$/i.test(game.executablePath)) {
    return game.executablePath;
  }
  return null;
}

export function useGamePresence({
  userUid,
  userProfile,
  games,
  onLibraryChanged,
}: UseGamePresenceProps) {
  const [currentPresenceGame, setCurrentPresenceGame] = useState<string | null>(null);
  const [currentPresenceExecutablePath, setCurrentPresenceExecutablePath] = useState<string | null>(null);
  const [sessionStartedAt, setSessionStartedAt] = useState<string | null>(null);
  const [presenceVerification, setPresenceVerification] = useState<PresenceVerificationMode>("none");
  const [provisionalPresenceExpiresAt, setProvisionalPresenceExpiresAt] = useState<string | null>(null);
  const provisionalPresenceDeadlineRef = useRef<number | null>(null);
  const presenceRevisionRef = useRef(0);
  const processMissesRef = useRef(0);
  const steamPresenceMissesRef = useRef(0);
  const steamPresenceLastConfirmedAtRef = useRef<number | null>(null);
  const steamInstalledMapRef = useRef<Map<string, string>>(new Map());
  const activeSessionRef = useRef<{
    title: string;
    startedAt: number;
  } | null>(null);
  const steamId = userProfile?.steamId;

  const finalizeActiveSession = useCallback(async () => {
    const session = activeSessionRef.current;
    activeSessionRef.current = null;
    if (!session || !userUid) return;
    const durationMinutes = Math.max(
      0,
      Math.round((Date.now() - session.startedAt) / 60_000),
    );
    if (durationMinutes < 1) return;
    const game = games.find((candidate) =>
      candidate.title.trim().toLowerCase() === session.title.trim().toLowerCase());
    if (!game) return;
    const knownMinutes = Math.max(
      Number(game.locallyTrackedMinutes) || 0,
      Number(game.steamPlaytimeMinutes) || 0,
      Math.round((Number(game.hoursPlayed) || 0) * 60),
    );
    const locallyTrackedMinutes = knownMinutes + durationMinutes;
    const endedAt = new Date().toISOString();
    await recordLibrarySession(userUid, game.id, {
      startedAt: new Date(session.startedAt).toISOString(),
      endedAt,
      durationMinutes,
    });
    await updateLibraryGame(userUid, game.id, {
      locallyTrackedMinutes,
      hoursPlayed: Math.round((locallyTrackedMinutes / 60) * 10) / 10,
      lastPlayedAt: endedAt,
    });
    await onLibraryChanged?.();
  }, [games, onLibraryChanged, userUid]);

  const clearCurrentPresence = useCallback(() => {
    void finalizeActiveSession().catch((error) => {
      console.error("Erro ao registrar sessao local:", error);
    });
    presenceRevisionRef.current += 1;
    provisionalPresenceDeadlineRef.current = null;
    processMissesRef.current = 0;
    steamPresenceMissesRef.current = 0;
    steamPresenceLastConfirmedAtRef.current = null;
    setCurrentPresenceGame(null);
    setCurrentPresenceExecutablePath(null);
    setSessionStartedAt(null);
    setPresenceVerification("none");
    setProvisionalPresenceExpiresAt(null);
  }, [finalizeActiveSession]);

  const markCurrentPresence = useCallback((title: string, executablePath: string | null) => {
    const normalizedExecutablePath = executablePath?.trim() || null;
    const provisionalDeadline = normalizedExecutablePath
      ? null
      : Date.now() + UNVERIFIED_URI_PRESENCE_TTL_MS;

    presenceRevisionRef.current += 1;
    provisionalPresenceDeadlineRef.current = provisionalDeadline;
    processMissesRef.current = 0;
    steamPresenceMissesRef.current = 0;
    steamPresenceLastConfirmedAtRef.current = null;
    if (title !== currentPresenceGame) {
      void finalizeActiveSession().catch(() => undefined);
      const startedAt = Date.now();
      activeSessionRef.current = { title, startedAt };
      setSessionStartedAt(new Date(startedAt).toISOString());
    }
    setCurrentPresenceGame(title);
    setCurrentPresenceExecutablePath(normalizedExecutablePath);
    setPresenceVerification(normalizedExecutablePath ? "process" : "provisional");
    setProvisionalPresenceExpiresAt(
      provisionalDeadline == null ? null : new Date(provisionalDeadline).toISOString(),
    );

    // Sem .exe monitoravel (ex: steam://run), a presença fica provisional.
    // Assim que o mapa Steam tiver o caminho, promove para watch por processo.
    if (!normalizedExecutablePath) {
      const revision = presenceRevisionRef.current;
      void (async () => {
        const steamMap = await ensureSteamInstalledMap(steamInstalledMapRef);
        if (presenceRevisionRef.current !== revision) return;
        const matchedGame = games.find((candidate) => {
          const candidateTitle = candidate.title.trim().toLowerCase();
          const presenceTitle = title.trim().toLowerCase();
          return (
            candidateTitle === presenceTitle
            || candidateTitle.includes(presenceTitle)
            || presenceTitle.includes(candidateTitle)
          );
        });
        const resolved = resolveMonitorablePathForGame(matchedGame, steamMap);
        if (!resolved || presenceRevisionRef.current !== revision) return;
        if (window.electronAPI?.setGameWatchTarget) {
          void window.electronAPI.setGameWatchTarget(resolved).catch(() => undefined);
        }
        setCurrentPresenceExecutablePath(resolved);
        provisionalPresenceDeadlineRef.current = null;
        setPresenceVerification("process");
        setProvisionalPresenceExpiresAt(null);
      })();
    } else if (window.electronAPI?.setGameWatchTarget) {
      void window.electronAPI.setGameWatchTarget(normalizedExecutablePath).catch(() => undefined);
    }
  }, [currentPresenceGame, finalizeActiveSession, games]);

  const syncDetectedRunningGame = useCallback(async () => {
    if (!window.electronAPI?.detectRunningGames || games.length === 0) {
      return false;
    }

    const requestRevision = presenceRevisionRef.current;
    await ensureSteamInstalledMap(steamInstalledMapRef);

    const monitorableGames: Array<{ game: Game; executablePath: string }> = [];
    for (const game of games) {
      const exe = resolveMonitorablePathForGame(game, steamInstalledMapRef.current);
      if (exe) {
        monitorableGames.push({ game, executablePath: exe });
      }
    }

    if (monitorableGames.length === 0) return false;

    try {
      const runningPaths = await window.electronAPI.detectRunningGames(
        monitorableGames.map((entry) => entry.executablePath),
      );
      if (presenceRevisionRef.current !== requestRevision) return false;

      const normalizedRunning = new Set(runningPaths.map((value) => value.trim().toLowerCase()));

      const matchedCurrent = currentPresenceExecutablePath
        ? monitorableGames.find(
            (entry) =>
              entry.executablePath.trim().toLowerCase() === currentPresenceExecutablePath.trim().toLowerCase() &&
              normalizedRunning.has(entry.executablePath.trim().toLowerCase()),
          )
        : undefined;

      const matchedGame =
        matchedCurrent ||
        monitorableGames.find((entry) => normalizedRunning.has(entry.executablePath.trim().toLowerCase()));

      if (!matchedGame) {
        // Se temos um executável monitorado, apenas finaliza se já esgotou as chances e o período de carência
        if (currentPresenceExecutablePath) {
          const startedAt = activeSessionRef.current?.startedAt || 0;
          const elapsed = Date.now() - startedAt;
          if (elapsed >= 45_000 && processMissesRef.current >= 3) {
            clearCurrentPresence();
          }
        }
        return false;
      }

      processMissesRef.current = 0;
      if (
        currentPresenceGame !== matchedGame.game.title ||
        currentPresenceExecutablePath !== matchedGame.executablePath
      ) {
        markCurrentPresence(matchedGame.game.title, matchedGame.executablePath);
      } else if (presenceVerification !== "process") {
        setPresenceVerification("process");
      }
      return true;
    } catch {
      // Presence auto-detection is best-effort.
      return false;
    }
  }, [clearCurrentPresence, currentPresenceExecutablePath, currentPresenceGame, games, markCurrentPresence, presenceVerification]);

  const verifyRunningState = useCallback(async () => {
    const requestRevision = presenceRevisionRef.current;
    if (currentPresenceExecutablePath && window.electronAPI?.isExecutableRunning) {
      try {
        const isRunning = await window.electronAPI.isExecutableRunning(currentPresenceExecutablePath);
        if (presenceRevisionRef.current !== requestRevision) return;

        if (isRunning) {
          processMissesRef.current = 0;
          if (presenceVerification !== "process") {
            setPresenceVerification("process");
          }
          return;
        }

        // Processo não respondeu neste tick. Verifica período de carência de inicialização (45s)
        const startedAt = activeSessionRef.current?.startedAt || 0;
        const elapsed = Date.now() - startedAt;
        if (elapsed < 45_000) {
          // Jogo ainda está carregando/iniciando
          return;
        }

        processMissesRef.current += 1;
        // Requer 3 falhas consecutivas (~30s) para evitar fechar presença por falso positivo
        if (processMissesRef.current >= 3) {
          const matchedDetectedGame = await syncDetectedRunningGame();
          if (!matchedDetectedGame && presenceRevisionRef.current === requestRevision) {
            clearCurrentPresence();
          }
        }
      } catch {
        // best-effort
      }
      return;
    }

    const matchedDetectedGame = await syncDetectedRunningGame();
    if (matchedDetectedGame || presenceRevisionRef.current !== requestRevision) return;

    const provisionalDeadline = provisionalPresenceDeadlineRef.current;
    if (
      currentPresenceGame
      && presenceVerification === "provisional"
      && provisionalDeadline != null
      && Date.now() >= provisionalDeadline
    ) {
      clearCurrentPresence();
    }
  }, [
    clearCurrentPresence,
    currentPresenceExecutablePath,
    currentPresenceGame,
    presenceVerification,
    syncDetectedRunningGame,
  ]);

  useInterval(
    () => {
      if (userUid) {
        void verifyRunningState();
      }
    },
    userUid ? 10000 : null,
    { pauseWhenHidden: false }
  );

  useEffect(() => {
    if (!userUid) return;
    const handleFocus = () => {
      void verifyRunningState();
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [userUid, verifyRunningState]);

  const verifySteamUriPresence = useCallback(async () => {
    if (!currentPresenceGame || currentPresenceExecutablePath || !steamId) return;

    const expectedGame = games.find((game) => (
      game.launcherType === "steam"
      && Boolean(game.steamAppId)
      && (
        game.title.toLowerCase().includes(currentPresenceGame.toLowerCase())
        || currentPresenceGame.toLowerCase().includes(game.title.toLowerCase())
      )
    ));
    if (!expectedGame?.steamAppId) return;

    const requestRevision = presenceRevisionRef.current;
    const startedAt = sessionStartedAt ? Date.parse(sessionStartedAt) : Date.now();

    const markSteamVerified = () => {
      steamPresenceMissesRef.current = 0;
      steamPresenceLastConfirmedAtRef.current = Date.now();
      provisionalPresenceDeadlineRef.current = null;
      setPresenceVerification("steam");
      setProvisionalPresenceExpiresAt(null);
    };

    const downgradeToProvisional = () => {
      const deadline = Date.now() + UNVERIFIED_URI_PRESENCE_TTL_MS;
      provisionalPresenceDeadlineRef.current = deadline;
      setPresenceVerification("provisional");
      setProvisionalPresenceExpiresAt(new Date(deadline).toISOString());
    };

    try {
      const steamPresence = await fetchSteamCurrentGame();
      if (presenceRevisionRef.current !== requestRevision) return;

      if (!steamPresence.observable) {
        steamPresenceMissesRef.current = 0;
        if (presenceVerification === "steam") downgradeToProvisional();
        return;
      }

      if (steamPresence.appId === String(expectedGame.steamAppId)) {
        markSteamVerified();
        return;
      }

      // Steam pode demorar alguns segundos para publicar o jogo logo após o URI.
      if (Date.now() - startedAt < 90_000) return;
      steamPresenceMissesRef.current += 1;
      if (steamPresenceMissesRef.current < 2) return;

      if (steamPresence.appId) {
        const detectedGame = games.find((game) => (
          game.launcherType === "steam"
          && String(game.steamAppId || "") === steamPresence.appId
        ));
        if (detectedGame) {
          markCurrentPresence(detectedGame.title, null);
          markSteamVerified();
          return;
        }
      }

      downgradeToProvisional();
    } catch {
      const lastConfirmedAt = steamPresenceLastConfirmedAtRef.current;
      if (
        presenceVerification === "steam"
        && lastConfirmedAt != null
        && Date.now() - lastConfirmedAt >= 10 * 60 * 1000
      ) {
        downgradeToProvisional();
      }
    }
  }, [
    clearCurrentPresence,
    currentPresenceExecutablePath,
    currentPresenceGame,
    games,
    markCurrentPresence,
    presenceVerification,
    sessionStartedAt,
    steamId,
  ]);

  useInterval(
    () => void verifySteamUriPresence(),
    userUid && currentPresenceGame && !currentPresenceExecutablePath && steamId
      ? 15_000
      : null,
    { pauseWhenHidden: false },
  );

  const pollAchievements = useCallback(async (unlockedSet: Set<string>, state: { firstLoadDone: boolean }) => {
    if (!currentPresenceGame) return;

    const runningGame = games.find(
      (g) =>
        g.title.toLowerCase().includes(currentPresenceGame.toLowerCase()) ||
        currentPresenceGame.toLowerCase().includes(g.title.toLowerCase()),
    );
    if (!runningGame) return;

    // ── 1. Steam Achievements Polling ──────────────────────────────────────────
    if ((runningGame.launcherType === "steam" || runningGame.steamAppId) && steamId && runningGame.steamAppId) {
      try {
        const details = await fetchSteamAchievementDetails(steamId, runningGame.steamAppId);

        if (!state.firstLoadDone) {
          details.achievements.forEach((ach) => {
            if (ach.achieved) {
              unlockedSet.add(ach.apiName);
            }
          });
          state.firstLoadDone = true;
          return;
        }

        for (const ach of details.achievements) {
          if (ach.achieved && !unlockedSet.has(ach.apiName)) {
            unlockedSet.add(ach.apiName);

            const percent = typeof ach.percent === "number" ? ach.percent : 15;
            const tier: "platinum" | "gold" | "silver" | "bronze" =
              percent <= 5 ? "platinum" : percent <= 20 ? "gold" : percent <= 50 ? "silver" : "bronze";
            const xpMap = { platinum: 90, gold: 60, silver: 30, bronze: 15 };
            const xp = xpMap[tier] ?? 30;
            const iconUrl = ach.icon || ach.iconGray || "";

            // Lança o overlay de conquista com a conquista exata, foto e descrição
            void window.electronAPI?.notifyTrophyUnlock?.({
              trophyTitle: ach.name || ach.apiName,
              trophyDescription: ach.description || "",
              gameTitle: runningGame.title,
              iconUrl,
              icon: iconUrl,
              tier,
              percent,
              xp,
            });

            void window.electronAPI?.unlockAchievement?.(`steam_${runningGame.steamAppId}`, ach.apiName, {
              name: ach.name || ach.apiName,
              title: ach.name || ach.apiName,
              description: ach.description || "",
              icon: iconUrl,
              tier,
              percent,
              gameTitle: runningGame.title,
            });
          }
        }
      } catch (error) {
        console.error("Erro no polling de conquistas Steam:", error);
      }
      return;
    }

    // ── 2. Epic Games Achievements Polling ────────────────────────────────────
    if (runningGame.launcherType === "epic" || runningGame.epicCatalogId || runningGame.epicLaunchId) {
      try {
        const appName = runningGame.epicLaunchId ||
          (runningGame.epicCatalogId?.includes(":") ? runningGame.epicCatalogId.split(":")[1] : runningGame.epicCatalogId) ||
          runningGame.title;
        const sandboxId = runningGame.epicNamespace ||
          (runningGame.epicCatalogId?.includes(":") ? runningGame.epicCatalogId.split(":")[0] : undefined);

        const epicRes = await fetchEpicAchievements(sandboxId, appName);
        if (epicRes && Array.isArray(epicRes.list) && epicRes.list.length > 0) {
          if (!state.firstLoadDone) {
            epicRes.list.forEach((ach: any) => {
              if (ach.achieved || ach.unlocked) {
                unlockedSet.add(ach.apiName || ach.name);
              }
            });
            state.firstLoadDone = true;
            return;
          }

          for (const ach of epicRes.list) {
            const isAchieved = Boolean(ach.achieved || ach.unlocked);
            const achId = ach.apiName || ach.name;
            if (isAchieved && achId && !unlockedSet.has(achId)) {
              unlockedSet.add(achId);

              const percent = typeof ach.percent === "number" ? ach.percent : (ach.rarity?.percent ?? 15);
              const tier: "platinum" | "gold" | "silver" | "bronze" =
                percent <= 5 ? "platinum" : percent <= 20 ? "gold" : percent <= 50 ? "silver" : "bronze";
              const xpMap = { platinum: 90, gold: 60, silver: 30, bronze: 15 };
              const xp = typeof ach.xp === "number" && ach.xp > 0 ? ach.xp : (xpMap[tier] ?? 30);
              const iconUrl = ach.icon || ach.icon_link || ach.iconLink || ach.unlockedIconLink || "";
              const title = ach.name || ach.display_name || "Conquista Desbloqueada";
              const description = ach.description || ach.unlockedDescription || "";

              // Lança o overlay de conquista com a conquista exata, foto e descrição
              void window.electronAPI?.notifyTrophyUnlock?.({
                trophyTitle: title,
                trophyDescription: description,
                gameTitle: runningGame.title,
                iconUrl,
                icon: iconUrl,
                tier,
                percent,
                xp,
              });

              void window.electronAPI?.unlockAchievement?.(runningGame.id, achId, {
                name: title,
                title,
                description,
                icon: iconUrl,
                tier,
                percent,
                gameTitle: runningGame.title,
              });
            }
          }
        }
      } catch (error) {
        console.error("Erro no polling de conquistas Epic:", error);
      }
    }
  }, [currentPresenceGame, games, steamId]);

  const achievementsState = useRef({
    unlockedSet: new Set<string>(),
    state: { firstLoadDone: false },
  });

  useEffect(() => {
    achievementsState.current.unlockedSet.clear();
    achievementsState.current.state.firstLoadDone = false;
  }, [currentPresenceGame]);

  useInterval(
    () => {
      void pollAchievements(
        achievementsState.current.unlockedSet,
        achievementsState.current.state,
      );
    },
    currentPresenceGame ? 8000 : null,
    { pauseWhenHidden: false },
  );

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onGameWatchStarted || !api?.onGameWatchEnded) return;

    const unlistenStarted = api.onGameWatchStarted((payload) => {
      const exe = payload?.executable;
      if (!exe) return;
      processMissesRef.current = 0;
      setPresenceVerification("process");

      const exeBase = exe.split(/[\\/]/).pop()?.toLowerCase();
      const exeStem = exeBase?.replace(/\.exe$/i, "");

      const matchByExeName = (candidatePath: string | null | undefined) => {
        const gExe = (candidatePath || "").split(/[\\/]/).pop()?.toLowerCase();
        const gStem = gExe?.replace(/\.exe$/i, "");
        return Boolean(
          (gExe && exeBase && (gExe === exeBase || exeBase.includes(gExe) || gExe.includes(exeBase)))
          || (gStem && exeStem && (gStem === exeStem || exeStem.includes(gStem) || gStem.includes(exeStem))),
        );
      };

      let matched = games.find((g) => matchByExeName(g.executablePath));
      let matchedExe = matched ? (getMonitorableExecutablePath(matched) || matched.executablePath || exe) : null;

      if (!matched) {
        for (const [appId, installedPath] of steamInstalledMapRef.current.entries()) {
          if (!matchByExeName(installedPath)) continue;
          matched = games.find((g) => String(g.steamAppId || "") === String(appId));
          if (matched) {
            matchedExe = installedPath;
            break;
          }
        }
      }

      if (matched && matched.title !== currentPresenceGame) {
        markCurrentPresence(matched.title, matchedExe);
      } else if (matched && matchedExe && matchedExe !== currentPresenceExecutablePath) {
        setCurrentPresenceExecutablePath(matchedExe);
      }
    });

    const unlistenEnded = api.onGameWatchEnded(() => {
      clearCurrentPresence();
    });

    return () => {
      unlistenStarted?.();
      unlistenEnded?.();
    };
  }, [games, currentPresenceGame, currentPresenceExecutablePath, markCurrentPresence, clearCurrentPresence]);

  return {
    currentPresenceGame,
    currentPresenceExecutablePath,
    sessionStartedAt,
    presenceVerification,
    provisionalPresenceExpiresAt,
    markCurrentPresence,
    clearCurrentPresence,
    syncDetectedRunningGame,
  };
}
