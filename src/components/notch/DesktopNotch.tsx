import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Home,
  Settings2,
  Maximize2,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Phone,
  PhoneOff,
  Gamepad2,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Sparkles,
  Trophy,
} from "../../design-system/sf-symbols/lucideCompat";
import { useVoiceCallContext } from "../../context/VoiceCallContext";
import { PherieMascot, getMascotBaseMood, type MascotMood, type PherieMascotProps } from "./PherieMascot";
import { hasTauriRuntime, useVoiceLevelRef } from "../../mascot/useVoiceLevel";
import { useNotchConfig, useOverlayAppearance } from "../../mascot/useNotchConfig";
import {
  EXPANDED_RADIUS_BONUS,
  chamferClipPath,
  notchBoxShadow,
  resolveNotchStyle,
  surfaceColor,
} from "../../mascot/notchTheme";
import {
  CLOSE_TRANSITION,
  NOTCH_EXPAND_SPRING,
  NOTCH_HIDDEN_Y,
  OPEN_SPRING,
  VIEW_IN_S,
  VIEW_OUT_S,
  geometryTransition,
  notchPositionTransition,
} from "../../mascot/motion";
import { playNotchSound, type NotchSoundId } from "./notchSounds";
import { usePreferences } from "../../context/PreferencesContext";
import { RetroBubble } from "./RetroBubble";
import { ControllerFlashBar, FLASH_MASCOT_MOOD, useControllerFlash } from "./ControllerFlashBar";
import { CONTROLLER_FLASH_WIDTH } from "./controllerFlash";
import { NotchEventBar, useNotchEvent } from "./NotchEventBar";
import { NOTCH_EVENT_MOOD, NOTCH_EVENT_WIDTH, notchEventWaves, type NotchEvent } from "./notchEvent";
import { AchievementReveal } from "./AchievementReveal";
import { achievementBoxShadow, tierStyle } from "./achievementTier";
import { subscribeTicker } from "../../mascot/ticker";
import { useSituationMood } from "../../mascot/useSituationMood";
import { MusicWaveform } from "./MusicWaveform";
import { MediaProgress } from "./live/MediaProgress";
import { GameTab } from "./live/GameTab";
import type { NotchGameTabData } from "./gameTabData";
import { CalendarWidget, LyricsWidget, WeatherWidget } from "./widgets/NotchWidgets";
import { useNotchLyrics } from "./widgets/useNotchWidgetData";
import { useCoverColor } from "./widgets/coverColor";
import { appleSprings } from "../../design-system/motion";
import { PRESENCE_HEARTBEAT_MS, announcePherieInNotch } from "../../mascot/pherieHandoff";
import { CallIncomingBar } from "./live/CallIncomingBar";
import { VoiceBars } from "./live/VoiceBars";
import { LIVE_WIDTH, resolveLiveActivity } from "./live/liveActivity";
import { ControllerTab } from "./live/ControllerTab";
import { playPherieVoice, voiceForMoodChange } from "./pherieVoice";
import { useControllerState } from "./controllerState";
import { parseTimeline, type MediaTimeline } from "./live/progressMath";
import {
  DIZZY_DURATION_MS,
  distanceToRect,
  isCursorAtTop,
  isMouseShake,
} from "../../mascot/cursorReactions";
import type { NotchConfig } from "../../mascot/notchConfig";

export interface DesktopNotchOverlayCall {
  active: boolean;
  friendName?: string;
  friendAvatar?: string;
  muted?: boolean;
  deafened?: boolean;
  speaking?: boolean;
  durationSeconds?: number;
}

export interface DesktopNotchProps {
  className?: string;
  activeGameTitle?: string | null;
  activeGameElapsedSeconds?: number;
  isOverlay?: boolean;
  overlayCall?: DesktopNotchOverlayCall | null;
  onOverlayMute?: () => void;
  onOverlayDeafen?: () => void;
  onOverlayHangUp?: () => void;
  /** Overlay do jogo aberto (painel rápido/completo): único momento em que o mouse revela o notch no jogo. */
  overlayActive?: boolean;
  /** Overlay: pede ao hub para abrir a janela da chamada. */
  onOverlayOpenCall?: () => void;
  /** Overlay: chamada recebida (vinda do hub) com as ações de atender/recusar. */
  overlayIncomingCall?: { name: string; avatar?: string | null; onAccept: () => void; onReject: () => void } | null;
  /** Configuração do notch (o overlay passa a sua; sem ela o notch lê a gravada). */
  config?: NotchConfig;
  /** Volume dos efeitos do launcher (0..1) para os sons do notch. */
  soundVolume?: number;
  /** Tema sonoro do launcher: os sons do notch seguem o mesmo pacote da interface. */
  soundTheme?: string;
  /**
   * Chamado uma vez quando um aviso passa a ser o da vez na tela (não quando chega à fila). É o
   * momento certo de tocar o som da conquista: com várias na fila, cada uma toca na sua vez.
   */
  onEventShown?: (event: NotchEvent) => void;
  /** Dados da aba "Jogo" (conquistas e amigos jogando); a aba só existe com um jogo em andamento. */
  gameTab?: NotchGameTabData | null;
}

export interface DetectedMediaState {
  hasMedia: boolean;
  type: "video" | "music" | "none";
  title: string;
  artist: string;
  /** URL/data-URI da capa quando o backend fornecer; vazio = tile padrão. */
  thumbnail: string;
  isPlaying: boolean;
  sourceApp?: string | null;
}

export const formatSeconds = (secs: number) => {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

export function resolveMascotMood(params: {
  isCallActive: boolean;
  isMuted: boolean;
  activeGameTitle: string | null;
  isMusicPlaying: boolean;
  viewState: "peek" | "compact" | "expanded";
}): MascotMood {
  if (params.isCallActive) {
    return params.isMuted ? "muted" : "calling";
  }
  if (params.activeGameTitle) return "gaming";
  if (params.isMusicPlaying) return "music";
  if (params.viewState === "peek") return "sleeping";
  return "idle";
}

/** Preto "de notch": levemente quente para não parecer um buraco no wallpaper. */
export const NOTCH_SPRING = OPEN_SPRING;
/** Larga o bastante para música + letra lado a lado (como nos widgets do Notchify). */
const NOTCH_EXPANDED_WIDTH = 500;
/**
 * Altura da barra do notch. Exportada porque o hub precisa reservar esse espaço
 * no topo mesmo quando não é ele quem desenha o notch (em Tauri quem desenha é
 * a janela de overlay, que é outro documento).
 */
export const NOTCH_BAR_HEIGHT = 42;
/** Tamanho da Pherie na barra compacta (antes 26: pequena demais para ver o rosto). */
const BAR_MASCOT = 30;
/** Tempo de tontura depois de cliques demais na Pherie. */
const OVERLOAD_MS = 3000;

const EMPTY_MEDIA: DetectedMediaState = {
  hasMedia: false,
  type: "none",
  title: "",
  artist: "",
  thumbnail: "",
  isPlaying: false,
};

function sameMedia(a: DetectedMediaState, b: DetectedMediaState): boolean {
  return (
    a.hasMedia === b.hasMedia &&
    a.title === b.title &&
    a.artist === b.artist &&
    a.thumbnail === b.thumbnail &&
    a.isPlaying === b.isPlaying &&
    a.sourceApp === b.sourceApp
  );
}

/** "Spotify.exe" / "Microsoft.ZuneMusic_8wekyb3d8bbwe!App" → nome curto legível. */
export function prettySourceApp(raw?: string | null): string {
  if (!raw) return "";
  const base = raw.split("!")[0] ?? raw;
  const parts = base.replace(/\.exe$/i, "").split(/[._]/).filter(Boolean);
  const name = parts.length > 1 && /^[a-z0-9]{13}$/i.test(parts[parts.length - 1]) ? parts[parts.length - 2] : parts[0];
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : "";
}

/**
 * Política de auto-hide (Bloom): o notch só se esconde quando outro app está em
 * primeiro plano. Chamada ou jogo em andamento NÃO fixam o notch: o cursor no
 * topo da tela sempre o revela, e o mute/desligar seguem no painel.
 */
export function shouldAutoHide(params: {
  isWindowOverlapping: boolean;
  isCallActive: boolean;
  isGameRunning: boolean;
  disabled: boolean;
}): boolean {
  if (params.disabled) return false;
  return params.isWindowOverlapping;
}

/** Largura da barra compacta conforme o que está acontecendo. */
export function resolveNotchCompactWidth(params: {
  isCallActive: boolean;
  activeGameTitle: string | null;
  isPcMediaPlaying: boolean;
}): number {
  if (params.isCallActive) return LIVE_WIDTH.call;
  if (params.activeGameTitle) return LIVE_WIDTH.game;
  if (params.isPcMediaPlaying) return LIVE_WIDTH.music;
  return LIVE_WIDTH.idle;
}

/** Indicador de música: 4 barras com ondulação própria (não segue o som). Ao começar a tocar,
 * entra com um "pop"; pausado, recolhe para o mínimo. */
const Equalizer: React.FC<{ playing: boolean; height?: number }> = ({ playing, height = 16 }) => {
  const barRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const smoothRef = useRef<[number, number, number, number]>([0.25, 0.25, 0.25, 0.25]);

  useEffect(() => {
    const smooth = smoothRef.current;
    return subscribeTicker((dt, now) => {
      const t = now * 0.006;
      const target: number[] = playing
        ? [
            0.25 + 0.65 * Math.abs(Math.sin(t * 1.35)),
            0.25 + 0.72 * Math.abs(Math.sin(t * 1.95 + 1.1)),
            0.25 + 0.7 * Math.abs(Math.sin(t * 1.55 + 2.3)),
            0.25 + 0.6 * Math.abs(Math.sin(t * 2.25 + 0.6)),
          ]
        : [0.22, 0.22, 0.22, 0.22];
      const k = 1 - Math.exp(-22 * Math.max(0.001, dt));
      for (let i = 0; i < 4; i++) {
        smooth[i] += (target[i] - smooth[i]) * k;
        const el = barRefs.current[i];
        if (el) el.style.height = `${Math.max(3, Math.round(smooth[i] * height))}px`;
      }
    });
  }, [height, playing]);

  const minH = Math.max(3, Math.round(height * 0.25));

  return (
    <motion.div
      key={playing ? "on" : "off"}
      initial={playing ? { scale: 0.3, opacity: 0 } : false}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 520, damping: 14 }}
      className="flex items-end gap-[2.5px] shrink-0"
      style={{ height, originY: 1 }}
      aria-hidden
    >
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          ref={(el) => {
            barRefs.current[i] = el;
          }}
          className="w-[2.5px] rounded-full bg-white"
          style={{ height: minH }}
        />
      ))}
    </motion.div>
  );
};

