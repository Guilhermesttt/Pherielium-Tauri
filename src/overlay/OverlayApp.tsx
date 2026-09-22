import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy,
  Users,
  MessageSquare,
  Gamepad2,
  Camera,
  Settings,
  X,
  Sparkles,
  Send,
  Loader2,
  ZoomIn,
  Phone,
  PhoneOff,
  UserPlus,
  ChevronLeft,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  FolderOpen,
  Gauge,
  BellOff,
  Contrast,
  Trash2,
} from "lucide-react";

import achievementUnlockDefault from "../sounds/Phelierium Default/Achievment_Unlock.mp3";
import achievementUnlockGold from "../sounds/Phelierium Default/Achievment_Unlock_Gold.mp3";
import achievementUnlockPlatinum from "../sounds/Phelierium Default/Achievment_Unlock_Platinum.mp3";
import { soundThemes } from "../hooks/useSoundEffects";
import { Button } from "@/components/ui/Shandc/button";
import { useGamepadButton } from "../context/GamepadContext";
import { useGamepadFocusNavigation } from "../hooks/useGamepadFocusNavigation";
import { invoke } from "@tauri-apps/api/core";
import { AchievementToastCard } from "./components/AchievementToastCard";
import { SocialToastCard } from "./components/SocialToastCard";
import { normalizeSocialToast } from "./socialToast";
import { WelcomeToastCard } from "./components/WelcomeToastCard";
import { CaptureToastCard } from "./components/CaptureToastCard";
import { OverlayToggle } from "./components/OverlayToggle";
import { PerfMonitorHud } from "../components/performance/PerfMonitorHud";
import { usePerfMonitor } from "../hooks/usePerfMonitor";
import {
  loadOverlayPrefs,
  onOverlayPrefsChanged,
  saveOverlayPrefs,
  formatShortcutLabel,
  shortcutFromKeyboardEvent,
  type OverlayPrefs,
} from "../lib/overlayPrefs";
import type { AchievementNotificationPosition } from "../types/overlay";
import { getOverlayThemeTokens } from "../constants/overlayTheme";

// ─── Logger Estruturado ────────────────────────────────────────────────────────
const overlayLogger = {
  info: (...args: unknown[]) => console.info("[overlay:app]", ...args),
  warn: (...args: unknown[]) => console.warn("[overlay:app]", ...args),
  error: (...args: unknown[]) => console.error("[overlay:app]", ...args),
};

// ─── Tipos do Assistente por Estados ──────────────────────────────────────────
type OverlayCapture = {
  id: string;
  url: string;
  name?: string;
  gameTitle?: string;
  path?: string;
};

type ShortcutRecording = null | "capture" | "overlay";
export type OverlayMode = "passive" | "quick" | "full";
export type OverlayView = "home" | "friends" | "chat" | "achievements" | "call" | "media" | "settings";
export type InteractionSource = "keyboard" | "gamepad" | "mouse";
export type CallConnectionState = "connected" | "degraded" | "reconnecting" | "failed";

export interface AchievementToast {
  id: string;
  kind: "achievement";
  title: string;
  description: string;
  icon?: string;
  isPreview?: boolean;
  gameTitle?: string;
  percent?: number;
  unlockedAt?: string;
  tier?: "platinum" | "gold" | "silver" | "bronze" | "iron";
  xpGained?: number;
  currentLevel?: number;
  currentXP?: number;
}

export interface SocialToast {
  id: string;
  kind:
    | "friend-playing"
    | "friend-request"
    | "friend-accepted"
    | "message"
    | "capture"
    | "hint"
    | "incoming-call"
    | "success"
    | "error"
    | "info"
    | string;
  title: string;
  /** Nome do remetente — vira o título grande do card. */
  senderName?: string;
  subtitle?: string;
  description?: string;
  avatar?: string;
  message?: string;
  contentKind?: string;
  gameTitle?: string;
  screenshotUrl?: string;
  callerUid?: string;
  friendId?: string;
  messageCount?: number;
}

export type AnyOverlayToast = AchievementToast | SocialToast;

export interface OverlayChatMessage {
  id: string;
  text: string;
  attachmentUrl?: string;
  attachmentName?: string;
  createdAt: string;
  mine: boolean;
  pending?: boolean;
}

export interface OverlayChatSession {
  friendId: string;
  friendName: string;
  friendAvatar?: string;
  typing?: boolean;
  sending?: boolean;
  error?: string;
  messages: OverlayChatMessage[];
}

export interface ActiveCallState {
  active: boolean;
  friendId?: string;
  friendName?: string;
  friendAvatar?: string;
  muted?: boolean;
  deafened?: boolean;
  connectionState?: CallConnectionState;
  durationSeconds?: number;
}

export interface CommandPanelState {
  gameTitle?: string;
  userDisplay?: string;
  userAvatar?: string;
  playerLevel?: number | any;
  playerXP?: number;
  playerNextLevelXP?: number;
  playingGame?: any;
  currentGame?: any;
  profile?: {
    name?: string;
    avatar?: string;
    discordConnected?: boolean;
    discordUsername?: string;
    achievements?: number;
  };
  achievements?: any;
  friends?: any[];
  chat?: OverlayChatSession | null;
  activeCall?: ActiveCallState | null;
  screenshots?: string[];
  captures?: Array<{ id: string; url: string; name?: string; gameTitle?: string }>;
  settings?: {
    achievementVolume?: number;
    achievementSoundTheme?: string;
    achievementNotificationsEnabled?: boolean;
    achievementNotificationPosition?: AchievementNotificationPosition;
    visualTheme?: string;
    themeAccent?: string;
    autoContrast?: boolean;
    muteSocial?: boolean;
    muteAllToasts?: boolean;
    fluidAnimations?: boolean;
    perfMonitor?: boolean;
  };
}

function getInitialStoredProfile(): { userDisplay: string; userAvatar: string } {
  try {
    const sessionStr = localStorage.getItem("phelierium_auth_session");
    let uid = "";
    if (sessionStr) {
      try {
        const parsed = JSON.parse(sessionStr);
        uid = parsed?.uid || "";
      } catch {
        /* ignore */
      }
    }
    const customName = uid ? localStorage.getItem(`phelierium_custom_display_name_${uid}`) : null;
    const customAvatar = uid ? localStorage.getItem(`phelierium_custom_avatar_${uid}`) : null;
    return {
      userDisplay: customName || "",
      userAvatar: customAvatar || "",
    };
  } catch {
    return { userDisplay: "", userAvatar: "" };
  }
}

function normalizeSoundTheme(theme: string): string {
  if (theme === "playstation") return "ps2";
  if (theme === "phelierium") return "default";
  return theme;
}

function playThemedClip(
  src: string | undefined,
  volume: number,
  label: string,
) {
  if (!src) return;
  try {
    const audio = new Audio(src);
    audio.volume = Math.max(0, Math.min(1, volume));
    audio.play().catch((e) => overlayLogger.warn(`Falha ao tocar som (${label}):`, e));
  } catch (err) {
    overlayLogger.warn(`Audio error (${label}):`, err);
  }
}

// ─── Gerenciamento de Sons ─────────────────────────────────────────────────────
const playOverlaySound = (
  type:
    | "unlock"
    | "welcome"
    | "toast"
    | "toggle"
    | "unlockGold"
    | "unlockPlatinum"
    | "notification"
    | "hover"
    | "select"
    | "switchOn"
    | "switchOff"
    | "call"
    | "screenshot",
  theme = "default",
  volume = 0.35,
) => {
  const normalizedTheme = normalizeSoundTheme(theme);
  const themeSounds = (soundThemes as Record<string, Record<string, string>>)[normalizedTheme] || soundThemes.default;

  const src =
    type === "unlockPlatinum"
      ? (themeSounds.overlayAchievementPlatinum || achievementUnlockPlatinum)
      : type === "unlockGold"
        ? (themeSounds.overlayAchievementGold || themeSounds.overlayAchievement || achievementUnlockGold)
        : type === "unlock"
          ? (themeSounds.overlayAchievement || achievementUnlockDefault)
          : type === "welcome"
            ? (themeSounds.play || themeSounds.notification)
            : type === "toast" || type === "notification"
              ? (themeSounds.notification || themeSounds.chatReceived)
              : type === "hover"
                ? (themeSounds.hover || themeSounds.navigate)
                : type === "select"
                  ? (themeSounds.select || themeSounds.navigate)
                  : type === "switchOn"
                    ? (themeSounds.switchOn || themeSounds.select)
                    : type === "switchOff"
                      ? (themeSounds.switchOff || themeSounds.select)
                      : type === "call"
                        ? (themeSounds.callEnter || themeSounds.notification)
                        : type === "screenshot"
                          ? (themeSounds.screenshot || themeSounds.notification)
                          : (themeSounds.select || themeSounds.showModal);

  playThemedClip(src, type === "hover" ? volume * 0.45 : volume * 0.85, type);
};

