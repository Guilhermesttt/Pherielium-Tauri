import { useState, useCallback, useEffect, useRef } from "react";
import { useInterval } from "./useInterval";
import type { Game, UserProfile } from "../types/domain";
import { getMonitorableExecutablePath } from "../services/launcher";
import { fetchSteamAchievementDetails, fetchSteamCurrentGame } from "../services/steam";
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
  const steamPresenceMissesRef = useRef(0);
  const steamPresenceLastConfirmedAtRef = useRef<number | null>(null);
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
  }, [currentPresenceGame, finalizeActiveSession]);

  const syncDetectedRunningGame = useCallback(async () => {
    if (!window.electronAPI?.detectRunningGames || games.length === 0) {
      return false;
    }

    const requestRevision = presenceRevisionRef.current;

    const monitorableGames = games
      .map((game) => ({
        game,
        executablePath: getMonitorableExecutablePath(game),
      }))
      .filter((entry): entry is { game: Game; executablePath: string } => Boolean(entry.executablePath));

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
        if (currentPresenceExecutablePath) {
          clearCurrentPresence();
        }
        return false;
      }

      if (
        currentPresenceGame !== matchedGame.game.title ||
        currentPresenceExecutablePath !== matchedGame.executablePath
      ) {
        markCurrentPresence(matchedGame.game.title, matchedGame.executablePath);
      }
      return true;
    } catch {
      // Presence auto-detection is best-effort.
      return false;
    }
  }, [clearCurrentPresence, currentPresenceExecutablePath, currentPresenceGame, games, markCurrentPresence]);

  const verifyRunningState = useCallback(async () => {
    const requestRevision = presenceRevisionRef.current;
    if (currentPresenceExecutablePath && window.electronAPI?.isExecutableRunning) {
      try {
        const isRunning = await window.electronAPI.isExecutableRunning(currentPresenceExecutablePath);
        if (!isRunning && presenceRevisionRef.current === requestRevision) {
          clearCurrentPresence();
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

      clearCurrentPresence();
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
    if (!currentPresenceGame || !steamId) return;

    const runningGame = games.find(
      (g) =>
        g.title.toLowerCase().includes(currentPresenceGame.toLowerCase()) ||
        currentPresenceGame.toLowerCase().includes(g.title.toLowerCase())
    );

    const appId = runningGame?.steamAppId;
    if (!appId) return;

    try {
      const details = await fetchSteamAchievementDetails(steamId, appId);

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

          void window.electronAPI?.unlockAchievement(`steam_${appId}`, ach.apiName);
        }
      }
    } catch (error) {
      console.error("Erro no polling de conquistas Steam:", error);
    }
  }, [currentPresenceGame, games, steamId]);

  const achievementsState = useRef({
    unlockedSet: new Set<string>(),
    state: { firstLoadDone: false }
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
    currentPresenceGame && steamId ? 15000 : null,
    { pauseWhenHidden: false }
  );

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