/** Toque dos botões da notch: só propriedades nomeadas, aperta rápido (75 ms) e solta macio (160 ms). */
const NOTCH_PRESS =
  "transition-[transform,background-color,color,opacity,filter] duration-[160ms] ease-[var(--ease-out-strong)] active:duration-75 motion-reduce:transition-colors motion-reduce:active:scale-100";

const TAB_ORDER = ["home", "controller", "game"] as const;
/** Largura do botão da aba (w-11) + espaço entre eles (gap-1): o passo da pílula deslizante. */
const TAB_STEP_PX = 48;

export const NotchIconButton: React.FC<{
  onClick: (e: React.MouseEvent) => void;
  title: string;
  active?: boolean;
  tone?: "default" | "danger" | "warn";
  wide?: boolean;
  children: React.ReactNode;
}> = ({ onClick, title, active = false, tone = "default", wide = false, children }) => {
  const toneClass =
    tone === "danger"
      ? "bg-[#f4505e] text-white hover:brightness-110"
      : active && tone === "warn"
      ? "bg-[#f5a524]/20 text-[#f5a524] hover:bg-[#f5a524]/30"
      : active
      ? "bg-[#f4505e]/20 text-[#f4505e] hover:bg-[#f4505e]/30"
      : "bg-white/[0.09] text-[#f5f6f8] hover:bg-white/[0.15]";
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={`h-9 ${wide ? "px-4" : "w-9"} shrink-0 rounded-full flex items-center justify-center gap-1.5 text-[11px] font-semibold ${NOTCH_PRESS} active:scale-[0.94] ${toneClass}`}
    >
      {children}
    </button>
  );
};

// Toggle temporário de DEV: desativa o auto-hide da notch.
// Console: __pherieliumNotchAutohide(false) desliga o auto-hide, __pherieliumNotchAutohide(true) religa.
// Também vale: localStorage pherielium_notch_no_autohide="1" ou URL ?notch-autohide=0
export function isNotchAutoHideDisabled(): boolean {
  try {
    const w = window as unknown as Record<string, unknown>;
    if (w.__PHERIELIUM_NOTCH_NO_AUTOHIDE__ === true) return true;
    if (w.__PHERIELIUM_NOTCH_NO_AUTOHIDE__ === false) return false;
    const stored = localStorage.getItem("pherielium_notch_no_autohide");
    if (stored === "1") return true;
    if (stored === "0") return false;
    if (new URLSearchParams(window.location.search).get("notch-autohide") === "0") return true;
  } catch {}
  return false;
}

export function setNotchAutoHideDisabled(disabled: boolean): void {
  try {
    (window as unknown as Record<string, unknown>).__PHERIELIUM_NOTCH_NO_AUTOHIDE__ = disabled;
    if (disabled) localStorage.setItem("pherielium_notch_no_autohide", "1");
    else localStorage.removeItem("pherielium_notch_no_autohide");
    window.dispatchEvent(new CustomEvent("pherielium:notch-autohide-changed"));
  } catch {}
}

/** Cursor fora do alcance: o mascote volta ao olhar do humor (quando `followCursor` está desligado). */
const NO_CURSOR_T0 = 0;

export interface CursorPos {
  x: number;
  y: number;
  t: number;
  /** px/s recentes (thread de cursor do Rust; 0 no mousemove do DOM) */
  speed?: number;
  /** inversões de direção em ~0,6 s */
  reversals?: number;
  /** botão esquerdo pressionado */
  dragging?: boolean;
}

const NO_CURSOR: CursorPos = { x: -9999, y: -9999, t: NO_CURSOR_T0 };

/** Posição do cursor (mousemove + evento do overlay, que funciona com click-through). */
export function useCursorPos(): CursorPos {
  const [pos, setPos] = useState<CursorPos>({ x: -9999, y: -9999, t: 0 });
  useEffect(() => {
    const push = (x: number, y: number, extra?: Partial<CursorPos>) => {
      setPos((prev) =>
        Math.abs(x - prev.x) < 6 && Math.abs(y - prev.y) < 6 && !extra?.dragging && !prev.dragging
          ? prev
          : { x, y, t: Date.now(), ...extra },
      );
    };
    const onMove = (e: MouseEvent) => push(e.clientX, e.clientY);
    window.addEventListener("mousemove", onMove, { passive: true });
    let unlisten: (() => void) | undefined;
    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      void import("@tauri-apps/api/event").then(({ listen }) => {
        void listen<{ x: number; y: number; speed?: number; reversals?: number; dragging?: boolean }>(
          "overlay:cursor",
          (event) => {
            const { x, y, speed, reversals, dragging } = event.payload;
            push(x, y, { speed, reversals, dragging });
          },
        ).then((fn) => {
          unlisten = fn;
        });
      });
    }
    return () => {
      window.removeEventListener("mousemove", onMove);
      unlisten?.();
    };
  }, []);
  return pos;
}

/** Mascote cujos olhos seguem o cursor (estilo Mochi/Coucou). */
export const GazingMascot: React.FC<PherieMascotProps & { cursor: CursorPos }> = ({
  cursor,
  ...props
}) => (
  // O próprio mascote mede a distância até o cursor a cada frame (cabeça + olhos
  // do engine); aqui só repassamos o ponteiro global (DOM + evento do overlay).
  <div className="flex items-center justify-center">
    <PherieMascot {...props} pointer={cursor} />
  </div>
);

/** Avatar redondo com fallback de inicial (nunca texto longo tipo "VOZ"). */
const CallAvatar: React.FC<{ src?: string; name?: string; size: number; speaking?: boolean }> = ({
  src,
  name,
  size,
  speaking = false,
}) => (
  <span
    className={`relative shrink-0 rounded-full flex items-center justify-center overflow-hidden bg-emerald-500/20 text-emerald-300 font-bold transition-shadow duration-200 ${
      speaking ? "shadow-[0_0_0_2px_#34d399]" : "shadow-[0_0_0_1px_rgba(255,255,255,0.14)]"
    }`}
    style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
  >
    {src ? (
      <img src={src} alt="" className="w-full h-full object-cover" draggable={false} />
    ) : (
      (name?.trim().charAt(0) || "V").toUpperCase()
    )}
  </span>
);

export const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="mb-2 text-[11px] font-semibold leading-none text-[#9398a1]">{children}</p>
);

/** Cores de status do Coucou usadas no "wash" dos cartões. */
const CARD_WASH = {
  green: "34,197,94",
  indigo: "99,102,241",
  pink: "244,114,182",
  neutral: "255,255,255",
} as const;

/**
 * Cartão do painel: raio 24 (= raio externo do notch 40 − respiro de 16px, então os cantos
 * ficam concêntricos), hairline interna e um brilho radial na cor de status.
 */
export const NotchCard: React.FC<{
  tone?: keyof typeof CARD_WASH;
  /** "r, g, b" da capa da música: troca o brilho de status por um degradê nessa cor. */
  rgb?: string | null;
  children: React.ReactNode;
}> = ({ tone = "neutral", rgb, children }) => (
  <section
    className="overflow-hidden rounded-[24px] bg-[#171717] p-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
    style={{
      backgroundImage: rgb
        ? `linear-gradient(150deg, rgba(${rgb}, 0.62) 0%, rgba(${rgb}, 0.2) 100%)`
        : `radial-gradient(120% 140% at 50% 130%, rgba(${CARD_WASH[tone]}, ${tone === "neutral" ? 0.08 : 0.38}) 0%, transparent 62%)`,
      transition: "background-image 400ms ease",
    }}
  >
    {children}
  </section>
);

