import { announceNotchEvent } from "../components/notch/notchEvent";
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
  Monitor,
  AppWindow,
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
import { resolveOverlayCallPhase } from "./overlayCallPhase";
import { presenceLabel } from "../services/presenceStatus";
import { DesktopNotch, NotchIconButton, NOTCH_SPRING, SectionLabel } from "../components/notch/DesktopNotch";
import { Avatar } from "./components/panel/Avatar";
import { PanelRow } from "./components/panel/PanelRow";
import { PillButton } from "./components/panel/PillButton";
import { ProgressBar } from "./components/panel/ProgressBar";
import { FOCUS_RING, PANEL_SHADOW, PANEL_SURFACE_CLASS, PANEL_Z, panelSurfaceStyle } from "./components/panel/panelTokens";
import { CallPill } from "./components/CallPill";
import { FlyingMascot, type LaunchHandoff } from "./components/FlyingMascot";
import { MascotCustomizer } from "../mascot/MascotCustomizer";
import { useOverlayAppearance } from "../mascot/useNotchConfig";
import { PherieMascot } from "../components/notch/PherieMascot";

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
export type OverlayView = "home" | "friends" | "chat" | "achievements" | "call" | "media" | "mascot" | "settings";
export type InteractionSource = "keyboard" | "gamepad" | "mouse";
export type CallConnectionState = "calling" | "connected" | "degraded" | "reconnecting" | "failed";

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
  /** Duração do toast (ms) — deve bater com a barra de progresso. */
  durationMs?: number;
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
  failed?: boolean;
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
  cameraOn?: boolean;
  screenSharing?: boolean;
  speaking?: boolean;
  connectionState?: CallConnectionState;
  durationSeconds?: number;
}

export interface CommandPanelState {
  gameTitle?: string;
  presenceStatus?: string;
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
    callOverlayEnabled?: boolean;
    effectsVolume?: number;
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
  if (!theme) return "default";
  if (theme === "playstation") return "ps2";
  if (theme === "phelierium" || theme === "checkpoint") return "default";
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
  const effectiveTheme =
    theme && theme !== "default"
      ? theme
      : (typeof window !== "undefined"
          ? localStorage.getItem("checkpoint_sound_theme_global")
          : null) ||
        theme ||
        "default";
  const normalizedTheme = normalizeSoundTheme(effectiveTheme);
  const themeSounds =
    (soundThemes as Record<string, Record<string, string>>)[normalizedTheme] ||
    soundThemes.default;

