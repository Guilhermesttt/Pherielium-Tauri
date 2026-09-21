import { useCallback, useEffect, useReducer, useRef } from "react";
import type {
  Platform,
  PlatformOperationsState,
} from "../types/platformOperations";
import type { LauncherLanguage } from "../context/PreferencesContext";
import type { UserProfile } from "../types/domain";
import {
  createInitialPlatformOperationsState,
  isPlatformBusy,
  platformOperationReducer,
} from "../utils/platformOperationReducer";
import { authenticateEpic, syncEpicLibraryToLocal } from "../services/epic";
import { syncSteamLibraryToLocal } from "../services/steam";
import {
  disconnectPlatform as executeDisconnectPlatform,
  resumePendingPlatformCleanup,
  type PlatformCleanupResult,
} from "../services/platformLifecycle";

interface UsePlatformOperationsProps {
  userUid?: string | null;
  profile?: UserProfile | null;
  language?: LauncherLanguage;
  onRefreshLibrary?: () => void | Promise<void>;
  notify?: (message: string, type: "success" | "error" | "info") => void;
}

export const usePlatformOperations = ({
  userUid,
  profile,
  language = "pt-BR",
  onRefreshLibrary,
  notify,
}: UsePlatformOperationsProps = {}) => {
  const [operations, dispatch] = useReducer(
    platformOperationReducer,
    undefined,
    createInitialPlatformOperationsState,
  );

  const lastOperationRef = useRef<Record<Platform, { kind: "connect" | "sync" | "disconnect"; args?: any } | null>>({
    steam: null,
    epic: null,
  });

  // On mount: check and resume any pending platform cleanup
  useEffect(() => {
    if (!userUid) return;
    let cancelled = false;

    resumePendingPlatformCleanup({ uid: userUid, profile })
      .then((resumed) => {
        if (!cancelled && resumed.length > 0) {
          onRefreshLibrary?.();
          notify?.(
            `Limpeza pendente de ${resumed.join(", ")} concluída.`,
            "info",
          );
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [userUid, profile, onRefreshLibrary, notify]);

  // Connect Epic Account
  const connectEpic = useCallback(
    async (code: string) => {
      if (!userUid) throw new Error("Usuário não autenticado.");
      const platform: Platform = "epic";
      const operationId = crypto.randomUUID();
      lastOperationRef.current[platform] = { kind: "connect", args: code };

      dispatch({
        type: "START_CONNECT",
        platform,
        operationId,
        phase: "authenticating",
      });

      try {
        await authenticateEpic(code);
        try {
          localStorage.setItem("checkpoint_epic_linked_uid", userUid);
        } catch {}
        dispatch({ type: "FINISH_SUCCESS", platform, operationId });
        notify?.("Conta Epic Games conectada com sucesso!", "success");
      } catch (err: any) {
        const message = err?.message || "Falha ao conectar Epic Games.";
        dispatch({
          type: "FAIL_ERROR",
          platform,
          operationId,
          operation: "connect",
          message,
        });
        notify?.(message, "error");
        throw err;
      }
    },
    [userUid, notify],
  );

  // Sync Platform (Steam or Epic)
  const syncPlatform = useCallback(
    async (platform: Platform, args?: any) => {
      if (!userUid) throw new Error("Usuário não autenticado.");
      const operationId = crypto.randomUUID();
      const effectiveLang = (typeof args === "string" ? args : args?.language) || language;
      lastOperationRef.current[platform] = { kind: "sync", args };

      dispatch({
        type: "START_SYNC",
        platform,
        operationId,
        phase: "reading-library",
      });

      try {
        let count = 0;
        if (platform === "epic") {
          // Listen to native progress if available
          const unsubscribe = window.electronAPI?.onEpicProgress?.((progress) => {
            dispatch({
              type: "UPDATE_PHASE",
              platform: "epic",
              operationId,
              phase: progress.phase as any,
              completed: progress.completed,
              total: progress.total,
            });
          });

          try {
            count = await syncEpicLibraryToLocal(userUid, effectiveLang);
          } finally {
            unsubscribe?.();
          }
        } else {
          let targetSteamId =
            (typeof args === "object" ? args?.steamId : null) ||
            profile?.steamId ||
            (profile as any)?.steam_id ||
            "";

          if (!targetSteamId && userUid) {
            try {
              const cached = localStorage.getItem(`phelierium_profile_cache_${userUid}`);
              if (cached) {
                const parsed = JSON.parse(cached);
                targetSteamId = parsed.steamId || parsed.steam_id || "";
              }
            } catch {}
          }

          // Sincroniza jogos da Steam (remotos caso Steam ID exista, e locais instalados no PC)
          count = await syncSteamLibraryToLocal(userUid, targetSteamId, effectiveLang);
        }

        dispatch({ type: "FINISH_SUCCESS", platform, operationId });
        await onRefreshLibrary?.();

        const platformTitle = platform === "steam" ? "Steam" : "Epic Games";
        const message =
          count > 0
            ? `${count} jogo(s) da ${platformTitle} sincronizado(s)!`
            : `Nenhum novo jogo retornado da ${platformTitle}.`;
        notify?.(message, count > 0 ? "success" : "info");

        return count;
      } catch (err: any) {
        const message =
          (typeof err === "string" ? err : err?.message) ||
          `Falha na sincronização ${platform}.`;
        dispatch({
          type: "FAIL_ERROR",
          platform,
          operationId,
          operation: "sync",
          message,
        });
        notify?.(message, "error");
        throw err;
      }
    },
    [userUid, language, onRefreshLibrary, notify],
  );

  // Disconnect Platform
  const disconnectPlatform = useCallback(
    async (platform: Platform): Promise<PlatformCleanupResult> => {
      if (!userUid) throw new Error("Usuário não autenticado.");
      const operationId = crypto.randomUUID();
      lastOperationRef.current[platform] = { kind: "disconnect" };

      dispatch({
        type: "START_DISCONNECT",
        platform,
        operationId,
        phase: "revoking-account",
      });

      try {
        const result = await executeDisconnectPlatform({
          uid: userUid,
          platform,
          operationId,
          profile,
          onPhaseChange: (phase) => {
            dispatch({
              type: "UPDATE_PHASE",
              platform,
              operationId,
              phase,
            });
          },
        });

        dispatch({ type: "FINISH_SUCCESS", platform, operationId });
        await onRefreshLibrary?.();

        const platformTitle = platform === "steam" ? "Steam" : "Epic Games";
        notify?.(`${platformTitle} desconectada e jogos removidos.`, "success");
        return result;
      } catch (err: any) {
        const message = err?.message || `Erro ao desconectar ${platform}.`;
        dispatch({
          type: "FAIL_ERROR",
          platform,
          operationId,
          operation: "disconnect",
          message,
        });
        notify?.(message, "error");
        throw err;
      }
    },
    [userUid, profile, onRefreshLibrary, notify],
  );

  // Retry last failed operation
  const retryPlatform = useCallback(
    async (platform: Platform) => {
      const last = lastOperationRef.current[platform];
      if (!last) return;

      if (last.kind === "connect") {
        await connectEpic(last.args);
      } else if (last.kind === "sync") {
        await syncPlatform(platform, last.args);
      } else if (last.kind === "disconnect") {
        await disconnectPlatform(platform);
      }
    },
    [connectEpic, syncPlatform, disconnectPlatform],
  );

  const resetPlatform = useCallback((platform: Platform) => {
    dispatch({ type: "RESET", platform });
  }, []);

  const isAnyBusy =
    isPlatformBusy(operations, "steam") || isPlatformBusy(operations, "epic");

  return {
    operations,
    connectEpic,
    syncPlatform,
    disconnectPlatform,
    retryPlatform,
    resetPlatform,
    isAnyBusy,
    isPlatformBusy: (platform: Platform) => isPlatformBusy(operations, platform),
  };
};