export const DesktopNotch: React.FC<DesktopNotchProps> = ({
  className = "",
  activeGameTitle = null,
  activeGameElapsedSeconds = 0,
  isOverlay = false,
  overlayCall = null,
  overlayIncomingCall = null,
  overlayActive = false,
  onOverlayMute,
  onOverlayDeafen,
  onOverlayHangUp,
  onOverlayOpenCall,
  config: configProp,
  soundVolume,
  soundTheme,
  onEventShown,
  gameTab = null,
}) => {
  const voiceCall = useVoiceCallContext();
  // Configuração viva (Configurações → Mascote e Notch). O overlay não tem
  // PreferencesProvider; ela chega de overlay-prefs.json + evento `overlay:prefs`.
  const appearance = useOverlayAppearance();
  const config = configProp ?? appearance.config;
  // Estilo = tema visual do launcher (cyberpunk, ps5...) + ajustes do usuário.
  const notchStyle = useMemo(
    () => resolveNotchStyle(appearance.visualTheme, config),
    [appearance.visualTheme, config],
  );

  // Sons de interação do notch (cada ação tem o seu; mutar/desligar tocam no hook de voz).
  const notchSound = useCallback(
    (id: NotchSoundId) => {
      if (config.sounds) playNotchSound(id, soundVolume, soundTheme);
    },
    [config.sounds, soundVolume, soundTheme],
  );
  const notchSoundRef = useRef(notchSound);
  notchSoundRef.current = notchSound;

  // Estados de visualização do Notch
  const [isExpanded, setIsExpanded] = useState(false);
  // O tutorial (na janela do hub) espera a notch abrir de verdade; o overlay é outro documento, então avisa por evento.
  useEffect(() => {
    if (!isExpanded || !isOverlay || !hasTauriRuntime()) return;
    void import("@tauri-apps/api/event").then(({ emit }) => emit("overlay:notch-expanded", {})).catch(() => undefined);
  }, [isExpanded, isOverlay]);
  const [isHovered, setIsHovered] = useState(false);
  const [currentTime, setCurrentTime] = useState("");
  const collapseTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Desvio de janelas / Programa aberto (Window Overlap Auto-Hide estilo Bloom)
  const [isWindowOverlapping, setIsWindowOverlapping] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);
  const [autoHideDisabled, setAutoHideDisabled] = useState(() => isNotchAutoHideDisabled());
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Expõe toggle de DEV no console + reage a mudanças via localStorage/evento
  useEffect(() => {
    try {
      (window as unknown as Record<string, unknown>).__pherieliumNotchAutohide = (enabled: boolean) => {
        setNotchAutoHideDisabled(!enabled);
        return !enabled ? "auto-hide DESATIVADO (notch sempre visível)" : "auto-hide ATIVADO";
      };
      (window as unknown as Record<string, unknown>).__pherieliumNotchNoAutoHide = (disabled = true) =>
        setNotchAutoHideDisabled(disabled);
    } catch {}
    const sync = () => setAutoHideDisabled(isNotchAutoHideDisabled());
    window.addEventListener("pherielium:notch-autohide-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("pherielium:notch-autohide-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  // Cursor global (olhos do mascote seguem) + expressão base escolhida nas configs
  const cursor = useCursorPos();
  const gazeCursor = config.followCursor ? cursor : NO_CURSOR;
  const [baseMood, setBaseMood] = useState<MascotMood | null>(() => getMascotBaseMood());
  useEffect(() => {
    const syncMood = () => setBaseMood(getMascotBaseMood());
    window.addEventListener("pherielium:mascot-mood-changed", syncMood);
    window.addEventListener("storage", syncMood);
    return () => {
      window.removeEventListener("pherielium:mascot-mood-changed", syncMood);
      window.removeEventListener("storage", syncMood);
    };
  }, []);

  // Status de chamada de voz
  const isCallActive = overlayCall
    ? overlayCall.active
    : (voiceCall.callState === "active" ||
       voiceCall.callState === "connecting" ||
       voiceCall.callState === "ringing-out");

  const callFriendName = overlayCall
    ? overlayCall.friendName
    : voiceCall.session?.friendName;

  const callFriendAvatar = overlayCall
    ? overlayCall.friendAvatar
    : voiceCall.session?.friendAvatar;

  const isMuted = overlayCall
    ? Boolean(overlayCall.muted)
    : voiceCall.isMuted;

  const isDeafened = overlayCall
    ? Boolean(overlayCall.deafened)
    : voiceCall.isDeafened;

  const isSpeaking = overlayCall
    ? Boolean(overlayCall.speaking)
    : (voiceCall.isSpeakingLocal || voiceCall.isSpeakingRemote);

  const callDuration = overlayCall
    ? (overlayCall.durationSeconds || 0)
    : voiceCall.callDuration;

  // Em jogo, o notch do overlay fica recolhido: só aparece com o overlay aberto, numa conquista
  // (ou outro aviso) ou numa chamada. Encostar o mouse no topo da tela não o revela.
  const inGameQuiet = isOverlay && Boolean(activeGameTitle) && !overlayActive && !isCallActive && !autoHideDisabled && config.autoHide;
  const autoHideActive =
    shouldAutoHide({
      isWindowOverlapping,
      isCallActive,
      isGameRunning: Boolean(activeGameTitle),
      disabled: autoHideDisabled || !config.autoHide,
    }) || inGameQuiet;
  // com outro app em foco (tela cheia) também não revela pelo mouse, a menos que o overlay esteja aberto
  const pointerRevealAllowed = !isOverlay || overlayActive || !(inGameQuiet || (isWindowOverlapping && config.autoHide && !autoHideDisabled));
  const pointerRevealRef = useRef(pointerRevealAllowed);
  pointerRevealRef.current = pointerRevealAllowed;

  const handleToggleMute = () => {
    if (onOverlayMute) onOverlayMute();
    else voiceCall.toggleMute();
  };

  const handleToggleDeafen = () => {
    if (onOverlayDeafen) onOverlayDeafen();
    else voiceCall.toggleDeafen();
  };

  // O notch é o widget da chamada: clicar nele reabre a janela da chamada (sem passar pelos canais de voz).
  const handleOpenCall = () => {
    if (onOverlayOpenCall) onOverlayOpenCall();
    else voiceCall.setIsVoiceWindowOpen(true);
  };

  const handleHangUp = () => {
    if (onOverlayHangUp) onOverlayHangUp();
    else voiceCall.hangUp();
  };

  // Multimídia EXCLUSIVA do PC (Windows GSMTC: Spotify, YouTube, Chrome, etc.)
  // NUNCA identifica a música ou temas internos do Hub!
  const [mediaState, setMediaState] = useState<DetectedMediaState>(EMPTY_MEDIA);
  // linha do tempo da faixa (posição/duração): em ref, a barra de progresso anda sem re-render do notch
  const timelineRef = useRef<MediaTimeline | null>(null);
  // Só troca o estado quando algo mudou de fato (o poll roda a cada 1,5s).
  const applyMedia = useCallback((next: DetectedMediaState) => {
    setMediaState((prev) => (sameMedia(prev, next) ? prev : next));
  }, []);

  // Relógio digital
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      );
    };
    updateTime();
    // Só o HH:MM aparece: atualiza na virada do minuto em vez de re-renderizar todo segundo.
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        updateTime();
        schedule();
      }, 60_000 - (Date.now() % 60_000) + 50);
    };
    schedule();
    return () => clearTimeout(timer);
  }, []);

  // Detector de multimídia do PC via Windows GSMTC
  useEffect(() => {
    // Sem mídia no notch: não consulta o Windows (PowerShell a cada 1,5s) e limpa o estado.
    if (!config.showMedia) {
      applyMedia(EMPTY_MEDIA);
      return;
    }
    let active = true;
    // Uma consulta vazia isolada (PowerShell/GSMTC falha de vez em quando, ou a troca de faixa) não
    // pode apagar a música: só considera "sem mídia" depois de vários resultados vazios seguidos.
    let misses = 0;
    const MISSES_TO_CLEAR = 3;
    // A capa é pesada: pedida uma vez por faixa (com algumas novas tentativas, pois alguns players
    // publicam o título antes da imagem) e guardada aqui, não a cada consulta de 1,5 s.
    const THUMBNAIL_ATTEMPTS = 4;
    let thumbKey = "";
    let thumbUrl = "";
    let thumbAttempts = 0;
    let thumbPending = false;
    const ensureThumbnail = (key: string) => {
      if (key !== thumbKey) {
        thumbKey = key;
        thumbUrl = "";
        thumbAttempts = 0;
      }
      if (thumbUrl || thumbPending || thumbAttempts >= THUMBNAIL_ATTEMPTS) return;
      thumbPending = true;
      thumbAttempts += 1;
      void import("@tauri-apps/api/core")
        .then(({ invoke }) => invoke<string>("system_get_media_thumbnail"))
        .then((url) => {
          if (key === thumbKey && url) thumbUrl = url;
        })
        .catch(() => undefined)
        .finally(() => {
          thumbPending = false;
        });
    };
    const clearIfStillEmpty = () => {
      misses += 1;
      if (active && misses >= MISSES_TO_CLEAR) {
        timelineRef.current = null;
        applyMedia(EMPTY_MEDIA);
      }
    };

    const pollPcMedia = async () => {
      if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
        try {
          const { invoke } = await import("@tauri-apps/api/core");
          const info = await invoke<{
            hasMedia?: boolean;
            title?: string;
            artist?: string;
            isPlaying?: boolean;
            playbackType?: string;
            sourceApp?: string;
            thumbnail?: string;
            positionSeconds?: number;
            durationSeconds?: number;
            updatedAtMs?: number;
          }>("system_get_media_info");

          if (!active) return;

          if (info && info.hasMedia && info.title) {
            const t = info.title.toUpperCase();
            if (t.includes("PHERIELIUM") || t.includes("PHELIERIUM")) {
              applyMedia(EMPTY_MEDIA);
              return;
            }

            misses = 0;
            ensureThumbnail(`${info.title}\u0000${info.artist ?? ""}`);
            timelineRef.current = parseTimeline(info, Boolean(info.isPlaying), Date.now());
            applyMedia({
              hasMedia: true,
              type: info.playbackType === "video" ? "video" : "music",
              title: info.title,
              artist: info.artist || "Reproduzindo no PC",
              thumbnail: thumbUrl || info.thumbnail || "",
              isPlaying: Boolean(info.isPlaying),
              sourceApp: info.sourceApp,
            });
            return;
          }
        } catch {}
      }

      clearIfStillEmpty();
    };

    pollPcMedia();
    const interval = setInterval(pollPcMedia, 1500);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [applyMedia, config.showMedia]);

  // Detector de programas abertos / janelas sobrepostas ao Notch
  useEffect(() => {
    let checkInterval: NodeJS.Timeout;

    const checkWindowOverlap = async () => {
      if (isNotchAutoHideDisabled()) {
        setIsWindowOverlapping(false);
        return;
      }
      const isDomFullscreen = Boolean(document.fullscreenElement);
      let isOverlapping = isDomFullscreen;

      if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
        try {
          const { invoke } = await import("@tauri-apps/api/core");
          const res = await invoke<boolean>("system_is_fullscreen_active");
          if (res) isOverlapping = true;
        } catch {}
      }

      setIsWindowOverlapping(isOverlapping);
    };

    checkWindowOverlap();
    checkInterval = setInterval(checkWindowOverlap, 500);

    const onResize = () => checkWindowOverlap();
    document.addEventListener("fullscreenchange", onResize);
    window.addEventListener("resize", onResize);

    return () => {
      clearInterval(checkInterval);
      document.removeEventListener("fullscreenchange", onResize);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  // Sensor de cursor na borda superior da tela para revelar o Notch
  const revealNotch = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setIsRevealed(true);
  }, []);

  // Listener nativo do evento de cursor do overlay para detecção precisa no topo
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      void import("@tauri-apps/api/event").then(({ listen }) => {
        void listen<{ x: number; y: number }>("overlay:cursor", (event) => {
          const { x, y } = event.payload;
          const screenCenter = window.innerWidth / 2;
          if (y <= 16 && Math.abs(x - screenCenter) <= 160 && pointerRevealRef.current) {
            revealNotch();
          }
        }).then((fn) => {
          unlisten = fn;
        });
      });
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (e.clientY <= 14 && pointerRevealRef.current) {
        revealNotch();
      }
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => {
      unlisten?.();
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [revealNotch]);

  useEffect(
    () => () => {
      if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    },
    [],
  );

  // Controles de reprodução de multimídia do PC
  const mediaPlayingRef = useRef(false);
  mediaPlayingRef.current = mediaState.isPlaying;

  const handleTogglePlayPause = useCallback(async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const desired = !mediaPlayingRef.current;
    notchSoundRef.current(desired ? "mediaPlay" : "mediaPause");
    if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return;
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      // Comando explícito e idempotente na sessão certa. Antes era a tecla
      // global de toggle + inversão otimista do estado aqui: quando a tecla não
      // chegava ao app dono da mídia, a UI invertia sozinha e o clique seguinte
      // mandava o comando contrário — era por isso que não despausava.
      const accepted = await invoke<boolean>("system_media_set_playing", { playing: desired });
      if (accepted) {
        setMediaState((prev) => (prev.isPlaying === desired ? prev : { ...prev, isPlaying: desired }));
      } else {
        // Sessão recusou: não mexe no estado, o poll (1,5s) mostra a verdade.
        console.warn("[notch] sessão de mídia recusou play/pause");
      }
    } catch (err) {
      console.warn("[notch] falha ao controlar a mídia do sistema:", err);
    }
  }, []);

  const handleSkipPrev = useCallback(async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    notchSoundRef.current("mediaSkip");
    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("system_media_previous");
      } catch {}
    }
  }, []);

  const handleSkipNext = useCallback(async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    notchSoundRef.current("mediaSkip");
    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("system_media_next");
      } catch {}
    }
  }, []);

  // Ref do cursor para verificação de posição no callback do timer (sem stale closure)
  const cursorPosRef = useRef({ x: cursor.x, y: cursor.y });
  cursorPosRef.current = { x: cursor.x, y: cursor.y };

  // EXPANSÃO E RECOLHIMENTO SEQUENCIAL
  const handleMouseEnter = () => {
    if (!pointerRevealRef.current) return;
    if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    // Só espera a animação de descida se o notch estava de fato escondido.
    const wasHidden = autoHideActive && !isRevealed && !isHovered;

    setIsHovered(true);
    revealNotch();

    // Sem "expandir ao passar o mouse": só revela; o clique expande.
    if (!config.expandOnHover) return;

    if (wasHidden) {
      // Espera a animação de descer (translate-y) terminar antes de expandir
      collapseTimerRef.current = setTimeout(() => {
        setIsExpanded(true);
      }, 200);
    } else {
      setIsExpanded(true); // Expande IMEDIATAMENTE se já estiver visível
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);

    // Anti-flicker baseado em posição: quando o timer dispara, verifica se o cursor
    // ainda está dentro do bounding rect do notch (inclui margem de tolerância de 8px).
    // Isso é mais confiável que relatedTarget, que tem race conditions com motion.div.
    collapseTimerRef.current = setTimeout(() => {
      const notchRoot = document.querySelector<HTMLElement>("[data-notch-root]");
      if (notchRoot) {
        const rect = notchRoot.getBoundingClientRect();
        const { x: cx, y: cy } = cursorPosRef.current;
        const margin = 8;
        if (cx >= rect.left - margin && cx <= rect.right + margin &&
            cy >= rect.top - 4 && cy <= rect.bottom + margin) {
          // Cursor ainda dentro — cancela o colapso e restaura hover
          setIsHovered(true);
          return;
        }
      }
      setIsExpanded(false);
    }, 300);

    if (autoHideActive) {
      // Espera o encolhimento para só depois subir a notch
      hideTimerRef.current = setTimeout(() => {
        setIsRevealed(false);
      }, 380);
    }
  };

  const isPcMediaPlaying = mediaState.hasMedia && mediaState.isPlaying;

  // Humor dinâmico do mascote Pherie quando aparece (Coucou-style)
  // Áudio do PC: headbang no ritmo e equalizador real (medidor só liga com música tocando).

  // Tontura: chacoalhar o mouse perto do notch (métricas calculadas no Rust).
  const [dizzy, setDizzy] = useState(false);
  const dizzyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [overloaded, setOverloaded] = useState(false);
  const [tab, setTab] = useState<"home" | "controller" | "game">("home");
  const reduceMotion = useReducedMotion() ?? false;
  // Troca de aba: o conteúdo entra vindo do lado da aba nova (WAAPI: opacity + transform, fora da main thread).
  const paneRef = useRef<HTMLDivElement | null>(null);
  const previousTab = useRef(tab);
  useEffect(() => {
    const from = TAB_ORDER.indexOf(previousTab.current);
    previousTab.current = tab;
    const pane = paneRef.current;
    if (!pane || from === TAB_ORDER.indexOf(tab) || typeof pane.animate !== "function") return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const dx = TAB_ORDER.indexOf(tab) > from ? 14 : -14;
    pane.animate(
      [
        { opacity: 0, transform: reduce ? "none" : `translateX(${dx}px)` },
        { opacity: 1, transform: "none" },
      ],
      { duration: 220, easing: "cubic-bezier(0.23, 1, 0.32, 1)" },
    );
  }, [tab]);
  const controller = useControllerState();
  // Curiosidade: cursor chegou ao topo, na altura do notch.
  const [curious, setCurious] = useState(false);
  const curiousTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (cursor.t === 0) return;
    const rect = document.querySelector<HTMLElement>("[data-notch-root]")?.getBoundingClientRect() ?? null;
    const distance = distanceToRect(cursor.x, cursor.y, rect, window.innerWidth);
    if (isMouseShake({ speed: cursor.speed ?? 0, reversals: cursor.reversals ?? 0 }, distance)) {
      setDizzy(true);
      if (dizzyTimer.current) clearTimeout(dizzyTimer.current);
      dizzyTimer.current = setTimeout(() => setDizzy(false), DIZZY_DURATION_MS);
    }
    if (isCursorAtTop(cursor, rect, window.innerWidth)) {
      setCurious(true);
      if (curiousTimer.current) clearTimeout(curiousTimer.current);
      curiousTimer.current = setTimeout(() => setCurious(false), 1400);
    }
  }, [cursor]);
  useEffect(
    () => () => {
      if (dizzyTimer.current) clearTimeout(dizzyTimer.current);
      if (curiousTimer.current) clearTimeout(curiousTimer.current);
    },
    [],
  );

  // Controle conectou/desconectou: o notch encena o aviso em vez de um popup no hub.
  const controllerFlash = useControllerFlash(config.enabled);
  // Eventos do ecossistema (pedido de amizade, mensagem, conquista...): esperam o painel fechar.
  const notchEvent = useNotchEvent(config.enabled, isExpanded, {
    muted: config.mutedEvents,
    durationScale: config.eventDurationScale,
  });
  const isAchievement = notchEvent?.kind === "achievement";
  // avisa o dono quando um aviso entra em cena (uma vez por id), para sincronizar o som com a tela
  const shownEventId = useRef<string | null>(null);
  const onEventShownRef = useRef(onEventShown);
  onEventShownRef.current = onEventShown;
  useEffect(() => {
    if (!notchEvent || shownEventId.current === notchEvent.id) return;
    shownEventId.current = notchEvent.id;
    onEventShownRef.current?.(notchEvent);
  }, [notchEvent]);

  // Chamada recebendo (janela principal): o notch mostra quem liga com atender/recusar
  // Convite pendente (flag de convite como notificação): vira a mesma barra de atender/recusar, sem toque. `pendingInvite` só existe ocioso.
  const hubInvite =
    !overlayCall && voiceCall.callState === "ringing-in" ? voiceCall.incomingInvite : !overlayCall ? voiceCall.pendingInvite : null;
  const incomingInvite = overlayIncomingCall
    ? { callerName: overlayIncomingCall.name, callerAvatar: overlayIncomingCall.avatar ?? null }
    : hubInvite;

  const situation = useSituationMood({
    isCallActive,
    callDurationSeconds: callDuration,
    activeGameTitle,
    gameElapsedSeconds: activeGameElapsedSeconds,
    hasMedia: mediaState.hasMedia,
    isMediaPlaying: isPcMediaPlaying,
    isExpanded,
    isHovered,
    busy: isCallActive || Boolean(incomingInvite) || Boolean(activeGameTitle) || isPcMediaPlaying || Boolean(notchEvent) || Boolean(controllerFlash),
  });
  const reactMood = situation.react;

  // A Pherie mora no hub; na notch ela só acompanha o que pede companhia: a chamada (de fone, falando junto
  // com você, como sempre foi), os avisos ("Divirta-se", pedido de amizade, mensagem, conquista...) e o
  // controle que conecta ou desconecta, reagindo com o humor do aviso. Em música, jogo ou ociosa, a notch
  // fica só com a informação.
  const mascotInNotch =
    config.showMascot && (isCallActive || Boolean(incomingInvite) || Boolean(notchEvent) || Boolean(controllerFlash));

  // Enquanto a Pherie está aqui, o hub a esconde (ela "sobe" para a notch) e a devolve quando ela some.
  useEffect(() => {
    announcePherieInNotch(mascotInNotch);
    if (!mascotInNotch) return;
    const beat = window.setInterval(() => announcePherieInNotch(true), PRESENCE_HEARTBEAT_MS);
    return () => window.clearInterval(beat);
  }, [mascotInNotch]);
  useEffect(() => () => announcePherieInNotch(false), []);

  const mascotMood: MascotMood = useMemo(() => {
    if (dizzy) return "dizzy"; // chacoalharam o mouse
    if (incomingInvite) return "excited"; // alguém está ligando
    if (controllerFlash) return FLASH_MASCOT_MOOD[controllerFlash.kind];
    if (notchEvent) return NOTCH_EVENT_MOOD[notchEvent.kind];
    if (situation.transient) return situation.transient; // reação curta (cutucada, fim de jogo/chamada...)
    if (isCallActive) return isMuted ? "muted" : "calling";
    if (activeGameTitle) return "gaming";
    if (isPcMediaPlaying) return "music";
    if (curious && !baseMood) return "curious";
    if (baseMood) return baseMood;
    if (isHovered && !situation.ambient) return "attentive"; // o cursor está no notch
    return situation.ambient ?? "idle"; // parada: entedia, dá sono, dorme
  }, [incomingInvite, situation.transient, situation.ambient, isHovered, dizzy, controllerFlash, notchEvent, isCallActive, isMuted, activeGameTitle, isPcMediaPlaying, curious, baseMood]);

  // A "voz" da Pherie: um gorjeio por reação (susto, confusão, sono, alegria...). Humores
  // que vêm de chamada, aviso ou controle já têm som próprio, então ficam de fora; e a
  // cutucada (abaixo) toca o seu pip, sem dobrar com o "ah!" do susto.
  const moodHasOwnSound = Boolean(incomingInvite || notchEvent || controllerFlash);
  const prevVoiceMoodRef = useRef<MascotMood | null>(null);
  const voiceMuteUntilRef = useRef(0);
  useEffect(() => {
    const prev = prevVoiceMoodRef.current;
    prevVoiceMoodRef.current = mascotMood;
    if (!config.sounds || !mascotInNotch) return;
    if (moodHasOwnSound) return;
    if (performance.now() < voiceMuteUntilRef.current) return;
    const voice = voiceForMoodChange(prev, mascotMood);
    if (voice) playPherieVoice(voice, soundVolume);
  }, [mascotMood, config.sounds, mascotInNotch, moodHasOwnSound, soundVolume]);

  // Boca do mascote: no Tauri o volume do microfone chega por evento dedicado
  // (overlay:voice-level, ref sem re-render). Fora do Tauri (dev no navegador) cai
  // no flag booleano de "falando".
  const hasVoiceFeed = hasTauriRuntime();
  const mutedSpeechRef = useRef(false);
  const voiceLevelRef = useVoiceLevelRef(isCallActive && hasVoiceFeed, mutedSpeechRef);
  const mouthSpeaking =
    !hasVoiceFeed && !isMuted && (overlayCall ? Boolean(overlayCall.speaking) : voiceCall.isSpeakingLocal);

  // Frases do balão no painel ocioso (rotacionam enquanto o painel está aberto).
  const [bubbleIndex, setBubbleIndex] = useState(0);
  useEffect(() => {
    if (!isExpanded || !config.showBubbleTips) return;
    const id = window.setInterval(() => setBubbleIndex((i) => i + 1), 6000);
    return () => window.clearInterval(id);
  }, [isExpanded, config.showBubbleTips]);

  const liveKind = resolveLiveActivity({
    incomingCall: Boolean(incomingInvite),
    callActive: isCallActive,
    event: Boolean(notchEvent),
    controllerFlash: Boolean(controllerFlash),
    gameActive: Boolean(activeGameTitle),
    musicPlaying: isPcMediaPlaying,
  });
  // No hub o notch fica sempre à vista: ocioso, vira uma pílula pequena (só a Pherie) encaixada na
  // barra de título, sem relógio (o hub já tem um) — e cresce quando há música, aviso, chamada...
  const hubIdle = !isOverlay && liveKind === "idle" && !isExpanded;
  const compactWidth = hubIdle ? (controller.connected ? 112 : 84) : LIVE_WIDTH[liveKind];
  const barHeight = hubIdle ? 34 : NOTCH_BAR_HEIGHT;
  // chamada tocando: o notch aparece sozinho (mesmo escondido por outra janela)
  useEffect(() => {
    if (incomingInvite) revealNotch();
  }, [incomingInvite, revealNotch]);

  // Oculta o Notch no topo se houver janela sobreposta e o cursor não estiver na área
  // (inclusive em chamada — ver shouldAutoHide).
  const isHiddenByWindow = autoHideActive && !isRevealed && !isHovered;


  // Sons: abrir/fechar o painel e o notch "descendo" do auto-hide.
  const prevExpandedRef = useRef(false);
  useEffect(() => {
    if (prevExpandedRef.current === isExpanded) return;
    prevExpandedRef.current = isExpanded;
    notchSound(isExpanded ? "expand" : "collapse");
  }, [isExpanded, notchSound]);

  const prevHiddenRef = useRef(isHiddenByWindow);
  useEffect(() => {
    // se o mouse já está em cima o painel vai expandir em seguida: só o som de expandir
    if (prevHiddenRef.current && !isHiddenByWindow && !isHovered) notchSound("reveal");
    prevHiddenRef.current = isHiddenByWindow;
  }, [isHiddenByWindow, isHovered, notchSound]);

  // Outra janela ganhou o foco: o notch recolhe. `isRevealed` só voltava a falso no mouseleave, e
  // como o overlay é click-through esse evento quase nunca vinha (o notch ficava aberto para sempre).
  // Quando nada o segura (mouse, painel, aviso, convite), ele sobe sozinho depois de um instante.
  const holdsNotchOpen =
    isHovered || isExpanded || Boolean(notchEvent) || Boolean(controllerFlash) || Boolean(incomingInvite) || overlayActive;
  useEffect(() => {
    if (!autoHideActive || !isRevealed || holdsNotchOpen) return;
    const id = window.setTimeout(() => setIsRevealed(false), 900);
    return () => window.clearTimeout(id);
  }, [autoHideActive, isRevealed, holdsNotchOpen]);

  // Aviso de controle: o notch desce se estava escondido, toca o som e recolhe ao fim.
  const flashAt = controllerFlash?.at ?? null;
  const flashKind = controllerFlash?.kind ?? null;
  useEffect(() => {
    if (flashAt === null) return;
    revealNotch();
    notchSoundRef.current(flashKind === "disconnected" || flashKind === "hapticsOff" ? "collapse" : "expand");
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => setIsRevealed(false), 250);
    };
  }, [flashAt, flashKind, revealNotch]);

  // Evento do ecossistema: o notch desce se estava escondido, expande e recolhe ao fim.
  const eventId = notchEvent?.id ?? null;
  useEffect(() => {
    if (eventId === null) return;
    revealNotch();
    notchSoundRef.current("expand");
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => setIsRevealed(false), 250);
    };
  }, [eventId, revealNotch]);

  // Cutucar a Pherie: pop a cada clique, som próprio no 3º clique seguido (ela fica tonta).
  const pokeClicksRef = useRef<number[]>([]);
  const overloadedRef = useRef(false);
  const overloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (overloadTimer.current) clearTimeout(overloadTimer.current);
    },
    [],
  );
  const handleMascotPoke = useCallback(() => {
    if (overloadedRef.current) return; // ela está se recuperando
    const now = Date.now();
    const recent = [...pokeClicksRef.current.filter((t) => now - t < 800), now];
    pokeClicksRef.current = recent;
    if (recent.length >= 3) {
      pokeClicksRef.current = [];
      notchSound("mascotDizzy");
      // cliques demais: ela fica tonta por 3 s, com um aviso, e depois confusa
      overloadedRef.current = true;
      setOverloaded(true);
      setDizzy(true);
      revealNotch();
      setIsExpanded(true);
      if (overloadTimer.current) clearTimeout(overloadTimer.current);
      overloadTimer.current = setTimeout(() => {
        overloadedRef.current = false;
        setOverloaded(false);
        setDizzy(false);
        reactMood("confused");
      }, OVERLOAD_MS);
    } else {
      // pip que fica mais agudo a cada clique; o humor que ela reage não fala por cima
      voiceMuteUntilRef.current = performance.now() + 700;
      if (config.sounds && mascotInNotch) playPherieVoice("poke", soundVolume, 1 + 0.14 * (recent.length - 1));
      reactMood(recent.length === 1 ? "surprised" : "annoyed");
    }
  }, [notchSound, revealNotch, reactMood, config.sounds, mascotInNotch, soundVolume]);

  const openNotch = () => {
    if (!pointerRevealRef.current) return;
    revealNotch();
    setIsExpanded(true);
  };

  // cor da capa: tinge o cartão da música e o da letra (sem capa, mantém o rosa de antes)
  const coverRgb = useCoverColor(mediaState.hasMedia ? mediaState.thumbnail : "");
  const showLyricsWidget = config.widgets.includes("lyrics") && mediaState.hasMedia;
  // Busca a letra assim que a música muda, com a notch ainda fechada: ao abrir ela já está no cache
  // (antes só começava a buscar depois de abrir, e a letra demorava a aparecer).
  useNotchLyrics(mediaState.title, mediaState.artist, timelineRef.current?.durationSeconds ?? null, showLyricsWidget);
  const showCalendarWidget = config.widgets.includes("calendar");
  const showWeatherWidget = config.widgets.includes("weather");
  const hasWidgets = showLyricsWidget || showCalendarWidget || showWeatherWidget;
  const hasAnySection = isCallActive || Boolean(activeGameTitle) || mediaState.hasMedia || hasWidgets;
  const sourceLabel = prettySourceApp(mediaState.sourceApp);

  // Quem "hospeda" o mascote quando o painel abre (a barra cede o lugar): a chamada,
  // o slot da capa (música sem capa) ou o balão ocioso. Jogo sozinho não hospeda.
  const mascotHost: "call" | "game" | "media" | "idle" | null = !isExpanded || !mascotInNotch
    ? null
    : isCallActive
    ? "call"
    : activeGameTitle
    ? "game"
    : mediaState.hasMedia && !mediaState.thumbnail
    ? "media"
    : !hasAnySection
    ? "idle"
    : null;

  const greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
  })();
  const allBubbleLines = [
    `${greeting}! Pronto para sua próxima jogatina?`,
    "Clique em mim — eu reajo!",
    "Ctrl+Shift+O abre o painel do overlay.",
    "Eu sigo o seu cursor, sabia?",
  ];
  // Sem dicas: fica só a saudação
  const bubbleLines = config.showBubbleTips ? allBubbleLines : allBubbleLines.slice(0, 1);
  const bubbleText = bubbleLines[bubbleIndex % bubbleLines.length];

  const openOverlayPanel = useCallback(async () => {
    if (!hasTauriRuntime()) return;
    notchSoundRef.current("panelOpen");
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("overlay_toggle_panel");
    } catch {}
  }, []);

  // ── Barra superior (sempre visível; vira o "cabeçalho" quando expande) ──
  // Mascote sempre à esquerda (também ocioso): é o ponto de interação do notch.
  const barMascot = (size: number) => (
    <AnimatePresence>
      {mascotInNotch && (
    <motion.div
      key="bar-mascot"
      data-notch-mascot="true"
      className="shrink-0"
      style={{ width: size, height: size }}
      // ela surge na notch (vinda do hub) e some do mesmo jeito
      initial={{ scale: 0.4, y: -14, opacity: 0 }}
      animate={{ scale: 1, y: 0, opacity: mascotHost ? 0 : 1 }}
      exit={{ scale: 0.4, y: -14, opacity: 0, transition: appleSprings.snap }}
      transition={appleSprings.sheet}
    >
      <GazingMascot
        cursor={gazeCursor}
        size={size}
        mood={mascotMood}
        isHovered={isHovered}
        inCall={isCallActive}
        isMusicPlaying={isPcMediaPlaying}
        ringing={Boolean(incomingInvite)}
        levelRef={voiceLevelRef}
        muted={isCallActive && isMuted}
        waveAt={notchEvent && notchEventWaves(notchEvent.kind) ? notchEvent.at : undefined}
        celebrateAt={notchEvent?.kind === "achievement" ? notchEvent.at : undefined}
        mutedSpeechRef={mutedSpeechRef}
        isSpeaking={mouthSpeaking}
        onClick={handleMascotPoke}
      />
    </motion.div>
      )}
    </AnimatePresence>
  );

  // Mascote dentro do painel: "pula" para o lugar (slot da capa / chamada / balão).
  const panelMascot = (size: number, opts?: { mood?: MascotMood; headphones?: boolean }) => (
    <motion.div
      data-notch-panel-mascot="true"
      className="shrink-0"
      initial={{ scale: 0.4, rotate: -14, opacity: 0 }}
      animate={{ scale: 1, rotate: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 18, delay: 0.05 }}
    >
      <GazingMascot
        cursor={gazeCursor}
        size={size}
        mood={opts?.mood ?? mascotMood}
        forceHeadphones={opts?.headphones}
        isHovered={isHovered}
        inCall={opts?.mood ? false : isCallActive}
        // com humor forçado (aba Controle) ela não dança com a música: só segura o controle
        isMusicPlaying={opts?.mood ? false : isPcMediaPlaying}
        ringing={Boolean(incomingInvite)}
        levelRef={voiceLevelRef}
        muted={isCallActive && isMuted}
        waveAt={notchEvent && notchEventWaves(notchEvent.kind) ? notchEvent.at : undefined}
        celebrateAt={notchEvent?.kind === "achievement" ? notchEvent.at : undefined}
        mutedSpeechRef={mutedSpeechRef}
        isSpeaking={mouthSpeaking}
        onClick={handleMascotPoke}
      />
    </motion.div>
  );

  const renderBar = () => {
    // compacto: a barra de atender/recusar; expandido: o cartão no painel (o cabeçalho com as abas fica)
    if (incomingInvite && !isExpanded) {
      return (
        <CallIncomingBar
          name={incomingInvite.callerName || "Alguém"}
          mascot={barMascot(30)}
          avatar={<CallAvatar src={incomingInvite.callerAvatar || undefined} name={incomingInvite.callerName} size={30} />}
          onAccept={() => (overlayIncomingCall ? overlayIncomingCall.onAccept() : void voiceCall.answerCall())}
          onReject={() => (overlayIncomingCall ? overlayIncomingCall.onReject() : void voiceCall.rejectCall())}
        />
      );
    }
    if (controllerFlash) {
      return <ControllerFlashBar flash={controllerFlash} mascot={barMascot(BAR_MASCOT)} />;
    }
    if (notchEvent?.kind === "achievement") {
      // a revelação acontece no painel aberto; a barra só diz o que é
      const ts = tierStyle(notchEvent.tier);
      return (
        <div className="flex w-full items-center justify-center gap-2">
          <Trophy size={13} style={{ color: `rgb(${ts.rgb})` }} />
          <span className="text-[12px] font-semibold text-white">Conquista desbloqueada</span>
        </div>
      );
    }
    if (notchEvent) {
      return <NotchEventBar event={notchEvent} mascot={barMascot(BAR_MASCOT)} />;
    }
    // Expandido (inclusive em chamada): sempre as abas, senão a página do controle fica inacessível.
    if (isExpanded) {
      // cabeçalho estilo Coucou: abas só com ícone à esquerda, atalhos à direita
      const tabBtn = (id: "home" | "controller" | "game", label: string, icon: React.ReactNode) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={tab === id}
          aria-label={label}
          title={label}
          onClick={(e) => {
            e.stopPropagation();
            setTab(id);
          }}
          className={`relative z-10 flex h-9 w-11 items-center justify-center rounded-full transition-colors duration-150 ${
            tab === id ? "text-white" : "text-white/55 hover:bg-white/[0.06] hover:text-white"
          }`}
        >
          {icon}
        </button>
      );
      return (
        <div className="flex w-full items-center justify-between">
          <div className="relative flex items-center gap-1" role="tablist">
            {/* pílula ativa: desliza entre as abas só com transform (sem medir layout) */}
            <span
              aria-hidden
              className="notch-tab-pill pointer-events-none absolute left-0 top-0 h-9 w-11 rounded-full bg-white/[0.10]"
              style={{ transform: `translateX(${Math.max(0, TAB_ORDER.indexOf(tab)) * TAB_STEP_PX}px)` }}
            />
            {tabBtn("home", "Início", <Home size={17} />)}
            {tabBtn("controller", "Controle", <Gamepad2 size={17} />)}
            {gameTab && activeGameTitle && tabBtn("game", "Jogo", <Trophy size={17} />)}
          </div>
          <div className="flex items-center gap-1 text-white/60">
            {controller.connected && controller.battery != null && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setTab("controller");
                }}
                title="Controle conectado"
                aria-label={`Controle conectado, bateria ${controller.battery}%`}
                className="mr-1 flex h-7 items-center gap-1 rounded-full bg-white/[0.07] px-2 text-[11px] font-semibold tabular-nums text-[#30d158] transition-colors hover:bg-white/[0.12]"
              >
                <Gamepad2 size={13} />
                {controller.battery}%
              </button>
            )}
            {config.showClock && (
              <span className="mr-1 text-[12px] font-semibold tabular-nums text-white/70">{currentTime}</span>
            )}
            {isOverlay && hasTauriRuntime() && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void openOverlayPanel();
                }}
                title="Painel do overlay"
                aria-label="Painel do overlay"
                className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-white/[0.10] hover:text-white"
              >
                <Settings2 size={16} />
              </button>
            )}
          </div>
        </div>
      );
    }
    if (isCallActive) {
      return (
        <>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {barMascot(BAR_MASCOT)}
            <CallAvatar src={callFriendAvatar} name={callFriendName} size={22} speaking={isSpeaking && !isMuted} />
            <span className="text-[12px] font-semibold text-white/90 truncate">{callFriendName || "Voz"}</span>
          </div>
          {isMuted ? (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-[#f4505e]/20 px-2 py-1 text-[10.5px] font-semibold text-[#ff7a85]">
              <MicOff size={12} />
              Silencioso
            </span>
          ) : (
            <VoiceBars levelRef={voiceLevelRef} speaking={isSpeaking} />
          )}
          <span className="shrink-0 pl-2.5 text-[12px] font-semibold font-mono tabular-nums text-white">
            {formatSeconds(callDuration)}
          </span>
        </>
      );
    }
    if (activeGameTitle) {
      return (
        <>
          <div className="flex-1 flex items-center gap-2">{barMascot(BAR_MASCOT)}</div>
          <span className="text-[13px] font-semibold tracking-tight text-white tabular-nums">{config.showClock ? currentTime : ""}</span>
          <div className="flex-1 flex items-center justify-end gap-1.5 text-white/55">
            <Gamepad2 size={12} />
            <span className="text-[10px] font-mono tabular-nums">{formatSeconds(activeGameElapsedSeconds)}</span>
          </div>
        </>
      );
    }
    if (hubIdle) {
      return (
        <div className="flex w-full items-center justify-center gap-2">
          {barMascot(26)}
          {controller.connected && (
            <span className="flex items-center gap-1 text-white/70" title="Controle conectado" aria-label="Controle conectado">
              <Gamepad2 size={14} />
              {controller.battery != null && <span className="text-[10px] font-semibold tabular-nums text-white/50">{controller.battery}</span>}
            </span>
          )}
        </div>
      );
    }
    return (
      <>
        <div className="flex-1 flex items-center">
          {mediaState.hasMedia && mediaState.thumbnail ? (
            <img
              src={mediaState.thumbnail}
              alt=""
              draggable={false}
              className="h-[26px] w-[26px] rounded-full object-cover shadow-[0_0_0_1.5px_rgba(255,255,255,0.18)]"
            />
          ) : (
            barMascot(BAR_MASCOT)
          )}
        </div>
        <span className="text-[13px] font-semibold tracking-tight text-white tabular-nums">{config.showClock ? currentTime : ""}</span>
        <div className="flex-1 flex items-center justify-end gap-2">
          {controller.connected && !isExpanded && (
            <span
              className="flex shrink-0 items-center gap-1 text-white/80"
              title={controller.battery != null ? `Controle conectado · ${controller.battery}%` : "Controle conectado"}
              aria-label="Controle conectado"
            >
              <Gamepad2 size={15} />
              {controller.battery != null && (
                <span className="text-[10px] font-semibold tabular-nums text-white/55">{controller.battery}</span>
              )}
            </span>
          )}
          {isPcMediaPlaying && !isExpanded && <Equalizer playing height={14} />}
        </div>
      </>
    );
  };

  const notchBg = surfaceColor(notchStyle);
  const chamferCut = Math.max(6, Math.round(notchStyle.cornerRadius * 1.2));
  // borda neon + cantos chanfrados: o recorte não aceita box-shadow, então a borda é uma
  // camada de fundo recortada e o conteúdo fica num bloco recortado 1px para dentro.
  const chamferBorder = notchStyle.chamfer && Boolean(notchStyle.borderColor);
  const frosted = notchStyle.surfaceOpacity < 1;

  return (
    <>
      {/* Sensor invisível no topo central da tela para detecção imediata de aproximação */}
      <div
        data-overlay-interactive="true"
        className="fixed top-0 left-1/2 -translate-x-1/2 w-[280px] h-[14px] z-[10029] pointer-events-auto bg-transparent cursor-pointer"
        onMouseEnter={handleMouseEnter}
        onClick={openNotch}
      />

      {/* Surgir = mola com overshoot; sumir = mola amortecida (sem quicar no topo). O `x` centraliza
          sem usar `translate` do CSS, que a mola de `y` sobrescreveria. */}
      <motion.aside
        aria-label="Desktop Notch"
        data-overlay-interactive="true"
        data-notch-root="true"
        data-notch-expanded={isExpanded ? "true" : "false"}
        data-notch-theme={appearance.visualTheme}
        initial={false}
        animate={{ y: isHiddenByWindow ? NOTCH_HIDDEN_Y : 0 }}
        transition={notchPositionTransition(isHiddenByWindow, reduceMotion)}
        style={{
          x: "-50%",
          ...(notchStyle.chamfer && notchStyle.glow > 0
            ? { filter: `drop-shadow(0 0 ${Math.round(5 + notchStyle.glow * 12)}px ${notchStyle.glowColor})` }
            : {}),
        }}
        className={`fixed top-0 left-1/2 z-[10030] pointer-events-auto select-none ${className}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Largura e raio animam por mola; a altura cresce com o painel (sem salto). */}
        <motion.div
          initial={false}
          animate={{
            width: isExpanded || isAchievement ? NOTCH_EXPANDED_WIDTH : compactWidth,
            borderBottomLeftRadius: notchStyle.chamfer ? 0 : notchStyle.cornerRadius + (isExpanded || isAchievement ? EXPANDED_RADIUS_BONUS : 0),
            borderBottomRightRadius: notchStyle.chamfer ? 0 : notchStyle.cornerRadius + (isExpanded || isAchievement ? EXPANDED_RADIUS_BONUS : 0),
            // conquista: aro estático na cor do tier; senão o estilo normal do notch
            boxShadow: isAchievement ? achievementBoxShadow(notchEvent?.tier) : notchBoxShadow(notchStyle, isExpanded),
          }}
          transition={geometryTransition(isExpanded || isAchievement, reduceMotion)}
          style={{
            backgroundColor: chamferBorder ? (notchStyle.borderColor as string) : notchBg,
            clipPath: notchStyle.chamfer ? chamferClipPath(chamferCut) : undefined,
            backdropFilter: frosted ? "blur(18px)" : undefined,
            WebkitBackdropFilter: frosted ? "blur(18px)" : undefined,
          }}
          className="relative text-white [corner-shape:var(--squircle)]"
        >
          <div
            style={
              chamferBorder
                ? { margin: 1, clipPath: chamferClipPath(Math.max(0, chamferCut - 1)), backgroundColor: notchBg }
                : undefined
            }
          >
          {/* Cantos côncavos: a ilha "nasce" da borda da tela (sem traço, sem emenda) */}
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            aria-hidden
            className="absolute top-0 -left-[13.5px] pointer-events-none"
            style={{ fill: notchBg, display: notchStyle.chamfer ? "none" : undefined }}
          >
            <path d="M 0 0 C 7.73 0 14 6.27 14 14 L 14 0 Z" />
          </svg>
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            aria-hidden
            className="absolute top-0 -right-[13.5px] pointer-events-none"
            style={{ fill: notchBg, display: notchStyle.chamfer ? "none" : undefined }}
          >
            <path d="M 14 0 C 6.27 0 0 6.27 0 14 L 0 0 Z" />
          </svg>
          {/* Faixa acima da ilha (e das asas): no overshoot do surgimento a ilha passa um pouco do topo
              e esta faixa, que anda junto, cobre a fresta entre ela e a borda da tela. */}
          {!notchStyle.chamfer && (
            <>
              <span aria-hidden className="pointer-events-none absolute -top-3 inset-x-0 h-3" style={{ backgroundColor: notchBg }} />
              <span aria-hidden className="pointer-events-none absolute -top-3 -left-[13.5px] h-3 w-[14px]" style={{ backgroundColor: notchBg }} />
              <span aria-hidden className="pointer-events-none absolute -top-3 -right-[13.5px] h-3 w-[14px]" style={{ backgroundColor: notchBg }} />
            </>
          )}

          {/* Barra */}
          <div
            className="flex items-center px-3 cursor-pointer"
            style={{ height: barHeight }}
            onClick={isCallActive && !isExpanded ? handleOpenCall : openNotch}
          >
            {renderBar()}
          </div>

          {/* Painel */}
          <AnimatePresence initial={false}>
            {isAchievement && !isExpanded && notchEvent && (
              <motion.div
                key={`achievement-${notchEvent.id}`}
                initial={{ height: 0, opacity: 0, y: reduceMotion ? 0 : -6 }}
                animate={{ height: "auto", opacity: 1, y: 0 }}
                exit={{ height: 0, opacity: 0, transition: { height: CLOSE_TRANSITION, opacity: { duration: VIEW_OUT_S } } }}
                transition={{
                  height: geometryTransition(true, reduceMotion),
                  opacity: { duration: VIEW_IN_S, delay: 0.05 },
                  y: { ...NOTCH_EXPAND_SPRING, delay: 0.05 },
                }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-4 pt-1">
                  <AchievementReveal event={notchEvent} mascot={config.showMascot ? panelMascot(56) : undefined} />
                </div>
              </motion.div>
            )}
            {isExpanded && (
              <motion.div
                key="panel"
                initial={{ height: 0, opacity: 0, y: reduceMotion ? 0 : -6 }}
                animate={{ height: "auto", opacity: 1, y: 0 }}
                exit={{ height: 0, opacity: 0, transition: { height: CLOSE_TRANSITION, opacity: { duration: VIEW_OUT_S } } }}
                transition={{
                  height: geometryTransition(true, reduceMotion),
                  // o conteúdo espera ~50 ms para não competir com a mola da casca
                  opacity: { duration: VIEW_IN_S, delay: 0.05 },
                  y: { ...NOTCH_EXPAND_SPRING, delay: 0.05 },
                }}
                className="overflow-hidden"
              >
                <div ref={paneRef} className="notch-stagger px-4 pb-4 pt-1 flex flex-col gap-3.5">
                  {overloaded && (
                    <NotchCard>
                      <div className="flex items-center gap-4">
                        {mascotInNotch && panelMascot(64)}
                        <div className="min-w-0">
                          <p className="text-[14px] font-semibold text-white">Muitos cliques de uma vez.</p>
                          <p className="mt-0.5 text-[12px] leading-snug text-white/55">
                            Me dá um segundo — volto ao trabalho em três segundos.
                          </p>
                        </div>
                      </div>
                    </NotchCard>
                  )}
                  {incomingInvite && !overloaded && (
                    <NotchCard tone="green">
                      <SectionLabel>Chamada recebida</SectionLabel>
                      <div className="flex items-center gap-3">
                        {mascotInNotch && panelMascot(64, { mood: "excited" })}
                        <div className="flex min-w-0 flex-1 items-center gap-2.5">
                          <CallAvatar src={incomingInvite.callerAvatar || undefined} name={incomingInvite.callerName} size={34} />
                          <div className="min-w-0 leading-tight">
                            <p className="truncate text-[15px] font-semibold text-white">{incomingInvite.callerName || "Alguém"}</p>
                            <p className="text-[12px] text-white/50">está te ligando</p>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-start gap-4">
                          <button
                            type="button"
                            onClick={() => (overlayIncomingCall ? overlayIncomingCall.onReject() : void voiceCall.rejectCall())}
                            aria-label="Recusar"
                            className={`flex h-11 w-11 items-center justify-center rounded-full bg-[#ff453a] text-white ${NOTCH_PRESS} hover:brightness-110 active:scale-90`}
                          >
                            <PhoneOff size={19} />
                          </button>
                          <button
                            type="button"
                            onClick={() => (overlayIncomingCall ? overlayIncomingCall.onAccept() : void voiceCall.answerCall())}
                            aria-label="Atender"
                            className={`flex h-11 w-11 items-center justify-center rounded-full bg-[#30d158] text-white ${NOTCH_PRESS} hover:brightness-110 active:scale-90`}
                          >
                            <Phone size={19} />
                          </button>
                        </div>
                      </div>
                    </NotchCard>
                  )}
                  {tab === "game" && gameTab && !incomingInvite && !overloaded && (
                    <GameTab data={gameTab} elapsedSeconds={activeGameElapsedSeconds} />
                  )}
                  {tab === "controller" && !incomingInvite && !overloaded && (
                    <ControllerTab
                      state={controller}
                      mascot={panelMascot(96, { mood: controller.connected ? "gaming" : "sad", headphones: true })}
                    />
                  )}
                  <div className={overloaded || tab === "controller" || (tab === "game" && Boolean(gameTab)) || Boolean(incomingInvite) ? "hidden" : "contents"}>
                  {/* ── Chamada de voz ── */}
                  {isCallActive && (
                    <NotchCard tone="green">
                      <SectionLabel>Chamada de voz</SectionLabel>
                      <div className="flex items-center gap-3">
                        {mascotInNotch && panelMascot(64)}
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-white leading-tight min-w-0">
                            <CallAvatar src={callFriendAvatar} name={callFriendName} size={18} speaking={isSpeaking && !isMuted} />
                            <span className="truncate">{callFriendName || "Sala de Voz"}</span>
                          </p>
                          <p className="mt-1 pl-[26px] text-[11px] text-white/50 leading-snug tabular-nums">
                            {formatSeconds(callDuration)} • {isSpeaking && !isMuted ? "Falando" : "Conectado"}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <NotchIconButton
                            onClick={handleToggleMute}
                            active={isMuted}
                            title={isMuted ? "Desmutar microfone" : "Mutar microfone"}
                          >
                            {isMuted ? <MicOff size={15} /> : <Mic size={15} />}
                          </NotchIconButton>
                          <NotchIconButton
                            onClick={handleToggleDeafen}
                            active={isDeafened}
                            tone="warn"
                            title={isDeafened ? "Reativar áudio" : "Silenciar áudio"}
                          >
                            {isDeafened ? <VolumeX size={15} /> : <Volume2 size={15} />}
                          </NotchIconButton>
                          <NotchIconButton onClick={handleOpenCall} title="Abrir chamada">
                            <Maximize2 size={15} />
                          </NotchIconButton>
                          <NotchIconButton onClick={handleHangUp} tone="danger" title="Desconectar">
                            <PhoneOff size={15} />
                          </NotchIconButton>
                        </div>
                      </div>
                    </NotchCard>
                  )}

                  {/* ── Jogo ── */}
                  {activeGameTitle && (
                    <NotchCard tone="indigo">
                      <SectionLabel>Jogando agora</SectionLabel>
                      <div className="flex items-center gap-3">
                        {mascotHost === "game" ? (
                          panelMascot(56)
                        ) : (
                          <span className="w-10 h-10 rounded-xl bg-white/[0.07] flex items-center justify-center text-white/80 shrink-0">
                            <Gamepad2 size={18} />
                          </span>
                        )}
                        <p className="min-w-0 flex-1 text-[13px] font-semibold text-white truncate">{activeGameTitle}</p>
                        <span className="text-[12px] font-mono tabular-nums text-white/60 shrink-0">
                          {formatSeconds(activeGameElapsedSeconds)}
                        </span>
                      </div>
                    </NotchCard>
                  )}

                  {/* ── Multimídia do PC ── */}
                  {mediaState.hasMedia && (
                    <div className={showLyricsWidget ? "grid grid-cols-2 items-stretch gap-3.5" : ""}>
                    <NotchCard tone="pink" rgb={coverRgb}>
                      <SectionLabel>{sourceLabel ? `Tocando · ${sourceLabel}` : "Tocando no PC"}</SectionLabel>
                      <div className="flex items-center gap-3">
                        <div
                          className={`relative w-[76px] h-[76px] shrink-0 flex items-center justify-center text-white/60 ${
                            mascotHost === "media" && !mediaState.thumbnail
                              ? "" // a Pherie ocupa o lugar da capa SEM caixa em volta
                              : "rounded-2xl bg-gradient-to-br from-white/[0.14] to-white/[0.04] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
                          }`}
                        >
                          {mediaState.thumbnail ? (
                            <>
                              <img
                                src={mediaState.thumbnail}
                                alt=""
                                className="w-full h-full rounded-2xl object-cover"
                                draggable={false}
                              />
                              <div className={`absolute -bottom-2 -right-2 rounded-full bg-black p-0.5 ${mascotInNotch && mascotHost !== "game" ? "" : "hidden"}`}>
                                <GazingMascot
                                  cursor={gazeCursor}
                                  size={36}
                                  mood={mascotMood}
                                  isHovered={isHovered}
                                  isMusicPlaying={isPcMediaPlaying}
                                />
                              </div>
                            </>
                          ) : mascotHost === "media" ? (
                            // sem capa: a Pherie ocupa o lugar dela, de fone, no ritmo da música
                            panelMascot(76)
                          ) : (
                            <Equalizer playing={isPcMediaPlaying} height={26} />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[14px] font-semibold text-white truncate leading-tight">{mediaState.title}</p>
                          <p className="text-[11px] text-white/55 truncate leading-snug">{mediaState.artist}</p>
                        </div>
                        <Equalizer playing={isPcMediaPlaying} height={18} />
                      </div>
                      <div className="mt-3">
                        <MediaProgress timelineRef={timelineRef} rgb={coverRgb ?? undefined} />
                      </div>
                      <div className="mt-3 flex items-center justify-center gap-7">
                        <button
                          type="button"
                          onClick={handleSkipPrev}
                          className={`text-white/75 hover:text-white ${NOTCH_PRESS} active:scale-90`}
                          title="Faixa anterior"
                          aria-label="Faixa anterior"
                        >
                          <SkipBack size={18} className="fill-current" />
                        </button>
                        <button
                          type="button"
                          onClick={handleTogglePlayPause}
                          className={`w-11 h-11 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 ${NOTCH_PRESS} active:scale-90`}
                          title={mediaState.isPlaying ? "Pausar" : "Reproduzir"}
                          aria-label={mediaState.isPlaying ? "Pausar" : "Reproduzir"}
                        >
                          {mediaState.isPlaying ? (
                            <Pause size={18} className="fill-current" />
                          ) : (
                            <Play size={18} className="fill-current ml-0.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={handleSkipNext}
                          className={`text-white/75 hover:text-white ${NOTCH_PRESS} active:scale-90`}
                          title="Próxima faixa"
                          aria-label="Próxima faixa"
                        >
                          <SkipForward size={18} className="fill-current" />
                        </button>
                      </div>
                      <div className="-mx-3 -mb-3 mt-2" style={{ maskImage: "linear-gradient(180deg, transparent 0%, #000 55%)", WebkitMaskImage: "linear-gradient(180deg, transparent 0%, #000 55%)" }}>
                        <MusicWaveform playing={isPcMediaPlaying} />
                      </div>
                    </NotchCard>
                    {showLyricsWidget && (
                      <LyricsWidget
                        title={mediaState.title}
                        artist={mediaState.artist}
                        timelineRef={timelineRef}
                        enabled={isExpanded}
                        cover={mediaState.thumbnail}
                        rgb={coverRgb}
                      />
                    )}
                    </div>
                  )}

                  {/* ── Widgets: calendário e clima ── */}
                  {(showCalendarWidget || showWeatherWidget) && (
                    <div className={`grid items-stretch gap-3.5 ${showCalendarWidget && showWeatherWidget ? "grid-cols-2" : "grid-cols-1"}`}>
                      {showCalendarWidget && <CalendarWidget />}
                      {showWeatherWidget && <WeatherWidget city={config.weatherCity} enabled={isExpanded} />}
                    </div>
                  )}

                  {/* ── Nada acontecendo ── */}
                  {!hasAnySection && (
                    <section
                      className="flex flex-col items-center gap-3 rounded-[24px] bg-[#171717] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] px-5 pb-4 pt-5"
                      style={{ backgroundImage: "radial-gradient(70% 90% at 50% 38%, rgba(255,255,255,0.075) 0%, transparent 70%)" }}
                    >
                      {mascotInNotch && panelMascot(92)}
                      {(() => {
                        const tip = (
                          <AnimatePresence mode="wait" initial={false}>
                            <motion.p
                              key={bubbleIndex % bubbleLines.length}
                              initial={{ opacity: 0, y: 4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -4 }}
                              transition={{ duration: 0.18 }}
                              className="text-center text-[12px] leading-snug text-white/75"
                            >
                              {bubbleText}
                            </motion.p>
                          </AnimatePresence>
                        );
                        return config.bubbleStyle === "retro" ? <RetroBubble accent={notchStyle.accent}>{tip}</RetroBubble> : tip;
                      })()}
                    </section>
                  )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          </div>
        </motion.div>
      </motion.aside>
    </>
  );
};

/** Notch respeitando "Ativar o notch" das configurações (usado fora do overlay, ex.: dev no navegador). */
export const ConfiguredDesktopNotch: React.FC = () => {
  const config = useNotchConfig();
  const { soundTheme } = usePreferences();
  return config.enabled ? <DesktopNotch config={config} soundTheme={soundTheme} /> : null;
};
