import { useState, useCallback, useEffect, useRef } from "react";
import { useInterval } from "./useInterval";
import type { Game, UserProfile } from "../types/domain";
import {
  getMonitorableExecutablePath,
  resolveEpicAchievementAppName,
  resolveMonitorableExecutablePath,
} from "../services/launcher";
import { fetchSteamAchievementDetails, fetchSteamCurrentGame } from "../services/steam";
import { fetchEpicAchievements } from "../services/epic";
import {
  recordLibrarySession,
  updateLibraryGame,
} from "../services/localLibrary";
import {
  executablePathsEqual,
  monitorPathsRelated,
  normalizeExecutablePath,
  type RunningProcessMatch,
} from "../utils/processIdentity";
import { resolveSessionStartedAt } from "../utils/sessionStartedAt";
import { resolveGameFromPresence } from "../utils/presenceGameMatch";
import {
  canConfirmSession,
  isValidSessionPid,
  shouldAllowBackgroundSessionConfirm,
} from "../utils/sessionPolicy";

interface UseGamePresenceProps {
  userUid?: string;
  userProfile?: UserProfile | null;
  games: Game[];
  onLibraryChanged?: () => Promise<void> | void;
}

export const UNVERIFIED_URI_PRESENCE_TTL_MS = 12 * 60 * 60 * 1000;
export type PresenceVerificationMode = "none" | "pending" | "provisional" | "process" | "steam";