// ─── Componente Principal ──────────────────────────────────────────────────────
const OverlayApp: React.FC = () => {
  const [overlayMode, setOverlayMode] = useState<OverlayMode>("passive");
  const [activeView, setActiveView] = useState<OverlayView>("home");
  const [interactionSource, setInteractionSource] = useState<InteractionSource>("mouse");
  const [panelData, setPanelData] = useState<CommandPanelState>(() => {
    let achievementVolume = 22;
    try {
      const raw = localStorage.getItem("checkpoint_achievement_volume_global");
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) {
        achievementVolume = Math.min(100, Math.max(0, Math.round(parsed)));
      }
    } catch {
      /* ignore */
    }
    const stored = getInitialStoredProfile();
    return {
      userDisplay: stored.userDisplay || undefined,
      userAvatar: stored.userAvatar || undefined,
      settings: { achievementVolume },
    };
  });
  const [toasts, setToasts] = useState<AnyOverlayToast[]>([]);
  const [inputText, setInputText] = useState("");
  const [viewingCapture, setViewingCapture] = useState<OverlayCapture | null>(null);
  const [confirmDeleteCapture, setConfirmDeleteCapture] = useState(false);
  const [activeCall, setActiveCall] = useState<ActiveCallState | null>(null);
  const [captures, setCaptures] = useState<OverlayCapture[]>([]);
  const [capturesLoading, setCapturesLoading] = useState(false);
  const perfHud = usePerfMonitor();

  const [autoContrast, setAutoContrast] = useState(false);
  const [muteSocial, setMuteSocial] = useState(false);
  const [muteAllToasts, setMuteAllToasts] = useState(false);
  const [fluidAnimations, setFluidAnimations] = useState(true);
  const [perfMonitor, setPerfMonitor] = useState(false);
  const [achievementToastsEnabled, setAchievementToastsEnabled] = useState(true);
  const [captureShortcut, setCaptureShortcut] = useState("F8");
  const [overlayShortcut, setOverlayShortcut] = useState("Ctrl+Shift+O");
  const [recordingShortcut, setRecordingShortcut] = useState<ShortcutRecording>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const applyOverlayPrefs = useCallback((prefs: OverlayPrefs) => {
    setAchievementToastsEnabled(prefs.achievements);
    setMuteSocial(!prefs.social);
    setFluidAnimations(prefs.fluidAnimations);
    setAutoContrast(prefs.highContrast);
    setMuteAllToasts(prefs.muteAll);
    setPerfMonitor(prefs.perfMonitor);
    setCaptureShortcut(prefs.captureShortcut);
    setOverlayShortcut(prefs.overlayShortcut);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadOverlayPrefs().then((prefs) => {
      if (!cancelled) applyOverlayPrefs(prefs);
    });
    const stop = onOverlayPrefsChanged((prefs) => applyOverlayPrefs(prefs));
    return () => {
      cancelled = true;
      stop();
    };
  }, [applyOverlayPrefs]);

  const panelDataRef = useRef<CommandPanelState>(panelData);
  useEffect(() => {
    panelDataRef.current = panelData;
  }, [panelData]);

  const overlayTheme = useCallback(() => {
    return panelDataRef.current?.settings?.achievementSoundTheme || "default";
  }, []);

  const overlayVol = useCallback(() => {
    const raw = panelDataRef.current?.settings?.achievementVolume;
    return typeof raw === "number" ? raw / 100 : 0.35;
  }, []);

  const overlaySfx = useCallback(
    (type: Parameters<typeof playOverlaySound>[0], volumeScale = 1) => {
      playOverlaySound(type, overlayTheme(), overlayVol() * volumeScale);
    },
    [overlayTheme, overlayVol],
  );

  const toastTimersRef = useRef<Map<string, number>>(new Map());
  const chatMessagesEndRef = useRef<HTMLDivElement | null>(null);

  // ─── Toast Manager Centralizado ──────────────────────────────────────────────
  const removeToast = useCallback((id: string) => {
    const timer = toastTimersRef.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      toastTimersRef.current.delete(id);
    }
    setToasts((prev) => {
      const remaining = prev.filter((t) => t.id !== id);
      if (remaining.length === 0) {
        (window as any).achievementOverlay?.panelAction?.({ kind: "toasts-cleared" });
      }
      return remaining;
    });
  }, []);

  const addToast = useCallback(
    (toast: AnyOverlayToast, durationMs = 5000) => {
      if (muteAllToasts) return;
      if (
        toast.kind === "achievement"
        && (
          panelDataRef.current.settings?.achievementNotificationsEnabled === false
          || !achievementToastsEnabled
        )
      ) {
        return;
      }
      if (
        muteSocial
        && toast.kind !== "achievement"
        && toast.kind !== "game-start"
        && toast.kind !== "hint"
        && toast.kind !== "incoming-call"
        && toast.kind !== "call"
        && toast.kind !== "capture"
        && toast.kind !== "capture-saved"
      ) {
        return;
      }

      // Agrupamento inteligente para mensagens repetidas do mesmo amigo
      if (toast.kind === "message" && "friendId" in toast && toast.friendId) {
        setToasts((prev) => {
          const existing = prev.find((t) => t.kind === "message" && (t as SocialToast).friendId === toast.friendId) as
            | SocialToast
            | undefined;
          if (existing) {
            const count = (existing.messageCount || 1) + 1;
            const updated: SocialToast = {
              ...existing,
              title: `${toast.title} (${count})`,
              message: (toast as SocialToast).message,
              messageCount: count,
            };
            return prev.map((t) => (t.id === existing.id ? updated : t));
          }
          return [...prev, toast];
        });
      } else {
        setToasts((prev) => [...prev, toast]);
      }

      const timerId = window.setTimeout(() => {
        removeToast(toast.id);
      }, durationMs);
      toastTimersRef.current.set(toast.id, timerId);
    },
    [muteAllToasts, muteSocial, achievementToastsEnabled, removeToast]
  );

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      toastTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      toastTimersRef.current.clear();
    };
  }, []);

  // Click-through seletivo:
  // - painel quick/full ou barra de chamada → captura cursor
  // - toasts com ações → watch de cursor + hit-test (só captura em cima do toast)
  // - resto → desktop livre
  const hasInteractiveToasts = toasts.some(
    (t) =>
      t.kind === "incoming-call"
      || t.kind === "call"
      || t.kind === "message"
      || t.kind === "friend-message"
      || t.kind === "friend-request"
      || t.kind === "achievement",
  );
  const fullCapturesCursor = overlayMode === "full";
  const hasHitTestTargets =
    overlayMode === "quick" || Boolean(activeCall?.active) || hasInteractiveToasts;

  useEffect(() => {
    if (fullCapturesCursor) {
      void invoke("overlay_set_cursor_watch", { enabled: false }).catch(() => undefined);
      void invoke("overlay_set_ignore_cursor_events", { ignore: false }).catch((err) =>
        overlayLogger.warn("Falha ao ajustar cursor do overlay:", err),
      );
      return;
    }

    if (!hasHitTestTargets) {
      void invoke("overlay_set_cursor_watch", { enabled: false }).catch(() => undefined);
      void invoke("overlay_set_ignore_cursor_events", { ignore: true }).catch(() => undefined);
      return;
    }

    let cancelled = false;
    let lastIgnore: boolean | null = null;
    const setIgnore = (ignore: boolean) => {
      if (lastIgnore === ignore) return;
      lastIgnore = ignore;
      void invoke("overlay_set_ignore_cursor_events", { ignore }).catch(() => undefined);
    };

    void invoke("overlay_set_cursor_watch", { enabled: true }).catch(() => undefined);
    setIgnore(true);

    let unlisten: (() => void) | undefined;
    void import("@tauri-apps/api/event").then(({ listen }) => {
      if (cancelled) return;
      void listen<{ x: number; y: number }>("overlay:cursor", (event) => {
        if (cancelled) return;
        const { x, y } = event.payload;
        const el = document.elementFromPoint(x, y);
        const hit = Boolean(el?.closest("[data-overlay-interactive]"));
        setIgnore(!hit);
      }).then((fn) => {
        if (cancelled) {
          fn();
          return;
        }
        unlisten = fn;
      });
    });

    const onLeaveInteractive = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest?.("[data-overlay-interactive]")) return;
      // Leaving a hitbox while capturing → restore click-through; watch will re-enable if needed.
      setIgnore(true);
    };
    document.addEventListener("pointerleave", onLeaveInteractive, true);

    return () => {
      cancelled = true;
      unlisten?.();
      document.removeEventListener("pointerleave", onLeaveInteractive, true);
      void invoke("overlay_set_cursor_watch", { enabled: false }).catch(() => undefined);
      void invoke("overlay_set_ignore_cursor_events", { ignore: true }).catch(() => undefined);
    };
  }, [fullCapturesCursor, hasHitTestTargets]);

  // ─── Conexão com IPC nativo do Electron ──────────────────────────────────────
  useEffect(() => {
    const api = (window as any).achievementOverlay;
    if (!api) {
      overlayLogger.warn("API achievementOverlay não encontrada.");
      return;
    }

    const unbindUnlock = api.onUnlock?.((payload: any) => {
      const percent = payload.percent ?? 50;
      const tierFromPayload = payload.tier as AchievementToast["tier"] | undefined;
      const tier: AchievementToast["tier"] =
        tierFromPayload
        || (percent <= 5 ? "platinum" : percent <= 20 ? "gold" : percent <= 50 ? "silver" : "bronze");
      const xpMap = { platinum: 90, gold: 60, silver: 30, bronze: 15, iron: 0 };
      const xpGained = payload.xpGained ?? xpMap[tier] ?? 50;
      const icon = typeof payload.icon === "string" ? payload.icon.trim() : "";

      const toast: AchievementToast = {
        id: String(Date.now() + Math.random()),
        kind: "achievement",
        title: payload.title || "Conquista Desbloqueada",
        description: payload.description || "",
        icon: icon || undefined,
        isPreview: Boolean(payload.isTest),
        gameTitle: payload.gameTitle,
        percent: payload.percent,
        unlockedAt: payload.unlockedAt,
        tier,
        xpGained,
        currentLevel: payload.currentLevel,
        currentXP: payload.currentXP,
      };
      playOverlaySound(
        tier === "platinum" ? "unlockPlatinum" : tier === "gold" ? "unlockGold" : "unlock",
        panelDataRef.current?.settings?.achievementSoundTheme || "default",
        typeof panelDataRef.current?.settings?.achievementVolume === "number"
          ? panelDataRef.current.settings.achievementVolume / 100
          : 0.5,
      );
      addToast(toast, 6500);
    });

    const unbindPlaySound = api.onPlaySound?.(({ sound, volume, theme }: any) => {
      const vol = typeof volume === "number" ? volume / 100 : 0.35;
      const t = theme || panelDataRef.current?.settings?.achievementSoundTheme || "default";
      if (sound === "achievement-unlock-platinum") {
        playOverlaySound("unlockPlatinum", t, vol);
      } else if (sound === "achievement-unlock-gold") {
        playOverlaySound("unlockGold", t, vol);
      } else if (sound === "achievement-unlock") {
        playOverlaySound("unlock", t, vol);
      } else if (sound === "screenshot") {
        playOverlaySound("screenshot", t, vol);
      }
    });

    const unbindWelcome = api.onWelcome?.((payload: any) => {
      const toast: SocialToast = {
        id: String(Date.now() + Math.random()),
        kind: "game-start",
        title: "Divirta-se",
        description: payload.gameTitle
          ? `Jogando ${payload.gameTitle}`
          : "O overlay está ativo enquanto você joga.",
        avatar: payload.userAvatar,
      };
      playOverlaySound("welcome", panelDataRef.current?.settings?.achievementSoundTheme || "default", typeof panelDataRef.current?.settings?.achievementVolume === "number" ? panelDataRef.current.settings.achievementVolume / 100 : 0.35);
      addToast(toast, 6000);
    });

    const unbindSocial = api.onSocial?.((payload: any) => {
      if (payload?.kind === "dismiss") {
        if (payload.dismissAll) {
          toastTimersRef.current.forEach((timer) => window.clearTimeout(timer));
          toastTimersRef.current.clear();
          setToasts([]);
          (window as any).achievementOverlay?.panelAction?.({ kind: "toasts-cleared" });
        } else if (payload.notificationId) {
          const targetId = String(payload.notificationId);
          setToasts((prev) => {
            const exact = prev.some((t) => t.id === targetId);
            const remaining = exact
              ? prev.filter((t) => t.id !== targetId)
              : prev.filter((t) => t.kind !== "incoming-call" && t.kind !== "call");
            if (remaining.length === 0) {
              (window as any).achievementOverlay?.panelAction?.({ kind: "toasts-cleared" });
            }
            return remaining;
          });
        } else {
          setToasts((prev) => {
            const remaining = prev.filter((t) => t.kind !== "incoming-call" && t.kind !== "call");
            if (remaining.length === 0) {
              (window as any).achievementOverlay?.panelAction?.({ kind: "toasts-cleared" });
            }
            return remaining;
          });
        }
        return;
      }
      const normalized = normalizeSocialToast(payload, panelDataRef.current.friends || []);
      const kind = normalized.kind;
      const isGameStart = kind === "game-start";
      const toast: SocialToast = {
        id: String(payload?.notificationId || payload?.id || Date.now() + Math.random()),
        ...normalized,
        title: isGameStart ? (payload.title || "Divirta-se") : normalized.title,
        description: isGameStart
          ? (payload.description || "O overlay está ativo enquanto você joga.")
          : normalized.description,
      };
      if (!isGameStart) {
        playOverlaySound(
          kind === "incoming-call" || kind === "call"
            ? "call"
            : kind === "capture" || kind === "capture-saved"
              ? "screenshot"
              : "toast",
          panelDataRef.current?.settings?.achievementSoundTheme || "default",
          typeof panelDataRef.current?.settings?.achievementVolume === "number"
            ? panelDataRef.current.settings.achievementVolume / 100
            : 0.35,
        );
      }
      addToast(
        toast,
        kind === "incoming-call" || kind === "call"
          ? 30000
          : kind === "friend-request"
            ? 12000
            : isGameStart
              ? 6000
              : 7000,
      );
    });

    const mergePanelState = (prev: CommandPanelState, payload: any): CommandPanelState => {
      if (!payload || typeof payload !== "object") return prev;

      const activeGame = payload.playingGame !== undefined
        ? payload.playingGame
        : (payload.currentGame !== undefined ? payload.currentGame : prev.playingGame);

      const title = payload.gameTitle !== undefined
        ? payload.gameTitle
        : (activeGame?.title || (payload.currentGame === null || payload.playingGame === null ? "" : prev.gameTitle));

      const displayName = payload.userDisplay || payload.profile?.name || prev.userDisplay;
      const avatar = payload.userAvatar || payload.profile?.avatar || prev.userAvatar;
      const friendsList = payload.friends !== undefined ? payload.friends : prev.friends;
      const achievements = payload.achievements !== undefined ? payload.achievements : prev.achievements;

      return {
        ...prev,
        ...payload,
        userDisplay: displayName,
        userAvatar: avatar,
        gameTitle: title,
        playingGame: activeGame ? {
          ...activeGame,
          title: title || activeGame.title,
          image: activeGame.image || activeGame.backgroundImage || activeGame.cardImage,
          sessionStartedAt: activeGame.sessionStartedAt || prev.playingGame?.sessionStartedAt,
        } : (payload.currentGame === null || payload.playingGame === null ? undefined : prev.playingGame),
        friends: friendsList,
        achievements,
        settings: {
          ...prev.settings,
          ...(payload?.settings || {}),
        },
      };
    };

    // Requisita snapshot de inicialização do painel no Tauri
    void invoke<any>("overlay_get_panel_state")
      .then((state) => {
        if (state && typeof state === "object" && Object.keys(state).length > 0) {
          setPanelData((prev) => mergePanelState(prev, state));
          if (state.activeCall !== undefined) setActiveCall(state.activeCall);
        }
      })
      .catch(() => undefined);

    const unbindVisibility = api.onPanelVisibility?.((payload: any) => {
      const shouldOpen = Boolean(payload.open || payload.visible);
      if (shouldOpen) {
        setOverlayMode((prev) => (prev === "passive" ? "quick" : prev));
        // Garante que o painel consulte o estado atualizado ao ser aberto
        void invoke<any>("overlay_get_panel_state")
          .then((state) => {
            if (state && typeof state === "object" && Object.keys(state).length > 0) {
              setPanelData((prev) => mergePanelState(prev, state));
              if (state.activeCall !== undefined) setActiveCall(state.activeCall);
            }
          })
          .catch(() => undefined);
      } else {
        setOverlayMode("passive");
      }
      if (payload.state) {
        setPanelData((prev) => mergePanelState(prev, payload.state));
        if (payload.state.activeCall) setActiveCall(payload.state.activeCall);
      }
    });

    const unbindState = api.onPanelState?.((payload: any) => {
      setPanelData((prev) => mergePanelState(prev, payload));
      if (payload.activeCall !== undefined) setActiveCall(payload.activeCall);
    });

    const unbindCommand = api.onPanelCommand?.((payload: any) => {
      playOverlaySound("select", panelDataRef.current?.settings?.achievementSoundTheme || "default", typeof panelDataRef.current?.settings?.achievementVolume === "number" ? panelDataRef.current.settings.achievementVolume / 100 : 0.35);
      if (payload.kind === "open-chat") {
        setOverlayMode("full");
        setActiveView("chat");
      } else if (payload.kind === "toggle") {
        setOverlayMode((prev) => (prev === "passive" ? "quick" : "passive"));
      } else if (payload.kind === "expand") {
        setOverlayMode("full");
      }
    });

    return () => {
      unbindUnlock?.();
      unbindPlaySound?.();
      unbindWelcome?.();
      unbindSocial?.();
      unbindVisibility?.();
      unbindState?.();
      unbindCommand?.();
    };
  }, [addToast, removeToast]);

  // Scroll chat messages to bottom
  useEffect(() => {
    if (activeView === "chat" && panelData.chat?.messages?.length) {
      chatMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeView, panelData.chat?.messages]);

  const loadCaptures = useCallback(async () => {
    setCapturesLoading(true);
    try {
      const items = await invoke<OverlayCapture[]>(
        "list_recent_captures",
        { limit: 60 },
      );
      setCaptures(Array.isArray(items) ? items : []);
    } catch (err) {
      overlayLogger.warn("Falha ao listar capturas:", err);
      const fromPanel = panelDataRef.current.captures || [];
      const legacy = (panelDataRef.current.screenshots || []).map((url, i) => ({
        id: `legacy-${i}`,
        url,
      }));
      setCaptures(fromPanel.length ? fromPanel : legacy);
    } finally {
      setCapturesLoading(false);
    }
  }, []);

  const takeCapture = useCallback(async () => {
    overlaySfx("screenshot");
    try {
      const item = await invoke<{ id: string; url: string; name?: string; gameTitle?: string }>("capture_screen", {
        gameTitle: panelDataRef.current.gameTitle || panelDataRef.current.playingGame?.title || null,
      });
      addToast(
        {
          id: String(Date.now() + Math.random()),
          kind: "capture",
          title: "Captura salva",
          description: item?.name || "Screenshot salvo em Pictures/Phelierium Captures",
          screenshotUrl: item?.url,
        },
        4200,
      );
      void loadCaptures();
    } catch (err) {
      overlayLogger.warn("Falha ao capturar tela:", err);
      addToast(
        {
          id: String(Date.now() + Math.random()),
          kind: "error",
          title: "Captura falhou",
          description: err instanceof Error ? err.message : "Não foi possível tirar a foto.",
        },
        4000,
      );
    }
  }, [addToast, loadCaptures, overlaySfx]);

  const deleteCapture = useCallback(async (capture: OverlayCapture) => {
    if (!capture.path) {
      addToast(
        {
          id: String(Date.now() + Math.random()),
          kind: "error",
          title: "Não foi possível excluir",
          description: "Caminho da captura indisponível.",
        },
        3200,
      );
      return;
    }
    try {
      await invoke("delete_capture", { path: capture.path });
      setCaptures((prev) => prev.filter((item) => item.id !== capture.id && item.path !== capture.path));
      setViewingCapture((current) => (current?.id === capture.id ? null : current));
      setConfirmDeleteCapture(false);
      overlaySfx("select");
    } catch (err) {
      overlayLogger.warn("Falha ao excluir captura:", err);
      addToast(
        {
          id: String(Date.now() + Math.random()),
          kind: "error",
          title: "Exclusão falhou",
          description: err instanceof Error ? err.message : "Não foi possível excluir a foto.",
        },
        4000,
      );
    }
  }, [addToast, overlaySfx]);

  useEffect(() => {
    if (!recordingShortcut) return;
    const onKey = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.key === "Escape") {
        setRecordingShortcut(null);
        return;
      }
      const next = shortcutFromKeyboardEvent(event);
      if (!next) return;
      const patch = recordingShortcut === "overlay"
        ? { overlayShortcut: next }
        : { captureShortcut: next };
      void saveOverlayPrefs(patch)
        .then((prefs) => {
          applyOverlayPrefs(prefs);
          setRecordingShortcut(null);
          overlaySfx("select");
        })
        .catch(() => {
          setRecordingShortcut(null);
        });
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [applyOverlayPrefs, overlaySfx, recordingShortcut]);

  useEffect(() => {
    if (activeView === "media" && overlayMode === "full") {
      void loadCaptures();
    }
  }, [activeView, overlayMode, loadCaptures]);

  const uiSound = useCallback(() => {
    overlaySfx("select");
  }, [overlaySfx]);

  const hoverSfx = useCallback(() => {
    overlaySfx("hover");
  }, [overlaySfx]);

  const playHoverIfButton = useCallback(
    (event: React.PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const target = (event.target as HTMLElement | null)?.closest?.("button, [role='switch']");
      const from = (event.relatedTarget as HTMLElement | null)?.closest?.("button, [role='switch']");
      if (target && target !== from) hoverSfx();
    },
    [hoverSfx],
  );

  const goView = useCallback((view: OverlayView) => {
    uiSound();
    setActiveView(view);
  }, [uiSound]);

  const goMode = useCallback((mode: OverlayMode) => {
    uiSound();
    setOverlayMode(mode);
  }, [uiSound]);

  // ─── Ações do Overlay ────────────────────────────────────────────────────────
  const closeOverlay = useCallback(() => {
    uiSound();
    if (activeCall?.active) {
      setActiveCall(null);
      (window as any).achievementOverlay?.panelAction?.({ kind: "voice-hangup" });
    }
    setOverlayMode("passive");
    (window as any).achievementOverlay?.panelAction?.({ kind: "close" });
  }, [activeCall?.active, uiSound]);

  const handleStepBack = useCallback(() => {
    if (viewingCapture) {
      setConfirmDeleteCapture(false);
      setViewingCapture(null);
    } else if (overlayMode === "full") {
      setOverlayMode("quick");
    } else if (overlayMode === "quick") {
      closeOverlay();
    }
  }, [closeOverlay, overlayMode, viewingCapture]);

  // ─── Teclado & Hotkeys ───────────────────────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      setInteractionSource("keyboard");
      if (e.key === "Escape") {
        handleStepBack();
      } else if (e.key === "Enter" && !e.shiftKey) {
        if (
          document.activeElement &&
          document.activeElement !== document.body &&
          (document.activeElement as HTMLElement).tagName !== "INPUT" &&
          (document.activeElement as HTMLElement).tagName !== "TEXTAREA"
        ) {
          (document.activeElement as HTMLElement).click?.();
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleStepBack]);

  // ─── Navegação por Gamepad ───────────────────────────────────────────────────
  const { moveSystemFocus } = useGamepadFocusNavigation({
    playSound: () => overlaySfx("hover"),
    activeCategory: activeView,
    isSystemCategory: true,
  });

  const isInteractive = overlayMode !== "passive";

  useGamepadButton("DPAD_UP", () => { setInteractionSource("gamepad"); moveSystemFocus("up"); }, isInteractive, 100);
  useGamepadButton("DPAD_DOWN", () => { setInteractionSource("gamepad"); moveSystemFocus("down"); }, isInteractive, 100);
  useGamepadButton("DPAD_LEFT", () => { setInteractionSource("gamepad"); moveSystemFocus("left"); }, isInteractive, 100);
  useGamepadButton("DPAD_RIGHT", () => { setInteractionSource("gamepad"); moveSystemFocus("right"); }, isInteractive, 100);
  useGamepadButton("O", () => { setInteractionSource("gamepad"); handleStepBack(); }, isInteractive, 100);
  useGamepadButton("X", () => {
    setInteractionSource("gamepad");
    const active = document.activeElement as HTMLElement | null;
    active?.click?.();
  }, isInteractive, 100);

  // ─── Handlers de Ação Social / Chamada ───────────────────────────────────────
  const handleSelectChat = (friendId: string) => {
    setOverlayMode("full");
    setActiveView("chat");
    (window as any).achievementOverlay?.panelAction?.({
      kind: "select-chat",
      friendId,
    });
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text || panelData.chat?.sending) return;

    (window as any).achievementOverlay?.panelAction?.({
      kind: "send-message",
      text,
    });
    setInputText("");
  };

  const handleCloseChat = () => {
    (window as any).achievementOverlay?.panelAction?.({ kind: "close-chat" });
  };

  const handleVoiceCall = (friendId: string, friendName: string, friendAvatar?: string) => {
    setActiveCall({
      active: true,
      friendId,
      friendName,
      friendAvatar,
      muted: false,
      deafened: false,
      connectionState: "connected",
    });
    (window as any).achievementOverlay?.panelAction?.({
      kind: "voice-call",
      friendId,
      friendName,
      friendAvatar,
    });
  };

  const handleEndCall = () => {
    setActiveCall(null);
    (window as any).achievementOverlay?.panelAction?.({ kind: "voice-hangup" });
  };

  const toggleMute = () => {
    setActiveCall((prev) => (prev ? { ...prev, muted: !prev.muted } : null));
    (window as any).achievementOverlay?.panelAction?.({ kind: "voice-mute" });
  };

  const toggleDeafen = () => {
    setActiveCall((prev) => (prev ? { ...prev, deafened: !prev.deafened } : null));
    (window as any).achievementOverlay?.panelAction?.({ kind: "voice-deafen" });
  };

  // Cálculos de Conquistas e Progresso
  const achievementList = React.useMemo(() => {
    const raw = panelData.achievements;
    if (Array.isArray(raw)) return raw;
    if (raw && Array.isArray((raw as any).items)) return (raw as any).items;
    return [];
  }, [panelData.achievements]);

  const unlockedCount = React.useMemo(() => {
    const raw = panelData.achievements as any;
    if (typeof raw?.unlocked === "number") return raw.unlocked;
    return achievementList.filter((a: any) => a.achieved).length;
  }, [panelData.achievements, achievementList]);

  const totalCount = React.useMemo(() => {
    const raw = panelData.achievements as any;
    if (typeof raw?.available === "number" && raw.available > 0) return raw.available;
    return achievementList.length;
  }, [panelData.achievements, achievementList]);

  const achievementsLoading = Boolean((panelData.achievements as any)?.loading);
  const hasCurrentGame = Boolean(panelData.gameTitle || panelData.playingGame?.title);
  const gameArt = panelData.playingGame?.image;
  const sessionStartedAt = panelData.playingGame?.sessionStartedAt;

  useEffect(() => {
    if (!sessionStartedAt) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [sessionStartedAt]);

  const sessionClock = React.useMemo(() => {
    if (!sessionStartedAt) return hasCurrentGame ? "Em andamento" : "Aguardando jogo";
    const start = Date.parse(sessionStartedAt);
    if (!Number.isFinite(start)) return "Em andamento";
    const total = Math.max(0, Math.floor((nowMs - start) / 1000));
    const hours = Math.floor(total / 3600);
    const mins = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    if (hours > 0) return `${hours}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    return `${mins}:${String(secs).padStart(2, "0")}`;
  }, [hasCurrentGame, nowMs, sessionStartedAt]);
  const progressPercent = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;
  const onlineFriends = (panelData.friends || []).filter((f: any) => {
    const st = String(f.status || "").toLowerCase();
    return st === "online" || st === "playing" || Boolean(f.playing);
  });
  const achievementPosition =
    panelData.settings?.achievementNotificationPosition ?? "top-right";
  const themeTokens = getOverlayThemeTokens(panelData.settings?.visualTheme);
  const accentColor = panelData.settings?.themeAccent || themeTokens.accent;

  return (
    <div
      data-overlay-mode={overlayMode}
      data-interaction-source={interactionSource}
      data-visual-theme={panelData.settings?.visualTheme || "phelierium"}
      onPointerDown={() => setInteractionSource("mouse")}
      style={{
        ["--overlay-accent" as string]: accentColor,
        ["--overlay-accent-muted" as string]: themeTokens.accentMuted,
        ["--overlay-accent-glow" as string]: themeTokens.accentGlow,
      }}
      className={[
        "fixed inset-0 pointer-events-none z-9999 select-none overflow-hidden bg-transparent font-sans text-white",
        autoContrast ? "overlay-high-contrast drop-shadow-[0_2px_12px_rgba(0,0,0,0.95)]" : "",
        fluidAnimations ? "" : "overlay-reduced-motion",
      ].filter(Boolean).join(" ")}
    >
      {perfHud.enabled ? (
        <PerfMonitorHud fps={perfHud.fps} cpu={perfHud.cpu} ramPercent={perfHud.ramPercent} />
      ) : null}
      {/* ─── TOASTS FLUTUANTES ──────────────────────────────────────────────── */}
      {/* Achievement toasts */}
      <div className="overlay-toast-stack" data-position={achievementPosition}>
        <AnimatePresence>
          {toasts
            .filter((t): t is AchievementToast => t.kind === "achievement")
            .map((toast) => (
              <div key={toast.id} data-overlay-interactive className="pointer-events-auto">
                <AchievementToastCard
                  toast={toast}
                  position={achievementPosition}
                  animated={fluidAnimations}
                  onOpenDetails={() => {
                    setOverlayMode("full");
                    setActiveView("achievements");
                    removeToast(toast.id);
                  }}
                />
              </div>
            ))}
        </AnimatePresence>
      </div>

      {/* Social / welcome toasts */}
      <div className="overlay-toast-stack" data-position="bottom-left">
        <AnimatePresence>
          {toasts
            .filter((t): t is SocialToast => t.kind !== "achievement")
            .map((toast) => {
              const isCall = toast.kind === "incoming-call" || toast.kind === "call";
              const isMessage = toast.kind === "message" || toast.kind === "friend-message";
              const isFriendRequest = toast.kind === "friend-request";
              const hasActions = isCall || isMessage || isFriendRequest;
              const friendUid = (toast.friendId || toast.callerUid || "").replace("cp-friend:", "");

              return (
                <div
                  key={toast.id}
                  data-overlay-interactive={hasActions ? "" : undefined}
                  className="overlay-toast-bundle pointer-events-auto flex w-full flex-col gap-2"
                >
                  {toast.kind === "capture" || toast.kind === "capture-saved" ? (
                    <CaptureToastCard
                      title={toast.title || "Captura salva"}
                      subtitle={toast.description || toast.message}
                      previewUrl={toast.screenshotUrl}
                      animated={fluidAnimations}
                    />
                  ) : toast.kind === "game-start" || toast.kind === "hint" ? (
                    <WelcomeToastCard
                      title={toast.title}
                      subtitle={toast.subtitle || toast.message || toast.description}
                      avatar={toast.avatar}
                      badge={toast.kind === "game-start" ? "PHELIERIUM" : "OVERLAY"}
                    />
                  ) : (
                    <SocialToastCard
                      toast={toast}
                      accentColor={accentColor}
                      animated={fluidAnimations}
                      onDismiss={() => removeToast(toast.id)}
                      onAcceptCall={
                        isCall
                          ? () => {
                              uiSound();
                              (window as any).achievementOverlay?.panelAction?.({ kind: "voice-accept" });
                              removeToast(toast.id);
                            }
                          : undefined
                      }
                      onRejectCall={
                        isCall
                          ? () => {
                              uiSound();
                              (window as any).achievementOverlay?.panelAction?.({ kind: "voice-reject" });
                              removeToast(toast.id);
                            }
                          : undefined
                      }
                      onAcceptFriend={
                        isFriendRequest
                          ? () => {
                              uiSound();
                              (window as any).achievementOverlay?.panelAction?.({
                                kind: "friend-accept",
                                friendId: friendUid,
                              });
                              removeToast(toast.id);
                            }
                          : undefined
                      }
                      onDeclineFriend={
                        isFriendRequest
                          ? () => {
                              uiSound();
                              (window as any).achievementOverlay?.panelAction?.({
                                kind: "friend-decline",
                                friendId: friendUid,
                              });
                              removeToast(toast.id);
                            }
                          : undefined
                      }
                    />
                  )}
                </div>
              );
            })}
        </AnimatePresence>
      </div>

      {/* ─── MINI BARRA PERSISTENTE DE CHAMADA DE VOZ ───────────────────────── */}
      <AnimatePresence>
        {activeCall?.active && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-5 left-1/2 -translate-x-1/2 z-10020 flex items-center gap-3 rounded-full border border-emerald-500/30 bg-black/90 px-4 py-2 shadow-2xl backdrop-blur-xl pointer-events-auto"
            data-overlay-interactive
          >
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-black text-white">{activeCall.friendName || "Em Chamada"}</span>
            </div>

            <div className="h-3.5 w-px bg-white/20" />

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={toggleMute}
                aria-label={activeCall.muted ? "Ativar microfone" : "Desativar microfone"}
                className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
                  activeCall.muted ? "bg-rose-500/20 text-rose-400" : "hover:bg-white/10 text-white"
                }`}
                title={activeCall.muted ? "Microfone Desativado" : "Desativar Microfone"}
              >
                {activeCall.muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={toggleDeafen}
                aria-label={activeCall.deafened ? "Ativar áudio" : "Silenciar áudio"}
                className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
                  activeCall.deafened ? "bg-rose-500/20 text-rose-400" : "hover:bg-white/10 text-white"
                }`}
                title={activeCall.deafened ? "Áudio Silenciado" : "Silenciar Áudio"}
              >
                {activeCall.deafened ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={handleEndCall}
                aria-label="Desconectar chamada"
                className="ml-1 flex h-10 w-10 items-center justify-center rounded-full bg-rose-600 text-white transition-colors hover:bg-rose-500"
                title="Desconectar"
              >
                <PhoneOff className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── QUICK DOCK LATERAL (Assistente Compacto) ────────────────────────── */}
      <AnimatePresence>
        {overlayMode === "quick" && (
          <motion.div
            initial={{ opacity: 0, x: -80 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -80 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="fixed right-6 top-1/2 z-10040 flex max-h-[calc(100vh-40px)] w-[min(320px,calc(100vw-40px))] -translate-y-1/2 flex-col justify-between rounded-3xl border border-white/15 bg-[#08090c] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.88)] pointer-events-auto"
            data-overlay-interactive
            onPointerOver={playHoverIfButton}
          >
            {/* Header: Usuário & Nível */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-white/10 border border-white/10 overflow-hidden flex items-center justify-center">
                    {(panelData.userAvatar || panelData.profile?.avatar) ? (
                      <img src={panelData.userAvatar || panelData.profile?.avatar} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Gamepad2 className="h-5 w-5 text-white/70" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-white">{panelData.userDisplay || panelData.profile?.name || "Jogador"}</h3>
                    <span className={`text-[10px] font-bold flex items-center gap-1 ${hasCurrentGame ? "text-emerald-400" : "text-white/55"}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${hasCurrentGame ? "bg-emerald-400 animate-pulse" : "bg-white/40"}`} />
                      {hasCurrentGame ? "Em jogo" : "Online"}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeOverlay}
                  aria-label="Fechar overlay"
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-white/60 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-2 focus-visible:outline-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Game Card Resumo */}
              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/4">
                {gameArt ? (
                  <img src={gameArt} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35" />
                ) : null}
                <div className="relative flex flex-col gap-2 p-3.5">
                  <span className="text-[9px] font-black uppercase tracking-widest text-white/40">Jogo Atual</span>
                  <h4 className="truncate text-sm font-black text-white">{panelData.gameTitle || "Nenhum jogo em execução"}</h4>
                  {hasCurrentGame ? (
                    <p className="text-[11px] font-semibold tabular-nums text-white/70">Sessão {sessionClock}</p>
                  ) : (
                    <p className="text-[11px] leading-relaxed text-white/60">
                      Abra um jogo pela biblioteca para acompanhar a sessão e suas conquistas.
                    </p>
                  )}
                  {totalCount > 0 && (
                    <div className="mt-1">
                      <div className="flex justify-between text-[10px] font-bold text-white/60 mb-1">
                        <span>Troféus: {unlockedCount} / {totalCount}</span>
                        <span>{progressPercent}%</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10" aria-label={`${progressPercent}% das conquistas desbloqueadas`}>
                        <div
                          className="h-full bg-linear-to-r from-sky-400 to-emerald-400 rounded-full transition-all duration-500"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Actions Pills */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[9px] font-black uppercase tracking-widest text-white/40 px-1">Menu Rápido</span>
                <button
                  type="button"
                  onClick={() => { goView("achievements"); goMode("full"); }}
                  className="flex min-h-10 items-center justify-between rounded-xl border border-white/6 bg-white/3 px-3 py-2.5 text-xs font-bold text-white/80 transition-all hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white"
                >
                  <div className="flex items-center gap-2.5">
                    <Trophy className="h-4 w-4" style={{ color: accentColor }} /> Conquistas
                  </div>
                  <span className="text-[10px] font-black text-white/40">{unlockedCount}/{totalCount}</span>
                </button>
                <button
                  type="button"
                  onClick={() => { goView("friends"); goMode("full"); }}
                  className="flex min-h-10 items-center justify-between rounded-xl border border-white/6 bg-white/3 px-3 py-2.5 text-xs font-bold text-white/80 transition-all hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white"
                >
                  <div className="flex items-center gap-2.5">
                    <Users className="h-4 w-4" style={{ color: accentColor }} /> Amigos
                  </div>
                  <span className="text-[10px] font-black" style={{ color: accentColor }}>{onlineFriends.length} online</span>
                </button>
                <button
                  type="button"
                  onClick={() => { goView("chat"); goMode("full"); }}
                  className="flex min-h-10 items-center justify-between rounded-xl border border-white/6 bg-white/3 px-3 py-2.5 text-xs font-bold text-white/80 transition-all hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white"
                >
                  <div className="flex items-center gap-2.5">
                    <MessageSquare className="h-4 w-4" style={{ color: accentColor }} /> Bate-papo
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => { goView("media"); goMode("full"); }}
                  className="flex min-h-10 items-center justify-between rounded-xl border border-white/6 bg-white/3 px-3 py-2.5 text-xs font-bold text-white/80 transition-all hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white"
                >
                  <div className="flex items-center gap-2.5">
                    <Camera className="h-4 w-4" style={{ color: accentColor }} /> Capturas
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => { void takeCapture(); }}
                  className="flex min-h-10 items-center justify-between rounded-xl border border-white/6 bg-white/3 px-3 py-2.5 text-xs font-bold text-white/80 transition-all hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white"
                >
                  <div className="flex items-center gap-2.5">
                    <Camera className="h-4 w-4" style={{ color: accentColor }} /> Tirar foto
                  </div>
                  <span className="text-[10px] font-black text-white/40">{formatShortcutLabel(captureShortcut)}</span>
                </button>
              </div>
            </div>

            {/* Footer do Quick Dock */}
            <div className="pt-3 border-t border-white/10 flex flex-col gap-2">
              <Button
                type="button"
                onClick={() => goMode("full")}
                className="mt-3 min-h-10 w-full rounded-xl bg-white text-xs font-black text-black hover:bg-white/90"
              >
                <Maximize2 className="h-3.5 w-3.5 mr-1.5" />
                Expandir Assistente
              </Button>
              <div className="flex items-center justify-between px-1 text-[10px] text-white/40">
                <span>{formatShortcutLabel(overlayShortcut)} ou Esc para sair</span>
                <button
                  type="button"
                  onClick={() => {
                    uiSound();
                    setAutoContrast((p) => {
                      const next = !p;
                      void saveOverlayPrefs({ highContrast: next });
                      return next;
                    });
                  }}
                  className="min-h-10 rounded-xl px-2 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-white"
                >
                  Contraste: {autoContrast ? "Alto" : "Padrão"}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── FULL COMMAND CENTER OVERLAY ────────────────────────────────────── */}
      <AnimatePresence>
        {overlayMode === "full" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-label="Central de comando do overlay"
            className="fixed inset-0 z-10050 flex items-center justify-center bg-[#030405]/95 p-6 backdrop-blur-md pointer-events-auto md:p-10"
          >
            <motion.div
              initial={{ scale: 0.97, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.97, opacity: 0, y: 15 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="relative flex h-[min(760px,calc(100vh-80px))] w-[min(1180px,calc(100vw-80px))] max-w-none overflow-hidden rounded-3xl border border-white/[0.14] bg-[#08090c] shadow-[0_30px_100px_rgba(0,0,0,0.92)]"
              data-system-page="true"
              onPointerOver={playHoverIfButton}
            >
              {/* Sidebar do Full Panel */}
              <div className="flex w-[216px] flex-col border-r border-white/[0.08] bg-white/[0.025] p-4 shrink-0">
                <div className="flex items-center justify-between pb-5 border-b border-white/[0.08]">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/10 border border-white/10">
                      {(panelData.userAvatar || panelData.profile?.avatar) ? (
                        <img src={panelData.userAvatar || panelData.profile?.avatar} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Gamepad2 className="h-4 w-4 text-white/70" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-xs font-black text-white">{panelData.userDisplay || panelData.profile?.name || "Jogador"}</h3>
                      <p className={`truncate text-[10px] font-bold ${hasCurrentGame ? "text-emerald-400" : "text-white/55"}`}>
                        {hasCurrentGame ? "Em jogo" : "Online"}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => goMode("quick")}
                    aria-label="Recolher para o dock rápido"
                    className="flex h-10 w-10 items-center justify-center rounded-xl text-white/50 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white"
                    title="Recolher para Dock Lateral"
                  >
                    <Minimize2 className="h-4 w-4" />
                  </button>
                </div>

                <nav className="mt-5 flex flex-col gap-1 flex-1">
                  <button
                    type="button"
                    onClick={() => goView("home")}
                    aria-current={activeView === "home" ? "page" : undefined}
                    className={`flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-semibold transition-all focus-visible:outline-2 focus-visible:outline-white ${
                      activeView === "home" ? "bg-white text-black shadow-md" : "text-white/60 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <Gamepad2 className="h-4 w-4" /> Visão Geral
                  </button>
                  <button
                    type="button"
                    onClick={() => goView("achievements")}
                    aria-current={activeView === "achievements" ? "page" : undefined}
                    className={`flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-semibold transition-all focus-visible:outline-2 focus-visible:outline-white ${
                      activeView === "achievements" ? "bg-white text-black shadow-md" : "text-white/60 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <Trophy className="h-4 w-4" /> Conquistas
                  </button>
                  <button
                    type="button"
                    onClick={() => goView("friends")}
                    aria-current={activeView === "friends" ? "page" : undefined}
                    className={`flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-semibold transition-all focus-visible:outline-2 focus-visible:outline-white ${
                      activeView === "friends" ? "bg-white text-black shadow-md" : "text-white/60 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <Users className="h-4 w-4" /> Amigos
                  </button>
                  <button
                    type="button"
                    onClick={() => goView("chat")}
                    aria-current={activeView === "chat" ? "page" : undefined}
                    className={`flex min-h-10 items-center justify-between rounded-xl px-3 py-2 text-[13px] font-semibold transition-all focus-visible:outline-2 focus-visible:outline-white ${
                      activeView === "chat" ? "bg-white text-black shadow-md" : "text-white/60 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <MessageSquare className="h-4 w-4" /> Bate-papo
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => goView("media")}
                    aria-current={activeView === "media" ? "page" : undefined}
                    className={`flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-semibold transition-all focus-visible:outline-2 focus-visible:outline-white ${
                      activeView === "media" ? "bg-white text-black shadow-md" : "text-white/60 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <Camera className="h-4 w-4" /> Capturas
                  </button>
                  <button
                    type="button"
                    onClick={() => goView("settings")}
                    aria-current={activeView === "settings" ? "page" : undefined}
                    className={`flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-semibold transition-all focus-visible:outline-2 focus-visible:outline-white ${
                      activeView === "settings" ? "bg-white text-black shadow-md" : "text-white/60 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <Settings className="h-4 w-4" /> Ajustes
                  </button>
                </nav>

                <div className="pt-3 border-t border-white/[0.08] flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={closeOverlay}
                    className="flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white/70 transition-all hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white"
                  >
                    <X className="h-4 w-4" /> Fechar Overlay (Esc)
                  </button>
                </div>
              </div>

              {/* Área Central de Conteúdo */}
              <div className="flex min-w-0 flex-1 flex-col overflow-y-auto p-6 md:p-8 thin-scrollbar">
                {activeView === "home" && (
                  <div className="flex flex-col gap-6">
                    <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.03]">
                      {gameArt ? (
                        <img src={gameArt} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />
                      ) : null}
                      <div className="relative p-6">
                        <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/45">
                          {hasCurrentGame ? "Jogo ativo" : "Nenhuma sessão ativa"}
                        </span>
                        <h2 className="mt-1 truncate text-2xl font-bold tracking-tight text-white md:text-3xl">
                          {panelData.gameTitle || "Nenhum jogo em execução"}
                        </h2>
                        {!hasCurrentGame && (
                          <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/60">
                            Abra um jogo pela biblioteca para acompanhar a sessão, conquistas e amigos jogando.
                          </p>
                        )}
                      </div>
                    </div>
                    {!hasCurrentGame && (
                      <Button
                        type="button"
                        onClick={closeOverlay}
                        className="min-h-10 w-fit rounded-xl bg-white px-4 text-xs font-black text-black hover:bg-white/90"
                      >
                        Voltar à biblioteca
                      </Button>
                    )}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-white/45">Sessão atual</span>
                        <p className="mt-2 text-base font-semibold tabular-nums text-white">{sessionClock}</p>
                      </div>
                      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-white/45">Conquistas</span>
                        <p className="mt-2 text-base font-semibold text-white">{unlockedCount} / {totalCount}</p>
                      </div>
                      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-white/45">Amigos online</span>
                        <p className="mt-2 text-base font-semibold text-white">{onlineFriends.length}</p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      onClick={() => { void takeCapture(); }}
                      className="min-h-10 w-fit rounded-xl bg-white px-4 text-xs font-black text-black hover:bg-white/90"
                    >
                      <Camera className="mr-1.5 h-3.5 w-3.5" /> Tirar foto ({formatShortcutLabel(captureShortcut)})
                    </Button>
                  </div>
                )}

                {activeView === "achievements" && (
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-black text-white">Conquistas do Jogo</h3>
                      <span className="text-xs font-bold text-white/60">{unlockedCount} de {totalCount} desbloqueadas</span>
                    </div>

                    {achievementsLoading ? (
                      <div className="flex flex-col items-center justify-center rounded-2xl border border-white/5 bg-white/[0.02] py-16 text-center" aria-busy="true">
                        <Loader2 className="mb-3 h-8 w-8 animate-spin text-white/60" aria-hidden="true" />
                        <p className="text-sm font-bold text-white/70">Carregando conquistas…</p>
                      </div>
                    ) : achievementList.length === 0 ? (
                      <div className="flex flex-col items-center justify-center rounded-2xl border border-white/5 bg-white/[0.02] py-16 text-center">
                        <Trophy className="h-10 w-10 text-white/20 mb-2" />
                        <p className="text-sm font-bold text-white/70">
                          {hasCurrentGame ? "Nenhuma conquista disponível" : "Inicie um jogo para ver conquistas"}
                        </p>
                        <p className="mt-1 max-w-xs text-xs text-white/50">
                          {hasCurrentGame ? "Este jogo ainda não possui dados de conquistas para exibir." : "A biblioteca mostrará os dados assim que uma sessão começar."}
                        </p>
                      </div>
                    ) : (
                      <div className="grid gap-2.5">
                        {achievementList.map((ach: any, idx: number) => (
                          <div
                            key={ach.apiName || ach.id || idx}
                            className="flex items-center gap-3.5 rounded-2xl border border-white/6 bg-white/[0.035] p-3.5"
                          >
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 overflow-hidden border border-white/10">
                              {ach.icon ? (
                                <img src={ach.icon} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <Trophy className="h-5 w-5 text-white/70" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className="text-xs font-bold text-white truncate">{ach.name || ach.displayName || "Conquista"}</h4>
                              <p className="text-[11px] text-white/50 mt-0.5 line-clamp-1">{ach.description || "Sem descrição"}</p>
                            </div>
                            <span
                              className={`rounded-lg px-2.5 py-1 text-[9px] font-black uppercase tracking-wider shrink-0 ${
                                ach.achieved
                                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/30"
                                  : "bg-white/5 text-white/40 border border-white/10"
                              }`}
                            >
                              {ach.achieved ? "Desbloqueada" : "Bloqueada"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeView === "friends" && (
                  <div className="flex flex-col gap-4">
                    <h3 className="text-base font-black text-white">Amigos</h3>
                    {(panelData.friends || []).length === 0 ? (
                      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/[0.02] py-14 px-6 text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-white/40 mb-3">
                          <Users className="h-6 w-6" aria-hidden="true" />
                        </div>
                        <h4 className="text-sm font-bold text-white">Nenhum amigo está jogando agora</h4>
                        <p className="mt-1 max-w-xs text-xs text-white/50">
                          Você pode abrir um chat ou adicionar novos amigos para jogar junto.
                        </p>
                        <Button
                          type="button"
                          onClick={() => {
                            (window as any).achievementOverlay?.panelAction?.({ kind: "open-launcher-friends" });
                          }}
                          className="mt-4 min-h-10 rounded-xl bg-white px-5 text-xs font-bold text-black hover:bg-white/90"
                        >
                          <UserPlus className="mr-2 h-4 w-4" />
                          Adicionar amigo
                        </Button>
                      </div>
                    ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {(panelData.friends || []).map((friend: any, idx: number) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between rounded-2xl border border-white/6 bg-white/[0.035] p-3.5"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="relative h-10 w-10 rounded-xl bg-white/10 shrink-0 overflow-hidden">
                              {friend.avatar ? (
                                <img src={friend.avatar} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <div className="h-full w-full flex items-center justify-center text-white/70">
                                  <Users className="h-5 w-5" />
                                </div>
                              )}
                              <span
                                className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-black ${
                                  friend.status === "playing"
                                    ? "bg-green-500 animate-pulse"
                                    : friend.status === "online"
                                    ? "bg-green-400"
                                    : "bg-white/20"
                                }`}
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-white truncate">{friend.name || "Amigo"}</p>
                              <p className="text-[10px] text-white/40 truncate">
                                {friend.status === "playing"
                                  ? `Jogando ${friend.playing || ""}`
                                  : friend.status === "online"
                                  ? "Online"
                                  : "Offline"}
                              </p>
                            </div>
                          </div>
                          {friend.canChat && (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleVoiceCall(friend.id, friend.name, friend.avatar)}
                                className="flex items-center gap-1.5 rounded-xl border border-emerald-400/30 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 px-2.5 py-1.5 text-xs font-bold transition-all"
                                title="Ligar para amigo"
                              >
                                <Phone className="h-3.5 w-3.5" /> Ligar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSelectChat(friend.id)}
                                className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-white/15 transition-all"
                              >
                                <MessageSquare className="h-3.5 w-3.5" /> Chat
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    )}
                  </div>
                )}

                {activeView === "chat" && (
                  <div className="flex flex-col h-full gap-4">
                    {panelData.chat ? (
                      <div className="flex flex-col h-full">
                        <div className="flex items-center justify-between pb-3.5 border-b border-white/[0.08] mb-4">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={handleCloseChat}
                              aria-label="Voltar para amigos"
                              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-white/70 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white"
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </button>
                            <div className="h-9 w-9 rounded-xl bg-white/10 overflow-hidden shrink-0">
                              {panelData.chat.friendAvatar ? (
                                <img src={panelData.chat.friendAvatar} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <div className="h-full w-full flex items-center justify-center text-white/60">
                                  <Users className="h-4 w-4" />
                                </div>
                              )}
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-white">{panelData.chat.friendName}</h4>
                              <p className="text-[10px] text-emerald-400 font-bold">
                                {panelData.chat.typing ? "Digitando..." : "Em conversa"}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              handleVoiceCall(
                                panelData.chat?.friendId || "",
                                panelData.chat?.friendName || "",
                                panelData.chat?.friendAvatar
                              )
                            }
                            className="flex items-center gap-1.5 rounded-xl border border-emerald-400/30 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 px-3 py-1.5 text-xs font-bold transition-all"
                          >
                            <Phone className="h-3.5 w-3.5" /> Ligar
                          </button>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-3 pr-2 thin-scrollbar">
                          {panelData.chat.messages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-center text-xs text-white/50">
                              <MessageSquare className="h-8 w-8 mb-2 opacity-50" />
                              <span>Nenhuma mensagem anterior.</span>
                              <span className="mt-1 text-[11px] text-white/40">Envie uma mensagem para iniciar a conversa.</span>
                            </div>
                          ) : (
                            panelData.chat.messages.map((msg) => (
                              <div key={msg.id} className={`flex ${msg.mine ? "justify-end" : "justify-start"}`}>
                                <div
                                  className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-xs shadow-md ${
                                    msg.mine
                                      ? "bg-white text-black font-medium"
                                      : "bg-white/[0.07] border border-white/10 text-white"
                                  }`}
                                >
                                  {msg.attachmentUrl && (
                                    <div className="mb-2 overflow-hidden rounded-xl border border-black/10">
                                      <button
                                        type="button"
                                        onClick={() => setViewingCapture({ id: msg.attachmentUrl!, url: msg.attachmentUrl! })}
                                        className="relative group block w-full cursor-pointer"
                                      >
                                        <img src={msg.attachmentUrl} alt="Anexo" className="max-h-48 w-full object-cover rounded-xl" />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-xl transition-opacity">
                                          <ZoomIn className="h-6 w-6 text-white" />
                                        </div>
                                      </button>
                                    </div>
                                  )}
                                  {msg.text && <p className="break-words leading-relaxed">{msg.text}</p>}
                                  <span className={`mt-1 block text-right text-[9px] font-bold ${msg.mine ? "text-black/50" : "text-white/40"}`}>
                                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                </div>
                              </div>
                            ))
                          )}
                          <div ref={chatMessagesEndRef} />
                        </div>

                        <form onSubmit={handleSendMessage} className="mt-4 flex items-center gap-2">
                          <input
                            type="text"
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            placeholder={`Enviar mensagem para ${panelData.chat.friendName}...`}
                            aria-label={`Mensagem para ${panelData.chat.friendName}`}
                            className="min-h-10 flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs text-white placeholder-white/30 focus:border-white/30 focus:outline-none"
                          />
                          <button
                            type="submit"
                            disabled={!inputText.trim() || panelData.chat.sending}
                            aria-label={panelData.chat.sending ? "Enviando mensagem" : "Enviar mensagem"}
                            className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-black hover:bg-white/90 disabled:opacity-40"
                          >
                            {panelData.chat.sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                          </button>
                        </form>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        <h3 className="text-base font-black text-white">Selecione um Amigo para Conversar</h3>
                        {(panelData.friends || []).filter((f: any) => f.canChat).length === 0 ? (
                          <div className="flex flex-col items-center justify-center rounded-2xl border border-white/5 bg-white/[0.02] py-16 text-center">
                            <MessageSquare className="mb-3 h-9 w-9 text-white/20" aria-hidden="true" />
                            <p className="text-sm font-bold text-white/70">Nenhuma conversa disponível</p>
                            <p className="mt-1 max-w-xs text-xs text-white/50">Quando um amigo estiver disponível, você poderá iniciar um chat aqui.</p>
                          </div>
                        ) : (
                        <div className="grid grid-cols-2 gap-3">
                          {(panelData.friends || [])
                            .filter((f: any) => f.canChat)
                            .map((friend: any, idx: number) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => handleSelectChat(friend.id)}
                                className="flex min-h-16 items-center gap-3 rounded-2xl border border-white/6 bg-white/[0.035] p-4 text-left transition-all hover:bg-white/[0.07] focus-visible:outline-2 focus-visible:outline-white"
                              >
                                <div className="h-9 w-9 rounded-xl bg-white/10 overflow-hidden shrink-0">
                                  {friend.avatar ? (
                                    <img src={friend.avatar} alt="" className="h-full w-full object-cover" />
                                  ) : (
                                    <div className="h-full w-full flex items-center justify-center text-white/60">
                                      <Users className="h-4 w-4" />
                                    </div>
                                    )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-bold text-white truncate">{friend.name}</p>
                                  <p className="text-[10px] text-white/40 truncate">Clique para abrir chat</p>
                                </div>
                              </button>
                            ))}
                         </div>
                         )}
                       </div>
                     )}
                   </div>
                 )}

                {activeView === "media" && (
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-base font-black text-white">Capturas de Tela</h3>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            uiSound();
                            void loadCaptures();
                          }}
                          className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white/70 hover:bg-white/10"
                        >
                          Atualizar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            uiSound();
                            void invoke("open_captures_folder").catch((err) =>
                              overlayLogger.warn("Abrir pasta falhou:", err),
                            );
                          }}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white/70 hover:bg-white/10"
                        >
                          <FolderOpen className="h-3.5 w-3.5" />
                          Pasta
                        </button>
                      </div>
                    </div>
                    {capturesLoading ? (
                      <div className="flex items-center justify-center py-16 text-white/50">
                        <Loader2 className="h-6 w-6 animate-spin" />
                      </div>
                    ) : captures.length === 0 ? (
                      <div className="flex flex-col items-center justify-center rounded-2xl border border-white/5 bg-white/[0.02] py-16 text-center">
                        <Camera className="mb-3 h-9 w-9 text-white/20" aria-hidden="true" />
                        <p className="text-sm font-bold text-white/70">Nenhuma captura ainda</p>
                        <p className="mt-1 max-w-xs text-xs text-white/50">
                          As capturas em Pictures/Phelierium Captures aparecerão aqui.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                        {captures.map((cap) => (
                          <div
                            key={cap.id}
                            className="group relative h-32 overflow-hidden rounded-xl border border-white/10"
                          >
                            <button
                              type="button"
                              onClick={() => {
                                uiSound();
                                setConfirmDeleteCapture(false);
                                setViewingCapture(cap);
                              }}
                              aria-label={cap.name || "Abrir captura"}
                              className="h-full w-full cursor-pointer text-left transition-transform hover:scale-[1.02] focus-visible:outline-2 focus-visible:outline-white"
                            >
                              <img src={cap.url} alt={cap.name || "Captura"} className="h-full w-full object-cover" />
                              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                                <p className="truncate text-[10px] font-bold text-white">{cap.gameTitle || cap.name}</p>
                              </div>
                            </button>
                            {cap.path ? (
                              <button
                                type="button"
                                aria-label="Excluir captura"
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  uiSound();
                                  setViewingCapture(cap);
                                  setConfirmDeleteCapture(true);
                                }}
                                className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/70 text-white opacity-0 transition-opacity hover:bg-rose-500 group-hover:opacity-100 focus-visible:opacity-100"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeView === "settings" && (
                  <div className="flex flex-col gap-4 max-w-lg">
                    <h3 className="text-base font-black text-white">Ajustes do Overlay</h3>
                    <div className="rounded-2xl border border-white/6 bg-white/[0.035] p-4 space-y-4">
                      {([
                        {
                          key: "achievements",
                          icon: Trophy,
                          title: "Conquistas",
                          hint: "Exibir pop-up ao desbloquear conquistas",
                          value: achievementToastsEnabled,
                          toggle: (next: boolean) => {
                            setAchievementToastsEnabled(next);
                            void saveOverlayPrefs({ achievements: next });
                          },
                        },
                        {
                          key: "mute-social",
                          icon: BellOff,
                          title: "Atividades sociais",
                          hint: "Notificar mensagens, chamadas e amigos jogando",
                          value: !muteSocial,
                          toggle: (next: boolean) => {
                            setMuteSocial(!next);
                            void saveOverlayPrefs({ social: next });
                          },
                        },
                        {
                          key: "anim",
                          icon: Sparkles,
                          title: "Animações fluidas",
                          hint: "Efeitos visuais e transições dinâmicas",
                          value: fluidAnimations,
                          toggle: (next: boolean) => {
                            setFluidAnimations(next);
                            void saveOverlayPrefs({ fluidAnimations: next });
                          },
                        },
                        {
                          key: "contrast",
                          icon: Contrast,
                          title: "Modo alto contraste",
                          hint: "Melhora a legibilidade sobre jogos claros",
                          value: autoContrast,
                          toggle: (next: boolean) => {
                            setAutoContrast(next);
                            void saveOverlayPrefs({ highContrast: next });
                          },
                        },
                        {
                          key: "mute-all",
                          icon: VolumeX,
                          title: "Silenciar todas as notificações",
                          hint: "Bloqueia toasts de conquistas, sociais e avisos",
                          value: muteAllToasts,
                          toggle: (next: boolean) => {
                            setMuteAllToasts(next);
                            void saveOverlayPrefs({ muteAll: next });
                          },
                        },
                        {
                          key: "perf",
                          icon: Gauge,
                          title: "Monitor de desempenho",
                          hint: "Mostra FPS, CPU e RAM no hub e no jogo, mesmo com o overlay fechado",
                          value: perfMonitor,
                          toggle: (next: boolean) => {
                            setPerfMonitor(next);
                            void saveOverlayPrefs({ perfMonitor: next });
                          },
                        },
                      ] as const).map((row) => (
                        <div key={row.key} className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-start gap-2.5">
                            <row.icon className="mt-0.5 h-4 w-4 shrink-0 text-white/45" style={{ color: accentColor }} />
                            <div>
                              <span className="block text-xs font-bold text-white">{row.title}</span>
                              <span className="text-[10px] text-white/50">{row.hint}</span>
                            </div>
                          </div>
                          <OverlayToggle
                            checked={row.value}
                            accent={accentColor}
                            label={row.title}
                            onCheckedChange={(next) => {
                              overlaySfx(next ? "switchOn" : "switchOff");
                              row.toggle(next);
                            }}
                          />
                        </div>
                      ))}
                      <div className="flex items-center justify-between gap-3 border-t border-white/8 pt-4">
                        <div>
                          <span className="block text-xs font-bold text-white">Atalho de captura</span>
                          <span className="text-[10px] text-white/50">
                            {recordingShortcut === "capture"
                              ? "Pressione uma tecla ou combinação (Esc cancela)"
                              : formatShortcutLabel(captureShortcut)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            overlaySfx("select");
                            setRecordingShortcut((prev) => (prev === "capture" ? null : "capture"));
                          }}
                          className="min-h-10 rounded-xl bg-white/10 px-3 py-1 text-xs font-bold text-white transition-colors hover:bg-white/16 focus-visible:outline-2 focus-visible:outline-white"
                        >
                          {recordingShortcut === "capture" ? "Cancelar" : "Alterar"}
                        </button>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <span className="block text-xs font-bold text-white">Atalho do overlay</span>
                          <span className="text-[10px] text-white/50">
                            {recordingShortcut === "overlay"
                              ? "Pressione uma tecla ou combinação (Esc cancela)"
                              : formatShortcutLabel(overlayShortcut)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            overlaySfx("select");
                            setRecordingShortcut((prev) => (prev === "overlay" ? null : "overlay"));
                          }}
                          className="min-h-10 rounded-xl bg-white/10 px-3 py-1 text-xs font-bold text-white transition-colors hover:bg-white/16 focus-visible:outline-2 focus-visible:outline-white"
                        >
                          {recordingShortcut === "overlay" ? "Cancelar" : "Alterar"}
                        </button>
                      </div>
                    </div>
                    <p className="text-[10px] text-white/35">
                      Tema visual do hub: <span style={{ color: accentColor }}>{panelData.settings?.visualTheme || "phelierium"}</span>
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── VISUALIZADOR DE IMAGEM LIGHTBOX ─────────────────────────────────── */}
      <AnimatePresence>
        {viewingCapture && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10100] flex items-center justify-center bg-black/90 backdrop-blur-2xl pointer-events-auto p-8"
            onClick={() => {
              setConfirmDeleteCapture(false);
              setViewingCapture(null);
            }}
          >
            <div
              className="relative max-w-5xl max-h-[85vh] overflow-hidden rounded-2xl border border-white/15 bg-black/80 shadow-2xl p-2"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => {
                  setConfirmDeleteCapture(false);
                  setViewingCapture(null);
                }}
                aria-label="Fechar imagem"
                className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/70 text-white transition-all hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white"
              >
                <X className="h-5 w-5" />
              </button>
              {viewingCapture.path ? (
                confirmDeleteCapture ? (
                  <div className="absolute left-4 top-4 z-10 flex items-center gap-2 rounded-xl border border-white/10 bg-black/80 px-3 py-2">
                    <span className="text-[11px] font-bold text-white">Excluir esta foto?</span>
                    <button
                      type="button"
                      onClick={() => void deleteCapture(viewingCapture)}
                      className="rounded-lg bg-rose-500 px-2.5 py-1 text-[10px] font-black uppercase text-white hover:bg-rose-400"
                    >
                      Excluir
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteCapture(false)}
                      className="rounded-lg bg-white/10 px-2.5 py-1 text-[10px] font-black uppercase text-white hover:bg-white/20"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      overlaySfx("select");
                      setConfirmDeleteCapture(true);
                    }}
                    aria-label="Excluir captura"
                    className="absolute left-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/70 text-white transition-all hover:bg-rose-500 focus-visible:outline-2 focus-visible:outline-white"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )
              ) : null}
              <img src={viewingCapture.url} alt="Captura ampliada" className="max-h-[80vh] max-w-full rounded-xl object-contain" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default OverlayApp;
