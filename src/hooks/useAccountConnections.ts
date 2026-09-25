import { useCallback, useEffect, useRef, useState } from "react";
import {
  getSteamLinkUrl,
} from "../services/steam";
import {
  disconnectDiscordAccount,
  getDiscordLinkUrl,
} from "../services/discord";
import { usePlatformOperations } from "./usePlatformOperations";
import type { SoundEffectType } from "../hooks/useSoundEffects";
import type { LauncherLanguage } from "../context/PreferencesContext";
import type { UserProfile } from "../types/domain";

interface UseAccountConnectionsProps {
  userUid?: string;
  profile?: UserProfile | null;
  resolvedSteamId?: string | null;
  playSound: (type: SoundEffectType) => void;
  notify: (msg: string, type: "success" | "error" | "info") => void;
  refreshProfile: () => Promise<any>;
  setSelectedIndex: (val: number) => void;
  onLibraryChanged?: () => Promise<void> | void;
  language: LauncherLanguage;
}

export function useAccountConnections({
  userUid,
  profile,
  resolvedSteamId,
  playSound,
  notify,
  refreshProfile,
  setSelectedIndex,
  onLibraryChanged,
  language,
}: UseAccountConnectionsProps) {
  const [steamConnecting, setSteamConnecting] = useState(false);
  const [discordConnecting, setDiscordConnecting] = useState(false);
  const [epicConnecting, setEpicConnecting] = useState(false);

  const steamIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const steamFocusRef = useRef<(() => void) | null>(null);
  const discordIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const discordFocusRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      if (steamIntervalRef.current) {
        clearInterval(steamIntervalRef.current);
        steamIntervalRef.current = null;
      }
      if (steamFocusRef.current) {
        window.removeEventListener("focus", steamFocusRef.current);
        steamFocusRef.current = null;
      }
      if (discordIntervalRef.current) {
        clearInterval(discordIntervalRef.current);
        discordIntervalRef.current = null;
      }
      if (discordFocusRef.current) {
        window.removeEventListener("focus", discordFocusRef.current);
        discordFocusRef.current = null;
      }
    };
  }, []);

  const cancelSteamConnect = useCallback(() => {
    if (steamIntervalRef.current) {
      clearInterval(steamIntervalRef.current);
      steamIntervalRef.current = null;
    }
    if (steamFocusRef.current) {
      window.removeEventListener("focus", steamFocusRef.current);
      steamFocusRef.current = null;
    }
    setSteamConnecting(false);
  }, []);

  const cancelDiscordConnect = useCallback(() => {
    if (discordIntervalRef.current) {
      clearInterval(discordIntervalRef.current);
      discordIntervalRef.current = null;
    }
    if (discordFocusRef.current) {
      window.removeEventListener("focus", discordFocusRef.current);
      discordFocusRef.current = null;
    }
    setDiscordConnecting(false);
  }, []);

  // Polling unificado e inteligente com detecção de foco e cancelamento ágil:
  // Se o usuário abre o navegador, fecha a aba e volta ao app, detectamos o retorno
  // e não o deixamos esperando 60 segundos à toa.
  const startLinkPolling = (
    kind: "steam" | "discord",
    isLinked: (prof: any) => boolean,
    onLinked?: (prof: any) => void,
  ) => {
    const intervalRef = kind === "steam" ? steamIntervalRef : discordIntervalRef;
    const focusRef = kind === "steam" ? steamFocusRef : discordFocusRef;
    const setConnecting = kind === "steam" ? setSteamConnecting : setDiscordConnecting;
    const cancelFn = kind === "steam" ? cancelSteamConnect : cancelDiscordConnect;

    cancelFn();
    setConnecting(true);

    let attempts = 0;
    const maxAttempts = 30;
    let returnToAppAttempts = 0;
    let hasRegainedFocus = false;

    const stop = () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      if (focusRef.current) {
        window.removeEventListener("focus", focusRef.current);
        focusRef.current = null;
      }
      setConnecting(false);
    };

    const check = async () => {
      attempts++;
      if (hasRegainedFocus) {
        returnToAppAttempts++;
      }

      const prof = await refreshProfile();
      const linked = isLinked(prof);

      if (linked) {
        stop();
        if (onLinked) onLinked(prof);
        return;
      }

      // Se o usuário voltou para a janela do aplicativo (focou de volta)
      // e após 6 checagens (~9 segundos no app) a conta ainda não foi conectada,
      // encerramos a espera para o usuário não ficar preso com a aba fechada.
      if (hasRegainedFocus && returnToAppAttempts >= 6) {
        stop();
        notify(
          kind === "steam"
            ? "Conexão Steam cancelada ou não concluída."
            : "Conexão Discord cancelada ou não concluída.",
          "info",
        );
        return;
      }

      if (attempts >= maxAttempts) {
        stop();
      }
    };

    const onFocus = () => {
      hasRegainedFocus = true;
      void check();
    };

    intervalRef.current = setInterval(check, 1500);
    focusRef.current = onFocus;
    window.addEventListener("focus", onFocus);
  };

  const connectSteam = () => {
    if (!userUid) return;
    playSound("select");
    setSteamConnecting(true);

    getSteamLinkUrl()
      .then(async (url) => {
        if (!url) {
          notify("Backend Steam offline.", "error");
          setSteamConnecting(false);
          return;
        }
        try {
          if (window.electronAPI?.openExternalUrl) {
            await window.electronAPI.openExternalUrl(url);
          } else {
            window.open(url, "_blank");
          }
          notify("Navegador aberto! Conecte sua conta Steam e volte ao app.", "info");

          startLinkPolling(
            "steam",
            (prof) => Boolean(prof?.steamId),
            (prof) => {
              notify("Steam conectada com sucesso! Sincronizando jogos...", "info");
              void handleSyncSteam(prof?.steamId);
            },
          );
        } catch {
          notify("Não foi possível abrir o navegador.", "error");
          setSteamConnecting(false);
        }
      })
      .catch((err) => {
        notify(err?.message || "Erro ao conectar Steam.", "error");
        setSteamConnecting(false);
      });
  };

  const connectDiscord = () => {
    if (!userUid) return;
    playSound("select");
    setDiscordConnecting(true);

    getDiscordLinkUrl()
      .then(async (url) => {
        if (!url) {
          notify("Backend Discord offline.", "error");
          setDiscordConnecting(false);
          return;
        }
        try {
          if (window.electronAPI?.openExternalUrl) {
            await window.electronAPI.openExternalUrl(url);
          } else {
            window.open(url, "_blank");
          }
          notify("Navegador aberto! Conecte sua conta Discord e volte ao app.", "info");

          startLinkPolling(
            "discord",
            (prof) => Boolean(prof?.discordId),
            () => {
              notify("Discord conectado com sucesso!", "info");
            },
          );
        } catch (e) {
          notify(
            e instanceof Error
              ? e.message
              : "Não foi possível conectar com o Discord.",
            "error",
          );
          setDiscordConnecting(false);
        }
      })
      .catch((err) => {
        notify(err?.message || "Erro ao conectar Discord.", "error");
        setDiscordConnecting(false);
      });
  };

  const platformOps = usePlatformOperations({
    userUid,
    profile,
    language,
    onRefreshLibrary: async () => {
      await refreshProfile();
      setSelectedIndex(0);
      await onLibraryChanged?.();
    },
    notify,
  });

  const effectiveSteamId = resolvedSteamId || profile?.steamId || (profile as any)?.steam_id;

  const handleSyncSteam = async (overrideSteamId?: string | unknown) => {
    playSound("select");
    const targetSteamId = typeof overrideSteamId === "string" ? overrideSteamId : effectiveSteamId;
    return platformOps.syncPlatform("steam", { steamId: targetSteamId, language });
  };

  const handleSyncEpic = async () => {
    playSound("select");
    return platformOps.syncPlatform("epic", language);
  };

  const handleDisconnectSteam = async () => {
    playSound("back");
    return platformOps.disconnectPlatform("steam");
  };

  const handleDisconnectDiscord = async () => {
    if (!userUid) return;
    try {
      await disconnectDiscordAccount();
      await refreshProfile();
      notify("Discord desconectado.", "success");
    } catch {
      notify("Erro ao desconectar Discord.", "error");
    }
  };

  const handleDisconnectEpic = async () => {
    playSound("back");
    const res = await platformOps.disconnectPlatform("epic");
    await onLibraryChanged?.();
    return res;
  };

  return {
    steamConnecting,
    setSteamConnecting,
    discordConnecting,
    setDiscordConnecting,
    epicConnecting,
    setEpicConnecting,
    steamSyncing: platformOps.operations.steam.status === "syncing",
    epicSyncing: platformOps.operations.epic.status === "syncing",
    platformOperations: platformOps.operations,
    platformOps,
    connectSteam,
    cancelSteamConnect,
    connectDiscord,
    cancelDiscordConnect,
    handleDisconnectSteam,
    handleDisconnectDiscord,
    handleDisconnectEpic,
    handleSyncSteam,
    handleSyncEpic,
  };
}