export interface MarkPresenceOptions {
  confirmed?: boolean;
  processStartTimeMs?: number | null;
  pid?: number | null;
}

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
  const [activeSessionPid, setActiveSessionPid] = useState<number | null>(null);
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
    executablePath: string;
    pid?: number;
  } | null>(null);
  const pendingLaunchRef = useRef<{
    title: string;
    executablePath: string | null;
    launchedAt: number;
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
    pendingLaunchRef.current = null;
    provisionalPresenceDeadlineRef.current = null;
    processMissesRef.current = 0;
    steamPresenceMissesRef.current = 0;
    steamPresenceLastConfirmedAtRef.current = null;
    setCurrentPresenceGame(null);
    setCurrentPresenceExecutablePath(null);
    setSessionStartedAt(null);
    setActiveSessionPid(null);
    setPresenceVerification("none");
    setProvisionalPresenceExpiresAt(null);
    void window.electronAPI?.clearGameWatchTarget?.().catch(() => undefined);
  }, [finalizeActiveSession]);

  const beginConfirmedSession = useCallback((
    title: string,
    executablePath: string,
    processStartTimeMs?: number | null,
    pid?: number | null,
  ): boolean => {
    if (!isValidSessionPid(pid)) return false;

    const normalizedExecutablePath = normalizeExecutablePath(executablePath);
    const launchedAt = pendingLaunchRef.current?.launchedAt ?? Date.now();
    const startedAt = resolveSessionStartedAt(launchedAt, processStartTimeMs);
    const existing = activeSessionRef.current;

    if (
      existing
      && existing.title === title
      && executablePathsEqual(existing.executablePath, normalizedExecutablePath)
      && existing.pid === pid
    ) {
      return true;
    }

    void finalizeActiveSession().catch(() => undefined);
    activeSessionRef.current = {
      title,
      startedAt,
      executablePath: normalizedExecutablePath,
      pid: pid ?? undefined,
    };
    pendingLaunchRef.current = null;
    setActiveSessionPid(pid ?? null);
    setSessionStartedAt(new Date(startedAt).toISOString());
    return true;
  }, [finalizeActiveSession]);

  const markCurrentPresence = useCallback((
    title: string,
    executablePath: string | null,
    options: MarkPresenceOptions = {},
  ) => {
    const normalizedExecutablePath = executablePath
      ? normalizeExecutablePath(executablePath)
      : null;
    const confirmed = options.confirmed ?? false;
    const provisionalDeadline = normalizedExecutablePath || confirmed
      ? null
      : Date.now() + UNVERIFIED_URI_PRESENCE_TTL_MS;

    presenceRevisionRef.current += 1;
    provisionalPresenceDeadlineRef.current = provisionalDeadline;
    processMissesRef.current = 0;
    steamPresenceMissesRef.current = 0;
    steamPresenceLastConfirmedAtRef.current = null;

    const sessionConfirmed = canConfirmSession({
      confirmed,
      executablePath: normalizedExecutablePath,
      pid: options.pid,
    });

    if (sessionConfirmed && normalizedExecutablePath) {
      beginConfirmedSession(
        title,
        normalizedExecutablePath,
        options.processStartTimeMs,
        options.pid,
      );
    } else if (normalizedExecutablePath) {
      pendingLaunchRef.current = {
        title,
        executablePath: normalizedExecutablePath,
        launchedAt: Date.now(),
      };
      if (activeSessionRef.current) {
        void finalizeActiveSession().catch(() => undefined);
        activeSessionRef.current = null;
        setSessionStartedAt(null);
      }
    } else {
      pendingLaunchRef.current = null;
      if (title !== currentPresenceGame) {
        void finalizeActiveSession().catch(() => undefined);
        activeSessionRef.current = null;
        setSessionStartedAt(null);
      }
    }

    setCurrentPresenceGame(title);
    setCurrentPresenceExecutablePath(normalizedExecutablePath);
    setPresenceVerification(
      sessionConfirmed
        ? "process"
        : (normalizedExecutablePath ? "pending" : "provisional"),
    );
    setProvisionalPresenceExpiresAt(
      provisionalDeadline == null ? null : new Date(provisionalDeadline).toISOString(),
    );

    if (!normalizedExecutablePath) {
      const revision = presenceRevisionRef.current;
      void (async () => {
        const steamMap = await ensureSteamInstalledMap(steamInstalledMapRef);
        if (presenceRevisionRef.current !== revision) return;
        const matchedGame = games.find((candidate) => {
          const candidateTitle = candidate.title.trim().toLowerCase();
          const presenceTitle = title.trim().toLowerCase();
          return candidateTitle === presenceTitle;
        });
        let resolved = resolveMonitorablePathForGame(matchedGame, steamMap);
        if (!resolved && matchedGame) {
          resolved = await resolveMonitorableExecutablePath(matchedGame);
        }
        if (!resolved || presenceRevisionRef.current !== revision) return;
        if (window.electronAPI?.setGameWatchTarget) {
          void window.electronAPI.setGameWatchTarget(resolved).catch(() => undefined);
        }
        setCurrentPresenceExecutablePath(normalizeExecutablePath(resolved));
        setPresenceVerification("pending");
        pendingLaunchRef.current = {
          title,
          executablePath: normalizeExecutablePath(resolved),
          launchedAt: Date.now(),
        };
        setProvisionalPresenceExpiresAt(null);
      })();
    } else if (window.electronAPI?.setGameWatchTarget) {
      void window.electronAPI.setGameWatchTarget(executablePath).catch(() => undefined);
    }
  }, [beginConfirmedSession, currentPresenceGame, finalizeActiveSession, games]);

  const prepareLaunchPresence = useCallback((title: string, executablePath: string | null) => {
    markCurrentPresence(title, executablePath, { confirmed: false });
  }, [markCurrentPresence]);

  const resolveRunningMatches = useCallback(async (
    executablePaths: string[],
  ): Promise<RunningProcessMatch[]> => {
    if (executablePaths.length === 0) return [];
    if (window.electronAPI?.detectRunningGameDetails) {
      return window.electronAPI.detectRunningGameDetails(executablePaths);
    }
    if (!window.electronAPI?.detectRunningGames) return [];
    const runningPaths = await window.electronAPI.detectRunningGames(executablePaths);
    return runningPaths.map((requestedPath) => ({
      requestedPath,
      matchedPath: requestedPath,
      pid: 0,
      processStartTimeMs: null,
    }));
  }, []);

  const syncDetectedRunningGame = useCallback(async () => {
    if ((!window.electronAPI?.detectRunningGames && !window.electronAPI?.detectRunningGameDetails) || games.length === 0) {
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
      const matches = await resolveRunningMatches(
        monitorableGames.map((entry) => entry.executablePath),
      );
      if (presenceRevisionRef.current !== requestRevision) return false;

      const matchedCurrent = currentPresenceExecutablePath
        ? matches.find((match) =>
          monitorPathsRelated(currentPresenceExecutablePath, match.matchedPath)
          || monitorPathsRelated(currentPresenceExecutablePath, match.requestedPath))
        : undefined;

      const matchedEntries = matches.flatMap((match) => {
        const entry = monitorableGames.find((candidate) =>
          monitorPathsRelated(candidate.executablePath, match.matchedPath)
          || monitorPathsRelated(candidate.executablePath, match.requestedPath));
        return entry ? [{ ...entry, match }] : [];
      });

      const pickNewestEntry = (
        entries: Array<{ game: Game; executablePath: string; match: RunningProcessMatch }>,
      ) => entries.reduce((best, entry) => {
        const bestStart = best.match.processStartTimeMs ?? 0;
        const entryStart = entry.match.processStartTimeMs ?? 0;
        return entryStart > bestStart ? entry : best;
      });

      let matchedEntry = matchedCurrent
        ? (() => {
            const entry = monitorableGames.find((candidate) =>
              monitorPathsRelated(candidate.executablePath, matchedCurrent.matchedPath)
              || monitorPathsRelated(candidate.executablePath, matchedCurrent.requestedPath));
            return entry ? { ...entry, match: matchedCurrent } : undefined;
          })()
        : undefined;

      if (!matchedEntry && pendingLaunchRef.current?.title) {
        const pendingTitle = pendingLaunchRef.current.title.trim().toLowerCase();
        matchedEntry = matchedEntries.find((entry) =>
          entry.game.title.trim().toLowerCase() === pendingTitle);
      }

      if (!matchedEntry && matchedEntries.length > 1) {
        matchedEntry = pickNewestEntry(matchedEntries);
      }

      if (!matchedEntry) {
        if (currentPresenceExecutablePath) {
          const pendingStartedAt = pendingLaunchRef.current?.launchedAt
            || activeSessionRef.current?.startedAt
            || 0;
          const elapsed = Date.now() - pendingStartedAt;
          if (elapsed >= 45_000 && processMissesRef.current >= 3) {
            clearCurrentPresence();
          }
        }
        return false;
      }

      const canConfirm = shouldAllowBackgroundSessionConfirm({
        pendingLaunchedAt: pendingLaunchRef.current?.launchedAt,
        hasActiveSession: Boolean(activeSessionRef.current),
        pid: matchedEntry.match.pid,
      });
      if (!canConfirm) return false;

      processMissesRef.current = 0;
      const resolvedPath = matchedEntry.match.matchedPath || matchedEntry.executablePath;
      markCurrentPresence(matchedEntry.game.title, resolvedPath, {
        confirmed: true,
        processStartTimeMs: matchedEntry.match.processStartTimeMs,
        pid: matchedEntry.match.pid,
      });
      return Boolean(activeSessionRef.current);
    } catch {
      return false;
    }
  }, [clearCurrentPresence, currentPresenceExecutablePath, games, markCurrentPresence, resolveRunningMatches]);

  const verifyRunningState = useCallback(async () => {
    const requestRevision = presenceRevisionRef.current;
    if (currentPresenceExecutablePath && window.electronAPI?.isExecutableRunning) {
      try {
        const isRunning = await window.electronAPI.isExecutableRunning(currentPresenceExecutablePath);
        if (presenceRevisionRef.current !== requestRevision) return;

        if (isRunning) {
          processMissesRef.current = 0;
          const sessionPid = activeSessionRef.current?.pid;
          if (sessionPid && window.electronAPI?.isProcessRunning) {
            const pidAlive = await window.electronAPI.isProcessRunning(sessionPid);
            if (presenceRevisionRef.current !== requestRevision) return;
            if (!pidAlive) {
              clearCurrentPresence();
              return;
            }
          } else if (!activeSessionRef.current?.pid && pendingLaunchRef.current) {
            void syncDetectedRunningGame();
          }
          return;
        }

        if (activeSessionRef.current?.pid) {
          if (window.electronAPI?.isProcessRunning) {
            const pidAlive = await window.electronAPI.isProcessRunning(activeSessionRef.current.pid);
            if (presenceRevisionRef.current !== requestRevision) return;
            if (!pidAlive) {
              clearCurrentPresence();
            }
          }
          return;
        }

        // Processo não respondeu neste tick. Verifica período de carência de inicialização (45s)
        const pendingStartedAt = pendingLaunchRef.current?.launchedAt
          || activeSessionRef.current?.startedAt
          || 0;
        const elapsed = Date.now() - pendingStartedAt;
        if (elapsed < 45_000) {
          return;
        }

        processMissesRef.current += 1;
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

    const pendingLaunch = pendingLaunchRef.current;
    if (
      pendingLaunch
      && !activeSessionRef.current
      && Date.now() - pendingLaunch.launchedAt >= 90_000
    ) {
      clearCurrentPresence();
      return;
    }

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

  useInterval(
    () => {
      if (pendingLaunchRef.current && !activeSessionRef.current?.pid) {
        void syncDetectedRunningGame();
      }
    },
    presenceVerification === "pending" && currentPresenceExecutablePath ? 3000 : null,
    { pauseWhenHidden: false },
  );

  useInterval(
    () => {
      const pid = activeSessionRef.current?.pid;
      if (!pid || !window.electronAPI?.isProcessRunning) return;
      void window.electronAPI.isProcessRunning(pid).then((isRunning) => {
        if (!isRunning && activeSessionRef.current?.pid === pid) {
          clearCurrentPresence();
        }
      }).catch(() => undefined);
    },
    activeSessionPid ? 1000 : null,
    { pauseWhenHidden: false },
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

    const expectedGame = resolveGameFromPresence(games, currentPresenceGame, null);
    if (!expectedGame || expectedGame.launcherType !== "steam" || !expectedGame.steamAppId) return;

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

    const runningGame = resolveGameFromPresence(
      games,
      currentPresenceGame,
      currentPresenceExecutablePath,
    );
    if (!runningGame) return;

    const isEpicGame = runningGame.launcherType === "epic"
      || Boolean(runningGame.epicCatalogId || runningGame.epicLaunchId);

    // ── 1. Epic Games (prioridade — evita bater na API Steam de jogos Epic) ───
    if (isEpicGame) {
      try {
        const appName = resolveEpicAchievementAppName(runningGame);
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
      return;
    }

    // ── 2. Steam Achievements Polling ──────────────────────────────────────────
    if (runningGame.steamAppId && steamId) {
      try {
        const details = await fetchSteamAchievementDetails(
          steamId,
          runningGame.steamAppId,
          "pt-BR",
          // o polling precisa ver o unlock novo: com o cache de 15 min a detecção levava ≥15 min
          { bypassCache: true },
        );

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
  }, [currentPresenceExecutablePath, currentPresenceGame, games, steamId]);

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
    currentPresenceGame ? 30_000 : null,
    { pauseWhenHidden: false },
  );

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onGameWatchStarted || !api?.onGameWatchEnded) return;

    const unlistenStarted = api.onGameWatchStarted((payload) => {
      const matchedPath = payload?.matchedPath || payload?.executable;
      const requestedPath = payload?.executable;
      if (!matchedPath || !isValidSessionPid(payload?.pid)) return;
      processMissesRef.current = 0;

      const pathMatchesTarget = (candidatePath: string | null | undefined) =>
        monitorPathsRelated(candidatePath, matchedPath)
        || monitorPathsRelated(candidatePath, requestedPath);

      const pendingLaunch = pendingLaunchRef.current;
      if (pendingLaunch?.title) {
        markCurrentPresence(pendingLaunch.title, matchedPath, {
          confirmed: true,
          processStartTimeMs: payload?.processStartTimeMs,
          pid: payload?.pid,
        });
        return;
      }

      const pendingTitle = currentPresenceGame;
      if (pendingTitle) {
        const pendingGame = games.find((game) =>
          game.title.trim().toLowerCase() === pendingTitle.trim().toLowerCase());
        if (pendingGame) {
          const watchTarget = getMonitorableExecutablePath(pendingGame) || pendingGame.executablePath;
          if (pathMatchesTarget(watchTarget)) {
            markCurrentPresence(pendingGame.title, matchedPath, {
              confirmed: true,
              processStartTimeMs: payload?.processStartTimeMs,
              pid: payload?.pid,
            });
            return;
          }
        }
      }

      let matched = games.find((game) =>
        pathMatchesTarget(getMonitorableExecutablePath(game) || game.executablePath));
      let matchedExe = matched
        ? (getMonitorableExecutablePath(matched) || matched.executablePath || matchedPath)
        : null;

      if (!matched) {
        for (const [appId, installedPath] of steamInstalledMapRef.current.entries()) {
          if (!pathMatchesTarget(installedPath)) continue;
          matched = games.find((game) => String(game.steamAppId || "") === String(appId));
          if (matched) {
            matchedExe = installedPath;
            break;
          }
        }
      }

      if (matched) {
        markCurrentPresence(matched.title, matchedPath, {
          confirmed: true,
          processStartTimeMs: payload?.processStartTimeMs,
          pid: payload?.pid,
        });
      }
    });

    const unlistenEnded = api.onGameWatchEnded(() => {
      const pid = activeSessionRef.current?.pid;
      if (pid && window.electronAPI?.isProcessRunning) {
        void window.electronAPI.isProcessRunning(pid).then((isRunning) => {
          if (isRunning) return;
          clearCurrentPresence();
        }).catch(() => {
          clearCurrentPresence();
        });
        return;
      }
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
    prepareLaunchPresence,
    clearCurrentPresence,
    syncDetectedRunningGame,
  };
}
