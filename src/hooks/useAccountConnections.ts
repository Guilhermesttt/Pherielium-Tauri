import { useEffect, useRef, useState } from "react";
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

  // Polling da vinculação (reaproveitado pelos fluxos Electron e web):
  // abre a URL, avisa e aguarda o perfil ganhar steamId/discordId.
  const pollProfileLink = (
    kind: "steam" | "discord",
    isLinked: (prof: any) => boolean,
    onLinked?: () => void,
  ) => {
    const intervalRef = kind === "steam" ? steamIntervalRef : discordIntervalRef;
    const focusRef = kind === "steam" ? steamFocusRef : discordFocusRef;
    const setConnecting = kind === "steam" ? setSteamConnecting : setDiscordConnecting;
    let attempts = 0;
    const maxAttempts = 40;

    const check = async () => {
      attempts++;
      const prof = await refreshProfile();
      const linked = isLinked(prof);
      if (linked || attempts >= maxAttempts) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = null;
        if (focusRef.current) {
          window.removeEventListener("focus", focusRef.current);
          focusRef.current = null;
        }
        setConnecting(false);
        if (linked) onLinked?.();
      }
    };

    const onFocus = () => {
      void check();
    };

    if (intervalRef.current) clearInterval(intervalRef.current);
    if (focusRef.current) window.removeEventListener("focus", focusRef.current);
    intervalRef.current = setInterval(check, 1500);
    focusRef.current = onFocus;
    window.addEventListener("focus", onFocus);
  };

  const connectSteam = () => {
    if (!userUid) return;
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
            notify("Navegador aberto! Conecte sua conta Steam e volte ao app.", "info");

            let attempts = 0;
            const maxAttempts = 40;

            const checkSteam = async () => {
              attempts++;
              const prof = await refreshProfile();
              if (prof?.steamId || attempts >= maxAttempts) {
                if (steamIntervalRef.current) clearInterval(steamIntervalRef.current);
                steamIntervalRef.current = null;
                if (steamFocusRef.current) window.removeEventListener("focus", steamFocusRef.current);
                steamFocusRef.current = null;
                setSteamConnecting(false);
                if (prof?.steamId) {
                  notify("Steam conectada com sucesso! Sincronizando jogos...", "info");
                  void handleSyncSteam(prof.steamId);
                }
              }
            };

            const onFocus = () => {
              void checkSteam();
            };

            if (steamIntervalRef.current) clearInterval(steamIntervalRef.current);
            if (steamFocusRef.current) window.removeEventListener("focus", steamFocusRef.current);
            steamIntervalRef.current = setInterval(checkSteam, 1500);
            steamFocusRef.current = onFocus;
            window.addEventListener("focus", onFocus);
          } else {
            // Web (sem Electron): mesma espera do fluxo desktop — o loader
            // fica visível enquanto o usuário conclui o login na outra aba.
            window.open(url, "_blank");
            notify("Navegador aberto! Conecte sua conta Steam e volte ao app.", "info");
            pollProfileLink("steam", (prof) => Boolean(prof?.steamId), () => {
              notify("Steam conectada com sucesso! Sincronizando jogos...", "info");
              void handleSyncSteam();
            });
          }
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
            notify(
              "Navegador aberto! Conecte sua conta Discord e volte ao app.",
              "info",
            );

            let attempts = 0;
            const maxAttempts = 40;

            const checkDiscord = async () => {
              attempts++;
              const prof = await refreshProfile();
              if (prof?.discordId || attempts >= maxAttempts) {
                if (discordIntervalRef.current)
                  clearInterval(discordIntervalRef.current);
                discordIntervalRef.current = null;
                if (discordFocusRef.current)
                  window.removeEventListener("focus", discordFocusRef.current);
                discordFocusRef.current = null;
                setDiscordConnecting(false);
              }
            };

            const onFocus = () => {
              void checkDiscord();
            };

            discordIntervalRef.current = setInterval(checkDiscord, 1500);
            discordFocusRef.current = onFocus;
            window.addEventListener("focus", onFocus);
          } else {
            // Web: aguarda como no desktop (antes o estado travava em true).
            window.open(url, "_blank");
            notify(
              "Navegador aberto! Conecte sua conta Discord e volte ao app.",
              "info",
            );
            pollProfileLink("discord", (prof) => Boolean(prof?.discordId));
          }
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
    return platformOps.disconnectPlatform("epic");
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
    connectDiscord,
    handleDisconnectSteam,
    handleDisconnectDiscord,
    handleDisconnectEpic,
    handleSyncSteam,
    handleSyncEpic,
  };
}