  const src =
    type === "unlockPlatinum"
      ? (themeSounds.overlayAchievementPlatinum || themeSounds.overlayAchievement || achievementUnlockPlatinum)
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
  // Intro de lançamento: o mascote vindo da janela principal voa até o notch.
  const [launchHandoff, setLaunchHandoff] = useState<LaunchHandoff | null>(null);
  useEffect(() => {
    if (launchHandoff) document.body.setAttribute("data-launch-handoff", "true");
    else document.body.removeAttribute("data-launch-handoff");
    return () => document.body.removeAttribute("data-launch-handoff");
  }, [launchHandoff]);
  // Configuração do notch (Configurações → Mascote e Notch), ao vivo via overlay:prefs.
  const appearance = useOverlayAppearance();
  const notchConfig = appearance.config;
  const notchEnabledRef = useRef(false);
  notchEnabledRef.current = notchConfig.enabled;
  const panelStyle = panelSurfaceStyle(appearance.style);
  const [activeView, setActiveView] = useState<OverlayView>("home");
  const [interactionSource, setInteractionSource] = useState<InteractionSource>("mouse");
  const [panelData, setPanelData] = useState<CommandPanelState>(() => {
    let achievementVolume = 22;
    let achievementSoundTheme = "default";
    try {
      const raw = localStorage.getItem("checkpoint_achievement_volume_global");
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) {
        achievementVolume = Math.min(100, Math.max(0, Math.round(parsed)));
      }
      const savedTheme = localStorage.getItem("checkpoint_sound_theme_global");
      if (savedTheme) {
        achievementSoundTheme = savedTheme;
      }
    } catch {
      /* ignore */
    }
    const stored = getInitialStoredProfile();
    return {
      userDisplay: stored.userDisplay || undefined,
      userAvatar: stored.userAvatar || undefined,
      settings: { achievementVolume, achievementSoundTheme },
    };
  });
  const [toasts, setToasts] = useState<AnyOverlayToast[]>([]);
  const [inputText, setInputText] = useState("");
  const [viewingCapture, setViewingCapture] = useState<OverlayCapture | null>(null);
  const [confirmDeleteCapture, setConfirmDeleteCapture] = useState(false);
  const [activeCall, setActiveCall] = useState<ActiveCallState | null>(null);
  const [captures, setCaptures] = useState<OverlayCapture[]>([]);
  const [capturesLoading, setCapturesLoading] = useState(false);
  const [fullResImageUrl, setFullResImageUrl] = useState<string | null>(null);
  const [fullResLoading, setFullResLoading] = useState(false);
  const [expandedAchId, setExpandedAchId] = useState<string | null>(null);
  const perfHud = usePerfMonitor();

  const [autoContrast, setAutoContrast] = useState(false);
  const [muteSocial, setMuteSocial] = useState(false);
  const [muteAllToasts, setMuteAllToasts] = useState(false);
  const [fluidAnimations, setFluidAnimations] = useState(true);
  const [systemReducedMotion, setSystemReducedMotion] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
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
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setSystemReducedMotion(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
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

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "checkpoint_sound_theme_global" && e.newValue) {
        const newTheme = e.newValue;
        setPanelData((prev) => ({
          ...prev,
          settings: {
            ...prev.settings,
            achievementSoundTheme: newTheme,
          },
        }));
      } else if (e.key === "checkpoint_achievement_volume_global" && e.newValue) {
        const vol = Number(e.newValue);
        if (Number.isFinite(vol)) {
          setPanelData((prev) => ({
            ...prev,
            settings: {
              ...prev.settings,
              achievementVolume: Math.min(100, Math.max(0, Math.round(vol))),
            },
          }));
        }
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const panelDataRef = useRef<CommandPanelState>(panelData);
  useEffect(() => {
    panelDataRef.current = panelData;
  }, [panelData]);

  const overlayTheme = useCallback(() => {
    return (
      panelDataRef.current?.settings?.achievementSoundTheme ||
      (typeof window !== "undefined"
        ? localStorage.getItem("checkpoint_sound_theme_global")
        : null) ||
      "default"
    );
  }, []);

  const overlayVol = useCallback(() => {
    const raw = panelDataRef.current?.settings?.achievementVolume;
    if (typeof raw === "number") return raw / 100;
    try {
      const stored = localStorage.getItem("checkpoint_achievement_volume_global");
      if (stored) {
        const parsed = Number(stored);
        if (Number.isFinite(parsed)) return Math.min(1, Math.max(0, parsed / 100));
      }
    } catch {}
    return 0.35;
  }, []);

  const overlaySfx = useCallback(
    (type: Parameters<typeof playOverlaySound>[0], volumeScale = 1) => {
      playOverlaySound(type, overlayTheme(), overlayVol() * volumeScale);
    },
    [overlayTheme, overlayVol],
  );

  const toastTimersRef = useRef<Map<string, number>>(new Map());
  const toastsRef = useRef<AnyOverlayToast[]>(toasts);
  useEffect(() => {
    toastsRef.current = toasts;
  }, [toasts]);
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
        && toast.kind !== "capture"
        && toast.kind !== "capture-saved"
      ) {
        return;
      }

      if (toast.kind === "game-start" && toastsRef.current.some((item) => item.kind === "game-start")) {
        return;
      }

      let toastIdToSchedule = toast.id;

      // Agrupamento inteligente para mensagens repetidas do mesmo amigo
      if (toast.kind === "message" && "friendId" in toast && toast.friendId) {
        const existing = toastsRef.current.find(
          (t) => t.kind === "message" && (t as SocialToast).friendId === toast.friendId
        ) as SocialToast | undefined;

        if (existing) {
          toastIdToSchedule = existing.id;
          // Cancela o temporizador antigo da notificação para que ela não suma antes da hora
          const prevTimer = toastTimersRef.current.get(existing.id);
          if (prevTimer) {
            window.clearTimeout(prevTimer);
            toastTimersRef.current.delete(existing.id);
          }
          const count = (existing.messageCount || 1) + 1;
          const updated: SocialToast = {
            ...existing,
            title: `${toast.title} (${count})`,
            message: (toast as SocialToast).message,
            messageCount: count,
          };
          setToasts((prev) => prev.map((t) => (t.id === existing.id ? updated : t)));
        } else {
          setToasts((prev) => [...prev, toast]);
        }
      } else {
        setToasts((prev) => [...prev, toast]);
      }

      const timerId = window.setTimeout(() => {
        removeToast(toastIdToSchedule);
      }, durationMs);
      toastTimersRef.current.set(toastIdToSchedule, timerId);
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
  // Modo interativo (quick OU full) captura o cursor inteiro: o painel é modal
  // enquanto aberto. Antes só o "full" capturava, e o dock "quick" ficava morto
  // no jogo (cursor/foco continuavam com o jogo).
  const fullCapturesCursor = overlayMode !== "passive";
  const callOverlayEnabled = panelData.settings?.callOverlayEnabled !== false;
  const hubVisible = (panelData as { hubVisible?: boolean }).hubVisible !== false;
  const [callDismissed, setCallDismissed] = useState(false);
  const [pointerInReveal, setPointerInReveal] = useState(false);
  const [callDurationSeconds, setCallDurationSeconds] = useState(0);

  // O cronômetro só corre depois de conectar (antes contava desde o toque da chamada).
  const callConnected = Boolean(activeCall?.active) && activeCall?.connectionState !== "calling";
  useEffect(() => {
    if (!callConnected) {
      setCallDurationSeconds(0);
      return;
    }
    const interval = setInterval(() => {
      setCallDurationSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [callConnected]);

  useEffect(() => {
    if (hubVisible || !activeCall?.active) {
      setCallDismissed(false);
      setPointerInReveal(false);
    }
  }, [hubVisible, activeCall?.active]);
  const overlayCallPhase = resolveOverlayCallPhase({
    enabled: callOverlayEnabled,
    callActive: Boolean(activeCall?.active),
    hubVisible,
    dismissed: callDismissed,
    pointerInReveal,
  });
  const showCallOverlayWidget = overlayCallPhase === "visible" || overlayCallPhase === "revealing";
  const showCallReveal = overlayCallPhase === "dismissed";
  // Com o notch desativado e sem toast interativo/pílula de chamada não há alvo de
  // clique: o hit-test (e o polling de cursor de 12ms no Rust) fica desligado.
  const showCallPill = !notchConfig.enabled && Boolean(activeCall?.active);
  const hasHitTestTargets = notchConfig.enabled || hasInteractiveToasts || showCallPill;

  useEffect(() => {
    if (fullCapturesCursor) {
      let cancelled = false;
      void (async () => {
        await invoke("overlay_set_cursor_watch", { enabled: false }).catch(() => undefined);
        if (cancelled) return;
        await invoke("overlay_set_ignore_cursor_events", { ignore: false }).catch((err) =>
          overlayLogger.warn("Falha ao ajustar cursor do overlay:", err),
        );
      })();
      return () => {
        cancelled = true;
      };
    }

    if (!hasHitTestTargets) {
      void invoke("overlay_set_cursor_watch", { enabled: false }).catch(() => undefined);
      void invoke("overlay_set_ignore_cursor_events", { ignore: true }).catch(() => undefined);
      return;
    }

    let cancelled = false;
    let lastIgnore: boolean | null = null;
    let lastSentAt = 0;
    const setIgnore = (ignore: boolean, force = false) => {
      const now = Date.now();
      if (!force && lastIgnore === ignore) return;
      // Re-afirmação forçada (throttled): o backend pode restaurar o
      // click-through por trás do frontend; sem reenviar periodicamente o
      // lastIgnore dessincroniza e a notch para de capturar o cursor.
      if (force && lastIgnore === ignore && now - lastSentAt < 600) return;
      lastIgnore = ignore;
      lastSentAt = now;
      void invoke("overlay_set_ignore_cursor_events", { ignore }).catch(() => undefined);
    };

    void invoke("overlay_set_cursor_watch", { enabled: true }).catch(() => undefined);
    setIgnore(true);

    // Defesa em profundidade: o comando é idempotente. Se algum caminho do
    // backend (fechar painel, toast expirando...) desligar o watch, o notch
    // volta a receber `overlay:cursor` em no máximo 1,5s em vez de ficar morto.
    const rearmWatch = window.setInterval(() => {
      void invoke("overlay_set_cursor_watch", { enabled: true }).catch(() => undefined);
    }, 1500);

    let unlisten: (() => void) | undefined;
    // Histerese anti-flicker: o hit-test por polling pode oscilar na borda por
    // erro de arredondamento da conversão de coordenadas. Só alterna o
    // click-through após leituras consecutivas iguais (2 p/ capturar, 3 p/ soltar),
    // senão o WebView entra num loop captura/solta que dispara mouseenter/leave
    // sem parar e a notch "fica querendo fechar".
    const streak = { hit: 0, miss: 0 };
    void import("@tauri-apps/api/event").then(({ listen }) => {
      if (cancelled) return;
      void listen<{ x: number; y: number }>("overlay:cursor", (event) => {
        if (cancelled) return;
        const { x, y } = event.payload;
        const el = document.elementFromPoint(x, y);
        // Retângulo REAL do notch (cresce ao expandir; fica fora da tela quando
        // escondido, então não captura nada). Substitui a faixa fixa 440x24.
        const notchRect = document
          .querySelector<HTMLElement>("[data-notch-root]")
          ?.getBoundingClientRect();
        const isOnNotch = Boolean(
          notchRect
            && notchRect.bottom > 0
            && x >= notchRect.left - 8
            && x <= notchRect.right + 8
            && y <= notchRect.bottom + 8,
        );
        const hit = Boolean(el?.closest("[data-overlay-interactive]")) || isOnNotch;
        if (isOnNotch) {
          // Notch: captura já na 1ª amostra (sem a histerese de 2) para expandir ao toque.
          streak.hit = Math.max(streak.hit + 1, 2);
          streak.miss = 0;
          setIgnore(false, true);
        } else if (hit) {
          streak.hit += 1;
          streak.miss = 0;
          if (streak.hit >= 2) setIgnore(false, true);
        } else {
          streak.miss += 1;
          streak.hit = 0;
          if (streak.miss >= 3) setIgnore(true);
        }
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
      window.clearInterval(rearmWatch);
      unlisten?.();
      document.removeEventListener("pointerleave", onLeaveInteractive, true);
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
      const activeSoundTheme =
        payload.soundTheme ||
        payload.theme ||
        panelDataRef.current?.settings?.achievementSoundTheme ||
        (typeof window !== "undefined"
          ? localStorage.getItem("checkpoint_sound_theme_global")
          : null) ||
        "default";
      const activeSoundVolume =
        typeof panelDataRef.current?.settings?.achievementVolume === "number"
          ? panelDataRef.current.settings.achievementVolume / 100
          : (typeof window !== "undefined" &&
              Number(localStorage.getItem("checkpoint_achievement_volume_global")) / 100) ||
            0.5;

      playOverlaySound(
        tier === "platinum" ? "unlockPlatinum" : tier === "gold" ? "unlockGold" : "unlock",
        activeSoundTheme,
        activeSoundVolume,
      );
      // Notch ligado: ele avisa (com a Pherie reagindo); o cartão grande fica só para ouro/platina
      // e para o teste de pré-visualização.
      // Notch ligado: ele abre inteiro revelando a conquista (imagem, nome, descrição, tier) e
      // substitui o cartão do overlay em todos os tiers.
      if (notchEnabledRef.current) {
        announceNotchEvent({
          kind: "achievement",
          title: toast.title,
          description: toast.description || undefined,
          gameTitle: toast.gameTitle,
          xp: xpGained || undefined,
          avatar: icon || null,
          tier,
        });
        return;
      }
      addToast(toast, 6500);
    });

    const unbindPlaySound = api.onPlaySound?.(({ sound, volume, theme }: any) => {
      const vol =
        typeof volume === "number"
          ? volume / 100
          : typeof panelDataRef.current?.settings?.achievementVolume === "number"
            ? panelDataRef.current.settings.achievementVolume / 100
            : 0.35;
      const t =
        theme ||
        panelDataRef.current?.settings?.achievementSoundTheme ||
        (typeof window !== "undefined"
          ? localStorage.getItem("checkpoint_sound_theme_global")
          : null) ||
        "default";
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
      const activeSoundTheme =
        panelDataRef.current?.settings?.achievementSoundTheme ||
        (typeof window !== "undefined"
          ? localStorage.getItem("checkpoint_sound_theme_global")
          : null) ||
        "default";
      const activeSoundVolume =
        typeof panelDataRef.current?.settings?.achievementVolume === "number"
          ? panelDataRef.current.settings.achievementVolume / 100
          : 0.35;
      playOverlaySound("welcome", activeSoundTheme, activeSoundVolume);
      // Notch ligado: a Pherie acena e avisa no lugar do cartão social.
      if (notchEnabledRef.current) {
        announceNotchEvent({
          kind: "welcome",
          title: "Divirta-se",
          subtitle: toast.description,
          avatar: payload.userAvatar || null,
        });
        return;
      }
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
      const startTitle = payload.gameTitle || (payload.description?.startsWith("Jogando ") ? payload.description.slice(8).trim() : "");
      if (isGameStart && startTitle) {
        setPanelData((prev) => ({
          ...prev,
          gameTitle: startTitle,
          playingGame: {
            id: "active-game",
            title: startTitle,
            monitoring: "unverified",
          },
        }));
      }
      const toast: SocialToast = {
        id: String(payload?.notificationId || payload?.id || Date.now() + Math.random()),
        ...normalized,
        title: isGameStart ? (payload.title || "Divirta-se") : normalized.title,
        description: isGameStart
          ? (payload.description || "Aguardando o jogo iniciar…")
          : normalized.description,
      };
      if (!isGameStart) {
        const activeSoundTheme =
          panelDataRef.current?.settings?.achievementSoundTheme ||
          (typeof window !== "undefined"
            ? localStorage.getItem("checkpoint_sound_theme_global")
            : null) ||
          "default";
        const activeSoundVolume =
          typeof panelDataRef.current?.settings?.achievementVolume === "number"
            ? panelDataRef.current.settings.achievementVolume / 100
            : 0.35;
        playOverlaySound(
          kind === "incoming-call" || kind === "call"
            ? "call"
            : kind === "capture" || kind === "capture-saved"
              ? "screenshot"
              : "toast",
          activeSoundTheme,
          activeSoundVolume,
        );
      }
      const payloadDuration = Number(payload?.duration);
      const toastDurationMs =
        Number.isFinite(payloadDuration) && payloadDuration > 0
          ? payloadDuration
          : kind === "incoming-call" || kind === "call"
            ? 5000
            : kind === "friend-request"
              ? 12000
              : isGameStart
                ? 6000
                : 7000;
      toast.durationMs = toastDurationMs;
      addToast(toast, toastDurationMs);
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
          sessionStartedAt: (() => {
            const incoming = activeGame.sessionStartedAt;
            const unverified = activeGame.monitoring === "unverified";
            if (incoming === "" || unverified) return undefined;
            return incoming || undefined;
          })(),
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

    const unbindHandoff = api.onLaunchHandoff?.((payload: any) => {
      if (payload && Number.isFinite(payload.x) && Number.isFinite(payload.y) && Number.isFinite(payload.size)) {
        setLaunchHandoff({ x: payload.x, y: payload.y, size: Math.max(16, payload.size), id: String(payload.id ?? Date.now()) });
      }
    });

    return () => {
      unbindHandoff?.();
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
      announceNotchEvent({
        kind: "capture-saved",
        title: "Captura salva",
        subtitle: item?.gameTitle || item?.name || "Pictures/Phelierium Captures",
        avatar: item?.url ?? null,
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
    // NÃO encerrar chamada aqui! A chamada deve continuar quando o jogador fecha o overlay e retorna ao jogo.
    setOverlayMode("passive");
    (window as any).achievementOverlay?.panelAction?.({ kind: "close" });
  }, [uiSound]);

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

  // Mantém o backend (captura de foco/cursor, `panel_open`) sincronizado com o
  // modo do React, qualquer que seja a origem (atalho, gamepad, toast de
  // conquista abrindo o painel completo, Esc). Idempotente no backend.
  const lastSentInteractiveRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (lastSentInteractiveRef.current === null && !isInteractive) {
      lastSentInteractiveRef.current = false;
      return;
    }
    if (lastSentInteractiveRef.current === isInteractive) return;
    lastSentInteractiveRef.current = isInteractive;
    void invoke("overlay_set_panel_open", { open: isInteractive }).catch((err) =>
      overlayLogger.warn("Falha ao sincronizar modo interativo:", err),
    );
  }, [isInteractive]);

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
    (window as any).achievementOverlay?.panelAction?.({
      kind: "voice-call",
      friendId,
      friendName,
      friendAvatar,
    });
  };

  const handleEndCall = () => {
    (window as any).achievementOverlay?.panelAction?.({ kind: "voice-hangup" });
  };

  const toggleMute = () => {
    (window as any).achievementOverlay?.panelAction?.({ kind: "voice-mute" });
  };

  const toggleDeafen = () => {
    (window as any).achievementOverlay?.panelAction?.({ kind: "voice-deafen" });
  };

  const toggleCamera = () => {
    (window as any).achievementOverlay?.panelAction?.({ kind: "voice-camera" });
  };

  const toggleScreenShare = () => {
    (window as any).achievementOverlay?.panelAction?.({ kind: "voice-screen" });
  };

  const openHub = () => {
    (window as any).achievementOverlay?.panelAction?.({ kind: "voice-open-hub" });
  };

  const revealCallOverlay = () => {
    setPointerInReveal(true);
    window.setTimeout(() => {
      setCallDismissed(false);
      setPointerInReveal(false);
    }, 160);
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
  const presenceStatus = panelData.playingGame?.presenceStatus || panelData.presenceStatus;

  useEffect(() => {
    if (!sessionStartedAt) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [sessionStartedAt]);

  const sessionClock = React.useMemo(() => {
    if (!hasCurrentGame) return "Aguardando jogo";
    if (!sessionStartedAt) {
      return presenceStatus === "waiting" ? "Preparando sessão…" : "Aguardando jogo iniciar…";
    }
    const start = Date.parse(sessionStartedAt);
    if (!Number.isFinite(start)) return "Em andamento";
    const total = Math.max(0, Math.floor((nowMs - start) / 1000));
    const hours = Math.floor(total / 3600);
    const mins = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    if (hours > 0) return `${hours}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    return `${mins}:${String(secs).padStart(2, "0")}`;
  }, [hasCurrentGame, nowMs, presenceStatus, sessionStartedAt]);
  // Notch: só entra em "modo jogo" com sessão verificada (sessionStartedAt é
  // descartado quando monitoring === "unverified"); antes bastava ter título,
  // então a notch ia para o modo jogo ainda na tela de "Preparando…".
  const sessionStartMs = sessionStartedAt ? Date.parse(sessionStartedAt) : NaN;
  const notchGameTitle =
    Number.isFinite(sessionStartMs) ? panelData.gameTitle || panelData.playingGame?.title || null : null;
  const notchGameElapsed = Number.isFinite(sessionStartMs)
    ? Math.max(0, Math.floor((nowMs - sessionStartMs) / 1000))
    : 0;
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
        fluidAnimations && !systemReducedMotion ? "" : "overlay-reduced-motion",
      ].filter(Boolean).join(" ")}
    >
      {perfHud.enabled ? (
        <PerfMonitorHud fps={perfHud.fps} cpu={perfHud.cpu} ramPercent={perfHud.ramPercent} />
      ) : null}
      {/* ─── TOASTS FLUTUANTES ──────────────────────────────────────────────── */}
      {/* Achievement toasts */}
      <div className="overlay-toast-stack" data-position={achievementPosition}>
        <AnimatePresence mode="popLayout">
          {toasts
            .filter((t): t is AchievementToast => t.kind === "achievement")
            .map((toast) => (
              <AchievementToastCard
                key={toast.id}
                toast={toast}
                position={achievementPosition}
                animated={fluidAnimations && !systemReducedMotion}
                className="pointer-events-auto"
                interactive
                onOpenDetails={() => {
                  setOverlayMode("full");
                  setActiveView("achievements");
                  removeToast(toast.id);
                }}
              />
            ))}
        </AnimatePresence>
      </div>

      {/* Social / welcome toasts */}
      <div className="overlay-toast-stack" data-position="bottom-left">
        <AnimatePresence mode="popLayout">
          {toasts
            .filter((t): t is SocialToast => t.kind !== "achievement")
            .map((toast) => {
              const isCall = toast.kind === "incoming-call" || toast.kind === "call";
              const isMessage = toast.kind === "message" || toast.kind === "friend-message";
              const isFriendRequest = toast.kind === "friend-request";
              const hasActions = isCall || isMessage || isFriendRequest;
              const friendUid = (toast.friendId || toast.callerUid || "").replace("cp-friend:", "");

              if (toast.kind === "game-start" || toast.kind === "hint") {
                return (
                  <WelcomeToastCard
                    key={toast.id}
                    title={toast.title}
                    subtitle={toast.subtitle || toast.message || toast.description}
                    avatar={toast.avatar}
                    badge={toast.kind === "game-start" ? "PHELIERIUM" : "OVERLAY"}
                    animated={fluidAnimations && !systemReducedMotion}
                    className="pointer-events-auto"
                  />
                );
              }

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
                      animated={fluidAnimations && !systemReducedMotion}
                    />
                  ) : (
                    <SocialToastCard
                      toast={toast}
                      accentColor={accentColor}
                      animated={fluidAnimations && !systemReducedMotion}
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

      {showCallReveal && (
        <button
          type="button"
          data-overlay-interactive
          aria-label="Mostrar chamada"
          onMouseEnter={revealCallOverlay}
          onFocus={revealCallOverlay}
          onClick={revealCallOverlay}
          className="fixed top-0 left-0 right-0 z-10020 h-3 cursor-pointer bg-transparent"
        />
      )}

      {/* ─── DESKTOP NOTCH / DYNAMIC ISLAND WIDGET (VISÍVEL NO DESKTOP) ─── */}
      {launchHandoff && (
        <FlyingMascot
          key={launchHandoff.id}
          handoff={launchHandoff}
          config={notchConfig}
          onDone={() => setLaunchHandoff(null)}
        />
      )}

      {notchConfig.enabled && (
      <DesktopNotch
        isOverlay
        config={notchConfig}
        soundVolume={
          typeof panelData.settings?.effectsVolume === "number" ? panelData.settings.effectsVolume : undefined
        }
        overlayCall={
          activeCall && activeCall.active
            ? {
                active: true,
                friendName: activeCall.friendName,
                friendAvatar: activeCall.friendAvatar,
                muted: activeCall.muted,
                deafened: activeCall.deafened,
                speaking: activeCall.speaking,
                durationSeconds: callDurationSeconds,
              }
            : null
        }
        onOverlayMute={toggleMute}
        onOverlayDeafen={toggleDeafen}
        onOverlayHangUp={handleEndCall}
        onOverlayOpenCall={() => (window as any).achievementOverlay?.panelAction?.({ kind: "voice-open-hub" })}
        activeGameTitle={notchGameTitle}
        activeGameElapsedSeconds={notchGameElapsed}
      />
      )}

      {showCallPill && (
        <CallPill
          friendName={activeCall?.friendName}
          durationSeconds={callDurationSeconds}
          muted={Boolean(activeCall?.muted)}
          deafened={Boolean(activeCall?.deafened)}
          onMute={toggleMute}
          onDeafen={toggleDeafen}
          onHangUp={handleEndCall}
        />
      )}

      {/* ─── QUICK DOCK LATERAL (Assistente Compacto) ────────────────────────── */}
      <AnimatePresence>
        {overlayMode === "quick" && (
          <motion.div
            initial={{ opacity: 0, x: 56 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 56 }}
            transition={NOTCH_SPRING}
            style={{ zIndex: PANEL_Z, ...panelStyle }}
            className={`fixed right-3 top-1/2 flex max-h-[calc(100vh-24px)] w-[min(340px,calc(100vw-24px))] -translate-y-1/2 flex-col gap-4 rounded-[28px] p-4 text-white pointer-events-auto ${PANEL_SURFACE_CLASS} ${PANEL_SHADOW}`}
            data-overlay-interactive
            onPointerOver={playHoverIfButton}
          >
            {/* Cabeçalho: usuário + fechar */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <Avatar
                  src={panelData.userAvatar || panelData.profile?.avatar}
                  size={40}
                  fallback={<Gamepad2 className="h-5 w-5" />}
                />
                <div className="min-w-0">
                  <h3 className="truncate text-[13px] font-semibold text-white">
                    {panelData.userDisplay || panelData.profile?.name || "Jogador"}
                  </h3>
                  <span className={`flex items-center gap-1.5 text-[11px] font-medium ${hasCurrentGame ? "text-emerald-300" : "text-white/50"}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${hasCurrentGame ? "bg-emerald-400 animate-pulse" : "bg-white/40"}`} />
                    {hasCurrentGame ? "Em jogo" : "Online"}
                  </span>
                </div>
              </div>
              <NotchIconButton onClick={closeOverlay} title="Fechar overlay">
                <X className="h-4 w-4" />
              </NotchIconButton>
            </div>

            {/* Jogo atual */}
            <div className="relative overflow-hidden rounded-[22px] bg-white/[0.06]">
              {gameArt ? (
                <>
                  <img src={gameArt} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#050506]/90 via-[#050506]/45 to-transparent" />
                </>
              ) : null}
              <div className="relative flex flex-col gap-1 p-4">
                <SectionLabel>Jogo atual</SectionLabel>
                <h4 className="truncate text-[15px] font-semibold text-white">
                  {panelData.gameTitle || "Nenhum jogo em execução"}
                </h4>
                {hasCurrentGame ? (
                  <p className="text-[11px] font-medium tabular-nums text-white/65">
                    {sessionStartedAt ? `Sessão ${sessionClock}` : sessionClock}
                  </p>
                ) : (
                  <p className="text-[11px] leading-relaxed text-white/55">
                    Abra um jogo pela biblioteca para acompanhar a sessão e suas conquistas.
                  </p>
                )}
                {totalCount > 0 && (
                  <div className="mt-2">
                    <div className="mb-1.5 flex justify-between text-[10px] font-medium tabular-nums text-white/55">
                      <span>Troféus {unlockedCount} / {totalCount}</span>
                      <span>{progressPercent}%</span>
                    </div>
                    <ProgressBar percent={progressPercent} label={`${progressPercent}% das conquistas desbloqueadas`} />
                  </div>
                )}
              </div>
            </div>

            {/* Menu rápido */}
            <div className="flex flex-col gap-1.5">
              <SectionLabel>Menu rápido</SectionLabel>
              <PanelRow
                icon={<Trophy className="h-4 w-4" style={{ color: accentColor }} />}
                label="Conquistas"
                trailing={
                  hasCurrentGame && (totalCount > 0 || unlockedCount > 0)
                    ? `${unlockedCount}/${totalCount || "?"}`
                    : "—"
                }
                onClick={() => { goView("achievements"); goMode("full"); }}
              />
              <PanelRow
                icon={<Users className="h-4 w-4" style={{ color: accentColor }} />}
                label="Amigos"
                trailing={`${onlineFriends.length} online`}
                onClick={() => { goView("friends"); goMode("full"); }}
              />
              <PanelRow
                icon={<MessageSquare className="h-4 w-4" style={{ color: accentColor }} />}
                label="Bate-papo"
                onClick={() => { goView("chat"); goMode("full"); }}
              />
              <PanelRow
                icon={<Camera className="h-4 w-4" style={{ color: accentColor }} />}
                label="Capturas"
                onClick={() => { goView("media"); goMode("full"); }}
              />
              <PanelRow
                icon={<Camera className="h-4 w-4" style={{ color: accentColor }} />}
                label="Capturar tela"
                trailing={formatShortcutLabel(captureShortcut)}
                onClick={() => { void takeCapture(); }}
              />
            </div>

            {/* Rodapé */}
            <div className="flex flex-col gap-2">
              <PillButton variant="primary" onClick={() => goMode("full")} className="w-full">
                <Maximize2 className="h-3.5 w-3.5" />
                Expandir overlay
              </PillButton>
              <div className="flex items-center justify-between gap-2 px-1 text-[10px] text-white/40">
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
                  className={`min-h-9 rounded-full px-2.5 transition-colors hover:bg-white/[0.08] hover:text-white ${FOCUS_RING}`}
                >
                  Contraste: {autoContrast ? "Alto" : "Padrão"}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── COMMAND CENTER: GAVETA LATERAL TRANSLÚCIDA ──────────────────────── */}
      <AnimatePresence>
        {overlayMode === "full" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-label="Central de comando do overlay"
            style={{ zIndex: PANEL_Z }}
            className="pointer-events-none fixed inset-0"
          >
            {/* degradê leve na borda direita: legibilidade sem escurecer o jogo */}
            <div className="pointer-events-none absolute inset-y-0 right-0 w-[640px] max-w-full bg-gradient-to-l from-black/55 via-black/20 to-transparent" />
            <motion.div
              initial={{ opacity: 0, x: 72 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 72 }}
              transition={NOTCH_SPRING}
              style={panelStyle}
              className={`pointer-events-auto absolute bottom-3 right-3 top-3 flex w-[min(460px,calc(100vw-24px))] flex-col overflow-hidden rounded-[28px] text-white ${PANEL_SURFACE_CLASS} ${PANEL_SHADOW}`}
              data-system-page="true"
              data-overlay-interactive
              onPointerOver={playHoverIfButton}
            >
              {/* Cabeçalho */}
              <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-5">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar
                    src={panelData.userAvatar || panelData.profile?.avatar}
                    size={40}
                    fallback={<Gamepad2 className="h-5 w-5" />}
                  />
                  <div className="min-w-0">
                    <h3 className="truncate text-[14px] font-semibold text-white">
                      {panelData.userDisplay || panelData.profile?.name || "Jogador"}
                    </h3>
                    <p className={`flex items-center gap-1.5 text-[11px] font-medium ${hasCurrentGame ? "text-emerald-300" : "text-white/50"}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${hasCurrentGame ? "bg-emerald-400 animate-pulse" : "bg-white/40"}`} />
                      {hasCurrentGame ? "Em jogo" : "Online"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <NotchIconButton onClick={() => goMode("quick")} title="Recolher para o dock rápido">
                    <Minimize2 className="h-4 w-4" />
                  </NotchIconButton>
                  <NotchIconButton onClick={closeOverlay} title="Fechar overlay (Esc)">
                    <X className="h-4 w-4" />
                  </NotchIconButton>
                </div>
              </div>

              {/* Abas em pílulas: a ativa mostra o rótulo, as demais só o ícone */}
              <nav className="flex items-center gap-1.5 px-5 pb-3" aria-label="Seções do overlay">
                {([
                  { id: "home", label: "Início", icon: Gamepad2 },
                  { id: "achievements", label: "Conquistas", icon: Trophy },
                  { id: "friends", label: "Amigos", icon: Users },
                  { id: "chat", label: "Chat", icon: MessageSquare },
                  { id: "media", label: "Capturas", icon: Camera },
                  { id: "mascot", label: "Mascote", icon: Sparkles },
                  { id: "settings", label: "Ajustes", icon: Settings },
                ] as const).map((tab) => {
                  const active = activeView === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => goView(tab.id)}
                      aria-current={active ? "page" : undefined}
                      aria-label={tab.label}
                      title={tab.label}
                      className={`flex h-10 items-center justify-center gap-2 rounded-full text-[12px] font-semibold transition-all duration-200 active:scale-95 ${FOCUS_RING} ${
                        active
                          ? "bg-white px-4 text-black"
                          : "w-10 bg-white/[0.06] text-white/60 hover:bg-white/[0.14] hover:text-white"
                      }`}
                    >
                      <tab.icon className="h-4 w-4 shrink-0" />
                      {active && <span>{tab.label}</span>}
                    </button>
                  );
                })}
              </nav>

              {/* Área de conteúdo */}
              <div className="flex min-w-0 flex-1 flex-col overflow-y-auto px-5 pb-5 pt-1 thin-scrollbar">
                {activeView === "home" && (
                  <div className="flex flex-col gap-6">
                    <div className="relative overflow-hidden rounded-[24px] bg-white/[0.06]">
                      {gameArt ? (
                        <img src={gameArt} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />
                      ) : null}
                      <div className="relative p-5">
                        <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/35">
                          {hasCurrentGame ? "Jogo ativo" : "Nenhuma sessão ativa"}
                        </span>
                        <h2 className="mt-1 truncate text-xl font-semibold tracking-tight text-white">
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
                        className="min-h-10 w-fit rounded-full bg-white px-4 text-xs font-semibold text-black hover:bg-white/90"
                      >
                        Voltar à biblioteca
                      </Button>
                    )}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-2xl bg-white/[0.06] p-3">
                        <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/35">Sessão atual</span>
                        <p className="mt-2 text-base font-semibold tabular-nums text-white">
                          {hasCurrentGame ? sessionClock : "—"}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-white/[0.06] p-3">
                        <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/35">Conquistas</span>
                        <p className="mt-2 text-base font-semibold text-white">
                          {hasCurrentGame && totalCount > 0 ? `${unlockedCount} / ${totalCount}` : "—"}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-white/[0.06] p-3">
                        <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/35">Amigos online</span>
                        <p className="mt-2 text-base font-semibold text-white">{onlineFriends.length}</p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      onClick={() => { void takeCapture(); }}
                      className="min-h-10 w-fit rounded-full bg-white px-4 text-xs font-semibold text-black hover:bg-white/90"
                    >
                      <Camera className="mr-1.5 h-3.5 w-3.5" /> Capturar tela ({formatShortcutLabel(captureShortcut)})
                    </Button>
                  </div>
                )}

                {activeView === "achievements" && (
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-semibold text-white">Conquistas do Jogo</h3>
                      <span className="text-xs font-bold text-white/60">{unlockedCount} de {totalCount} desbloqueadas</span>
                    </div>
                    {totalCount > 0 && <ProgressBar percent={progressPercent} />}

                    {achievementsLoading ? (
                      <div className="flex flex-col items-center justify-center rounded-2xl bg-white/[0.04] py-16 text-center" aria-busy="true">
                        <Loader2 className="mb-3 h-8 w-8 animate-spin text-white/60" aria-hidden="true" />
                        <p className="text-sm font-bold text-white/70">Carregando conquistas…</p>
                      </div>
                    ) : achievementList.length === 0 ? (
                      <div className="flex flex-col items-center justify-center rounded-2xl bg-white/[0.04] py-16 text-center">
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
                        {achievementList.map((ach: any, idx: number) => {
                          const achKey = ach.apiName || ach.id || `ach-${idx}`;
                          const isExpanded = expandedAchId === achKey;
                          return (
                            <div
                              key={achKey}
                              onClick={() => setExpandedAchId((prev) => (prev === achKey ? null : achKey))}
                              className="flex items-start gap-3.5 rounded-2xl bg-white/[0.06] p-3.5 cursor-pointer hover:bg-white/[0.06] transition-colors"
                            >
                              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 overflow-hidden mt-0.5">
                                {ach.icon ? (
                                  <img src={ach.icon} alt="" className="h-full w-full object-cover" />
                                ) : (
                                  <Trophy className="h-5 w-5 text-white/70" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <h4 className="text-xs font-bold text-white">{ach.name || ach.displayName || "Conquista"}</h4>
                                <p className={`text-[11px] text-white/50 mt-0.5 leading-relaxed ${isExpanded ? "" : "line-clamp-1"}`}>
                                  {ach.description || "Sem descrição"}
                                </p>
                              </div>
                              <span
                                className={`rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wider shrink-0 mt-0.5 ${
                                  ach.achieved
                                    ? "bg-emerald-500/20 text-emerald-300"
                                    : "bg-white/5 text-white/40"
                                }`}
                              >
                                {ach.achieved ? "Desbloqueada" : "Bloqueada"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {activeView === "friends" && (
                  <div className="flex flex-col gap-4">
                    <h3 className="text-base font-semibold text-white">Amigos</h3>
                    {(panelData.friends || []).length === 0 ? (
                      <div className="flex flex-col items-center justify-center rounded-2xl bg-white/[0.04] py-14 px-6 text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-white/40 mb-3">
                          <Users className="h-6 w-6" aria-hidden="true" />
                        </div>
                        <h4 className="text-sm font-bold text-white">Nenhum amigo na lista</h4>
                        <p className="mt-1 max-w-xs text-xs text-white/50">
                          Adicione amigos pelo launcher para conversar e jogar junto.
                        </p>
                        <Button
                          type="button"
                          onClick={() => {
                            (window as any).achievementOverlay?.panelAction?.({ kind: "open-launcher-friends" });
                          }}
                          className="mt-4 min-h-10 rounded-full bg-white px-5 text-xs font-bold text-black hover:bg-white/90"
                        >
                          <UserPlus className="mr-2 h-4 w-4" />
                          Adicionar amigo
                        </Button>
                      </div>
                    ) : (
                    <div className="grid grid-cols-1 gap-2">
                      {(panelData.friends || []).map((friend: any, idx: number) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between rounded-2xl bg-white/[0.06] p-3.5"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="relative h-10 w-10 rounded-full bg-white/10 shrink-0 overflow-hidden">
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
                                {presenceLabel(friend.status, friend.playing)}
                              </p>
                            </div>
                          </div>
                          {friend.canChat && (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleVoiceCall(friend.id, friend.name, friend.avatar)}
                                className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 px-2.5 py-1.5 text-xs font-bold transition-all"
                                title="Ligar para amigo"
                              >
                                <Phone className="h-3.5 w-3.5" /> Ligar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSelectChat(friend.id)}
                                className="flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-white/15 transition-all"
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
                        <div className="flex items-center justify-between pb-3.5 mb-4">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={handleCloseChat}
                              aria-label="Voltar para amigos"
                              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-white/70 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white"
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </button>
                            <div className="h-9 w-9 rounded-full bg-white/10 overflow-hidden shrink-0">
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
                            className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 px-3 py-1.5 text-xs font-bold transition-all"
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
                                  className={`max-w-[84%] rounded-2xl px-4 py-2.5 text-xs shadow-md ${
                                    msg.mine
                                      ? "bg-white text-black font-medium"
                                      : "bg-white/[0.07] text-white"
                                  }`}
                                >
                                  {msg.attachmentUrl && (
                                    <div className="mb-2 overflow-hidden rounded-2xl">
                                      <button
                                        type="button"
                                        onClick={() => setViewingCapture({ id: msg.attachmentUrl!, url: msg.attachmentUrl! })}
                                        className="relative group block w-full cursor-pointer"
                                      >
                                        <img src={msg.attachmentUrl} alt="Anexo" className="max-h-48 w-full object-cover rounded-2xl" />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-2xl transition-opacity">
                                          <ZoomIn className="h-6 w-6 text-white" />
                                        </div>
                                      </button>
                                    </div>
                                  )}
                                  {msg.text && <p className="break-words leading-relaxed">{msg.text}</p>}
                                  {msg.failed ? (
                                    <div className="mt-1.5 flex items-center justify-between gap-2 pt-1 border-t border-rose-500/20 text-[9px]">
                                      <span className="font-bold text-rose-400">Falha ao enviar</span>
                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            (window as any).achievementOverlay?.panelAction?.({
                                              kind: "retry-message",
                                              messageId: msg.id,
                                              text: msg.text,
                                            });
                                          }}
                                          className="font-bold text-amber-300 hover:text-amber-200 underline cursor-pointer"
                                        >
                                          Tentar de novo
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setInputText(msg.text)}
                                          className="text-white/60 hover:text-white underline cursor-pointer"
                                        >
                                          Restaurar texto
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <span className={`mt-1 block text-right text-[9px] font-bold ${msg.mine ? "text-black/50" : "text-white/40"}`}>
                                      {msg.pending ? "Enviando…" : new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                    </span>
                                  )}
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
                            className="min-h-10 flex-1 rounded-full bg-white/5 px-4 py-2.5 text-xs text-white placeholder-white/30 focus:border-white/30 focus:outline-none"
                          />
                          <button
                            type="submit"
                            disabled={!inputText.trim() || panelData.chat.sending}
                            aria-label={panelData.chat.sending ? "Enviando mensagem" : "Enviar mensagem"}
                            className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-black hover:bg-white/90 disabled:opacity-40"
                          >
                            {panelData.chat.sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                          </button>
                        </form>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        <h3 className="text-base font-semibold text-white">Selecione um Amigo para Conversar</h3>
                        {(panelData.friends || []).filter((f: any) => f.canChat).length === 0 ? (
                          <div className="flex flex-col items-center justify-center rounded-2xl bg-white/[0.04] py-16 text-center">
                            <MessageSquare className="mb-3 h-9 w-9 text-white/20" aria-hidden="true" />
                            <p className="text-sm font-bold text-white/70">Nenhuma conversa disponível</p>
                            <p className="mt-1 max-w-xs text-xs text-white/50">Quando um amigo estiver disponível, você poderá iniciar um chat aqui.</p>
                          </div>
                        ) : (
                        <div className="grid grid-cols-1 gap-2">
                          {(panelData.friends || [])
                            .filter((f: any) => f.canChat)
                            .map((friend: any, idx: number) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => handleSelectChat(friend.id)}
                                className="flex min-h-16 items-center gap-3 rounded-2xl bg-white/[0.06] p-4 text-left transition-all hover:bg-white/[0.07] focus-visible:outline-2 focus-visible:outline-white"
                              >
                                <div className="h-9 w-9 rounded-full bg-white/10 overflow-hidden shrink-0">
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
                      <h3 className="text-base font-semibold text-white">Capturas de Tela</h3>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            uiSound();
                            void loadCaptures();
                          }}
                          className="rounded-full bg-white/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white/70 hover:bg-white/10"
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
                          className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white/70 hover:bg-white/10"
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
                      <div className="flex flex-col items-center justify-center rounded-2xl bg-white/[0.04] py-16 text-center">
                        <Camera className="mb-3 h-9 w-9 text-white/20" aria-hidden="true" />
                        <p className="text-sm font-bold text-white/70">Nenhuma captura ainda</p>
                        <p className="mt-1 max-w-xs text-xs text-white/50">
                          As capturas em Pictures/Phelierium Captures aparecerão aqui.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2.5">
                        {captures.map((cap) => (
                          <div
                            key={cap.id}
                            className="group relative h-32 overflow-hidden rounded-2xl"
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
                                className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white opacity-0 transition-opacity hover:bg-rose-500 group-hover:opacity-100 focus-visible:opacity-100"
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

                {activeView === "mascot" && (
                  <div className="flex flex-col gap-4">
                    <h3 className="text-base font-semibold text-white">Mascote</h3>
                    <MascotCustomizer compact />
                  </div>
                )}

                {activeView === "settings" && (
                  <div className="flex flex-col gap-4">
                    <h3 className="text-base font-semibold text-white">Ajustes do Overlay</h3>
                    <div className="rounded-2xl bg-white/[0.06] p-4 space-y-4">
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
                          className="min-h-10 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white transition-colors hover:bg-white/16 focus-visible:outline-2 focus-visible:outline-white"
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
                          className="min-h-10 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white transition-colors hover:bg-white/16 focus-visible:outline-2 focus-visible:outline-white"
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
              className="relative max-w-5xl max-h-[85vh] overflow-hidden rounded-[28px] bg-black/70 shadow-[0_24px_80px_rgba(0,0,0,0.6)] p-2"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => {
                  setConfirmDeleteCapture(false);
                  setViewingCapture(null);
                }}
                aria-label="Fechar imagem"
                className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/70 text-white transition-all hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white"
              >
                <X className="h-5 w-5" />
              </button>
              {viewingCapture.path ? (
                confirmDeleteCapture ? (
                  <div className="absolute left-4 top-4 z-10 flex items-center gap-2 rounded-2xl bg-black/80 px-3 py-2">
                    <span className="text-[11px] font-bold text-white">Excluir esta foto?</span>
                    <button
                      type="button"
                      onClick={() => void deleteCapture(viewingCapture)}
                      className="rounded-full bg-rose-500 px-2.5 py-1 text-[10px] font-semibold uppercase text-white hover:bg-rose-400"
                    >
                      Excluir
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteCapture(false)}
                      className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase text-white hover:bg-white/20"
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
                    className="absolute left-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/70 text-white transition-all hover:bg-rose-500 focus-visible:outline-2 focus-visible:outline-white"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )
              ) : null}
              <div className="relative">
                <img
                  src={fullResImageUrl || viewingCapture.url}
                  alt="Captura ampliada"
                  className="max-h-[80vh] max-w-full rounded-2xl object-contain transition-opacity duration-300"
                />
                {fullResLoading && (
                  <div className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-lg bg-black/70 px-2.5 py-1 text-[10px] font-bold text-white/70 backdrop-blur-md">
                    <Loader2 className="h-3 w-3 animate-spin text-white" />
                    Carregando alta resolução…
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default OverlayApp;
