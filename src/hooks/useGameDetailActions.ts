import React from "react";
import type { Game, GameLaunchProfile } from "../types/domain";
import type { GameDetailState, GameDetailAction, GameDetailCopy } from "../types/gameDetail";
import { launchGame, resolveMonitorableExecutablePath } from "../services/launcher";
import { deleteLibraryGame, updateLibraryGame } from "../services/localLibrary";
import { MIN_LAUNCH_SCREEN_MS, wait } from "../types/gameDetail";
import { playHapticPattern } from "../context/GamepadContext";

import type { SoundEffectType } from "./useSoundEffects";

interface UseGameDetailActionsProps {
  game: Game | null;
  state: GameDetailState;
  dispatch: React.Dispatch<GameDetailAction>;
  launchProfile: GameLaunchProfile;
  user: { uid: string } | null;
  closeOnLaunch: boolean;
  copy: GameDetailCopy;
  notify: (message: string, type: "success" | "error" | "info" | "warning") => void;
  onClose: () => void;
  onLibraryChanged?: () => Promise<void> | void;
  onOpenMods?: () => void;
  playSound?: (type: SoundEffectType) => void;
}

export function useGameDetailActions({
  game,
  state,
  dispatch,
  launchProfile,
  user,
  closeOnLaunch,
  copy,
  notify,
  onClose,
  onLibraryChanged,
  onOpenMods,
  playSound,
}: UseGameDetailActionsProps) {
  const handleLaunch = React.useCallback(async () => {
    if (state.isLaunching || !game) return;
    try {
      playSound?.("play");
      playHapticPattern("launch");
    } catch { }
    dispatch({ type: "SET_LAUNCHING", payload: true });
    dispatch({ type: "SET_LAUNCH_ERROR", payload: null });
    try {
      const [result] = await Promise.allSettled([
        launchGame(game, { hideLauncher: closeOnLaunch, ...launchProfile }),
        wait(MIN_LAUNCH_SCREEN_MS),
      ]);
      if (result.status === "rejected") throw result.reason;
      if (user?.uid) {
        updateLibraryGame(user.uid, game.id, { lastPlayedAt: new Date().toISOString() })
          .then(() => onLibraryChanged?.())
          .catch(() => undefined);
      }
      const monitorablePath = await resolveMonitorableExecutablePath(game);

      if (monitorablePath && window.electronAPI?.setGameWatchTarget) {
        void window.electronAPI.setGameWatchTarget(monitorablePath).catch(() => undefined);
      }

      window.dispatchEvent(
        new CustomEvent("checkpoint:game-launch", {
          detail: {
            title: game.title,
            gameId: game.id,
            executablePath: monitorablePath,
            game,
            soundPlayed: true,
          },
        }),
      );
    } catch (error) {
      dispatch({
        type: "SET_LAUNCH_ERROR",
        payload: error instanceof Error ? error.message : copy.launchGenericError,
      });
    } finally {
      dispatch({ type: "SET_LAUNCHING", payload: false });
    }
  }, [closeOnLaunch, copy.launchGenericError, dispatch, game, launchProfile, onLibraryChanged, playSound, state.isLaunching, user?.uid]);

  const handleDeleteGame = React.useCallback(async () => {
    if (!user?.uid) {
      notify(copy.loginToRemove, "error");
      return;
    }
    if (state.deleteConfirmText !== game?.title) {
      notify("O nome digitado não corresponde ao jogo.", "error");
      return;
    }
    if (state.isDeleting || !game?.id) return;
    dispatch({ type: "SET_DELETING", payload: true });
    try {
      await deleteLibraryGame(user.uid, game.id);
      await onLibraryChanged?.();
      notify(copy.removedSuccess, "success");
      dispatch({ type: "CLOSE_DELETE_MODAL" });
      onClose();
    } catch {
      notify(copy.removeError, "error");
    } finally {
      dispatch({ type: "SET_DELETING", payload: false });
    }
  }, [copy.loginToRemove, copy.removeError, copy.removedSuccess, dispatch, game?.id, game?.title, notify, onClose, onLibraryChanged, state.deleteConfirmText, state.isDeleting, user?.uid]);

  const isEpicGame = Boolean(
    game?.launcherType === "epic" || game?.epicCatalogId || game?.epicLaunchId,
  );

  const saveEpicInstallPath = React.useCallback(async (selectedPath: string) => {
    if (!user?.uid || !game?.id) {
      notify(copy.loginToRemove, "error");
      return;
    }
    const cleaned = selectedPath.trim();
    if (!cleaned) return;
    try {
      await updateLibraryGame(user.uid, game.id, {
        executablePath: cleaned,
        updatedAt: new Date().toISOString(),
      });
      await onLibraryChanged?.();
      notify(copy.epicInstallPathSaved, "success");
    } catch {
      notify(copy.epicInstallPathError, "error");
    }
  }, [copy.epicInstallPathError, copy.epicInstallPathSaved, copy.loginToRemove, game?.id, notify, onLibraryChanged, user?.uid]);

  const handleSelectEpicInstallFolder = React.useCallback(async () => {
    if (!game || !isEpicGame) return;
    try {
      const selected = await window.electronAPI?.selectFolder?.(
        `${copy.epicInstallPath} — ${game.title}`,
      );
      if (!selected) return;
      await saveEpicInstallPath(selected);
    } catch {
      notify(copy.epicInstallPathError, "error");
    }
  }, [copy.epicInstallPath, copy.epicInstallPathError, game, isEpicGame, notify, saveEpicInstallPath]);

  const handleSelectEpicExecutable = React.useCallback(async () => {
    if (!game || !isEpicGame) return;
    try {
      const selected = await window.electronAPI?.selectExecutable?.();
      if (!selected) return;
      await saveEpicInstallPath(selected);
    } catch {
      notify(copy.epicInstallPathError, "error");
    }
  }, [copy.epicInstallPathError, game, isEpicGame, notify, saveEpicInstallPath]);

  const handleOpenFolder = React.useCallback(async () => {
    if (!game?.executablePath) {
      notify(copy.epicInstallPathMissing, "warning");
      return;
    }
    try {
      const configuredPath = game.executablePath.trim();
      const targetPath = /\.exe$/i.test(configuredPath)
        ? configuredPath.replace(/[/\\][^/\\]+$/, "")
        : configuredPath;
      await window.electronAPI?.openPath?.(targetPath);
    } catch {
      notify("Não foi possível abrir o diretório do jogo.", "error");
    }
  }, [copy.epicInstallPathMissing, game?.executablePath, notify]);

  const handleVerifyExecutable = React.useCallback(async () => {
    if (!game?.executablePath) {
      notify(copy.verifyNotFound, "error");
      return;
    }
    try {
      const exists = await window.electronAPI?.isExecutableRunning?.(game.executablePath);
      // or check path existence
      notify(copy.verifySuccess, "success");
    } catch {
      notify(copy.verifyNotFound, "error");
    }
  }, [copy.verifyNotFound, copy.verifySuccess, game?.executablePath, notify]);

  const handleSaveLaunchProfile = React.useCallback(async () => {
    if (!user?.uid || !game?.id || state.isSavingLaunchProfile) return;
    dispatch({ type: "SET_SAVING_LAUNCH_PROFILE", payload: true });
    try {
      await updateLibraryGame(user.uid, game.id, {
        launchProfile,
        updatedAt: new Date().toISOString(),
      });
      await onLibraryChanged?.();
      notify("Perfil de inicialização salvo.", "success");
    } catch {
      notify("Não foi possível salvar o perfil de inicialização.", "error");
    } finally {
      dispatch({ type: "SET_SAVING_LAUNCH_PROFILE", payload: false });
    }
  }, [dispatch, game?.id, launchProfile, notify, onLibraryChanged, state.isSavingLaunchProfile, user?.uid]);

  return {
    handleLaunch,
    handleDeleteGame,
    handleOpenFolder,
    handleVerifyExecutable,
    handleSaveLaunchProfile,
    handleSelectEpicInstallFolder,
    handleSelectEpicExecutable,
    handleOpenMods: onOpenMods,
  };
}
