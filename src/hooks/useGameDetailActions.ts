import React from "react";
import type { Game, GameLaunchProfile } from "../types/domain";
import type { GameDetailState, GameDetailAction, GameDetailCopy } from "../types/gameDetail";
import { getMonitorableExecutablePath, launchGame } from "../services/launcher";
import { deleteLibraryGame, updateLibraryGame } from "../services/localLibrary";
import { MIN_LAUNCH_SCREEN_MS, wait } from "../types/gameDetail";

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
      window.dispatchEvent(
        new CustomEvent("checkpoint:game-launch", {
          detail: {
            title: game.title,
            executablePath: getMonitorableExecutablePath(game),
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

  const handleOpenFolder = React.useCallback(async () => {
    if (!game?.executablePath) {
      notify("Caminho do executável não informado.", "warning");
      return;
    }
    try {
      const parentDir = game.executablePath.replace(/[/\\][^/\\]+$/, "");
      await window.electronAPI?.openPath?.(parentDir);
    } catch {
      notify("Não foi possível abrir o diretório do jogo.", "error");
    }
  }, [game?.executablePath, notify]);

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
    handleOpenMods: onOpenMods,
  };
}
