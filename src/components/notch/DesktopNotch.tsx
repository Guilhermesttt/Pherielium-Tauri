import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  Camera,
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
import { CLOSE_TRANSITION, OPEN_SPRING, VIEW_IN_S, VIEW_OUT_S, geometryTransition } from "../../mascot/motion";
import { playNotchSound, type NotchSoundId } from "./notchSounds";
import { useNotchDropzone } from "./useNotchDropzone";
import { RetroBubble } from "./RetroBubble";
import { ControllerFlashBar, FLASH_MASCOT_MOOD, useControllerFlash } from "./ControllerFlashBar";
import { CONTROLLER_FLASH_WIDTH } from "./controllerFlash";
import { NotchEventBar, useNotchEvent } from "./NotchEventBar";
import { NOTCH_EVENT_MOOD, NOTCH_EVENT_WIDTH, notchEventWaves } from "./notchEvent";
import { AchievementReveal } from "./AchievementReveal";
import { achievementBoxShadow, tierStyle } from "./achievementTier";
import { subscribeTicker } from "../../mascot/ticker";
import { useSituationMood } from "../../mascot/useSituationMood";
import { MusicWaveform } from "./MusicWaveform";
import { MediaProgress } from "./live/MediaProgress";
import { CallIncomingBar } from "./live/CallIncomingBar";
import { VoiceBars } from "./live/VoiceBars";
import { LIVE_WIDTH, resolveLiveActivity } from "./live/liveActivity";
import { ControllerTab } from "./live/ControllerTab";
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
  /** Overlay: pede ao hub para abrir a janela da chamada. */
  onOverlayOpenCall?: () => void;
  /** Overlay: chamada recebida (vinda do hub) com as ações de atender/recusar. */
  overlayIncomingCall?: { name: string; avatar?: string | null; onAccept: () => void; onReject: () => void } | null;
  /** Configuração do notch (o overlay passa a sua; sem ela o notch lê a gravada). */
  config?: NotchConfig;
  /** Volume dos efeitos do launcher (0..1) para os sons do notch. */
  soundVolume?: number;
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
const NOTCH_EXPANDED_WIDTH = 448;
const NOTCH_BAR_HEIGHT = 52;
/** Tamanho da Pherie na barra compacta (antes 26: pequena demais para ver o rosto). */
const BAR_MASCOT = 38;
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
 * primeiro plano. Com chamada ativa ou jogo em andamento ele fica SEMPRE
 * visível — é o único ponto de controle do overlay em jogo.
 */
export function shouldAutoHide(params: {
  isWindowOverlapping: boolean;
  isCallActive: boolean;
  isGameRunning: boolean;
  disabled: boolean;
}): boolean {
  if (params.disabled) return false;
  // Chamada de voz ativa: mantém sempre visível (único controle de mute/hang-up).
  // Jogo em andamento não é mais exceção — o notch segue o auto-hide normal;
  // o cursor no topo da tela sempre o revela.
  if (params.isCallActive) return false;
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
      className={`h-9 ${wide ? "px-4" : "w-9"} shrink-0 rounded-full flex items-center justify-center gap-1.5 text-[11px] font-semibold transition-all duration-150 active:scale-[0.94] ${toneClass}`}
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

/** Cartão do painel: raio 20, hairline e um brilho radial na cor de status (de baixo para cima). */
export const NotchCard: React.FC<{
  tone?: keyof typeof CARD_WASH;
  children: React.ReactNode;
}> = ({ tone = "neutral", children }) => (
  <section
    className="overflow-hidden rounded-[20px] border border-white/[0.035] bg-[#141518] p-3"
    style={{
      backgroundImage: `radial-gradient(120% 140% at 50% 130%, rgba(${CARD_WASH[tone]}, ${tone === "neutral" ? 0.08 : 0.38}) 0%, transparent 62%)`,
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
  onOverlayMute,
  onOverlayDeafen,
  onOverlayHangUp,
  onOverlayOpenCall,
  config: configProp,
  soundVolume,
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
  const mascotBodyColor = config.bodyColor;
  const mascotShape = config.shape;

  // Sons de interação do notch (cada ação tem o seu; mutar/desligar tocam no hook de voz).
  const notchSound = useCallback(
    (id: NotchSoundId) => {
      if (config.sounds) playNotchSound(id, soundVolume);
    },
    [config.sounds, soundVolume],
  );
  const notchSoundRef = useRef(notchSound);
  notchSoundRef.current = notchSound;

  // Estados de visualização do Notch
  const [isExpanded, setIsExpanded] = useState(false);
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

  const autoHideActive = shouldAutoHide({
    isWindowOverlapping,
    isCallActive,
    isGameRunning: Boolean(activeGameTitle),
    disabled: autoHideDisabled || !config.autoHide,
  });

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
            timelineRef.current = parseTimeline(info, Boolean(info.isPlaying), Date.now());
            applyMedia({
              hasMedia: true,
              type: info.playbackType === "video" ? "video" : "music",
              title: info.title,
              artist: info.artist || "Reproduzindo no PC",
              thumbnail: info.thumbnail ?? "",
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
          if (y <= 16 && Math.abs(x - screenCenter) <= 160) {
            revealNotch();
          }
        }).then((fn) => {
          unlisten = fn;
        });
      });
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (e.clientY <= 14) {
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
    notchSoundRef.current(mediaPlayingRef.current ? "mediaPause" : "mediaPlay");
    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("system_media_play_pause");
        setMediaState((prev) => ({ ...prev, isPlaying: !prev.isPlaying }));
      } catch {}
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
  const [tab, setTab] = useState<"home" | "controller">("home");
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

  // Dropzone: arrastar imagens até o notch as salva nas capturas.
  const [digested, setDigested] = useState(false);
  const digestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropzone = useNotchDropzone({
    enabled: config.enabled,
    cursor: { x: cursor.x, y: cursor.y, dragging: Boolean(cursor.dragging), t: cursor.t },
    gameTitle: activeGameTitle,
    onImported: () => {
      setDigested(true);
      if (digestTimer.current) clearTimeout(digestTimer.current);
      digestTimer.current = setTimeout(() => setDigested(false), 1800);
    },
  });
  useEffect(
    () => () => {
      if (digestTimer.current) clearTimeout(digestTimer.current);
    },
    [],
  );
  // o painel "Solte aqui" abre sozinho e fecha quando a dropzone termina
  const dropForcedOpen = useRef(false);
  useEffect(() => {
    if (dropzone.active) {
      if (!isExpanded) {
        dropForcedOpen.current = true;
        setIsExpanded(true);
      }
    } else if (dropForcedOpen.current) {
      dropForcedOpen.current = false;
      setIsExpanded(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dropzone.active]);

  // Controle conectou/desconectou: o notch encena o aviso em vez de um popup no hub.
  const controllerFlash = useControllerFlash(config.enabled);
  // Eventos do ecossistema (pedido de amizade, mensagem, conquista...): esperam o painel fechar.
  const notchEvent = useNotchEvent(config.enabled, isExpanded);
  const isAchievement = notchEvent?.kind === "achievement";

  // Chamada recebendo (janela principal): o notch mostra quem liga com atender/recusar
  const hubInvite = !overlayCall && voiceCall.callState === "ringing-in" ? voiceCall.incomingInvite : null;
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

  const mascotMood: MascotMood = useMemo(() => {
    if (dizzy) return "dizzy"; // chacoalharam o mouse
    if (incomingInvite) return "excited"; // alguém está ligando
    if (controllerFlash) return FLASH_MASCOT_MOOD[controllerFlash.kind];
    if (notchEvent) return NOTCH_EVENT_MOOD[notchEvent.kind];
    if (dropzone.armed || dropzone.over || dropzone.importing) return "surprised"; // boca aberta
    if (digested) return "happy"; // "digeriu" o arquivo
    if (situation.transient) return situation.transient; // reação curta (cutucada, fim de jogo/chamada...)
    if (isCallActive) return isMuted ? "muted" : "calling";
    if (activeGameTitle) return "gaming";
    if (isPcMediaPlaying) return "music";
    if (curious && !baseMood) return "curious";
    if (baseMood) return baseMood;
    if (isHovered && !situation.ambient) return "attentive"; // o cursor está no notch
    return situation.ambient ?? "idle"; // parada: entedia, dá sono, dorme
  }, [incomingInvite, situation.transient, situation.ambient, isHovered, dizzy, controllerFlash, notchEvent, dropzone.armed, dropzone.over, dropzone.importing, digested, isCallActive, isMuted, activeGameTitle, isPcMediaPlaying, curious, baseMood]);

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
  const compactWidth = LIVE_WIDTH[liveKind];
  // chamada tocando: o notch aparece sozinho (mesmo escondido por outra janela)
  useEffect(() => {
    if (incomingInvite) revealNotch();
  }, [incomingInvite, revealNotch]);

  // Oculta o Notch no topo se houver janela sobreposta e o cursor não estiver na área
  // (nunca durante chamada ou jogo — ver shouldAutoHide).
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
      notchSound("mascotPoke");
      reactMood(recent.length === 1 ? "surprised" : "annoyed");
    }
  }, [notchSound, revealNotch, reactMood]);

  const openNotch = () => {
    revealNotch();
    setIsExpanded(true);
  };

  const hasAnySection = isCallActive || Boolean(activeGameTitle) || mediaState.hasMedia;
  const sourceLabel = prettySourceApp(mediaState.sourceApp);

  // Quem "hospeda" o mascote quando o painel abre (a barra cede o lugar): a chamada,
  // o slot da capa (música sem capa) ou o balão ocioso. Jogo sozinho não hospeda.
  const mascotHost: "call" | "game" | "media" | "idle" | null = !isExpanded || !config.showMascot
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
  const barMascot = (size: number) => !config.showMascot ? null : (
    <div
      data-notch-mascot="true"
      className="shrink-0"
      style={{
        width: size,
        height: size,
        opacity: mascotHost ? 0 : 1,
        transition: "opacity 0.18s ease",
      }}
    >
      <GazingMascot
        cursor={gazeCursor}
        size={size}
        mood={mascotMood}
        isHovered={isHovered}
        bodyColor={mascotBodyColor}
        shape={mascotShape}
        hat={config.hat}
        items={config.items}
        inCall={isCallActive}
        isMusicPlaying={isPcMediaPlaying}
        levelRef={voiceLevelRef}
        muted={isCallActive && isMuted}
        waveAt={notchEvent && notchEventWaves(notchEvent.kind) ? notchEvent.at : undefined}
        celebrateAt={notchEvent?.kind === "achievement" ? notchEvent.at : undefined}
        mutedSpeechRef={mutedSpeechRef}
        isSpeaking={mouthSpeaking}
        onClick={handleMascotPoke}
      />
    </div>
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
        bodyColor={mascotBodyColor}
        shape={mascotShape}
        hat={config.hat}
        items={config.items}
        inCall={opts?.mood ? false : isCallActive}
        // com humor forçado (aba Controle) ela não dança com a música: só segura o controle
        isMusicPlaying={opts?.mood ? false : isPcMediaPlaying}
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
    if (isExpanded) {
      // cabeçalho estilo Coucou: abas só com ícone à esquerda, atalhos à direita
      const tabBtn = (id: "home" | "controller", label: string, icon: React.ReactNode) => (
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
          className={`flex h-9 w-11 items-center justify-center rounded-full transition-colors ${
            tab === id ? "bg-white/[0.10] text-white" : "text-white/55 hover:bg-white/[0.06] hover:text-white"
          }`}
        >
          {icon}
        </button>
      );
      return (
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-1" role="tablist">
            {tabBtn("home", "Início", <Home size={17} />)}
            {tabBtn("controller", "Controle", <Gamepad2 size={17} />)}
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
    return (
      <>
        <div className="flex-1 flex items-center">{barMascot(BAR_MASCOT)}</div>
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

      <aside
        aria-label="Desktop Notch"
        data-overlay-interactive="true"
        data-notch-root="true"
        data-notch-expanded={isExpanded ? "true" : "false"}
        data-notch-theme={appearance.visualTheme}
        style={
          notchStyle.chamfer && notchStyle.glow > 0
            ? { filter: `drop-shadow(0 0 ${Math.round(5 + notchStyle.glow * 12)}px ${notchStyle.glowColor})` }
            : undefined
        }
        className={`fixed top-0 left-1/2 -translate-x-1/2 z-[10030] pointer-events-auto select-none transition-transform ${
          isHiddenByWindow
            ? "-translate-y-[64px] duration-[340ms] delay-[420ms] [transition-timing-function:cubic-bezier(0.45,0,0.2,1)]"
            : "translate-y-0 duration-300 [transition-timing-function:cubic-bezier(0.3,1.2,0.4,1)]"
        } ${className}`}
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
          transition={geometryTransition(isExpanded || isAchievement)}
          style={{
            backgroundColor: chamferBorder ? (notchStyle.borderColor as string) : notchBg,
            clipPath: notchStyle.chamfer ? chamferClipPath(chamferCut) : undefined,
            backdropFilter: frosted ? "blur(18px)" : undefined,
            WebkitBackdropFilter: frosted ? "blur(18px)" : undefined,
          }}
          className="relative text-white"
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

          {/* Barra */}
          <div
            className="flex items-center px-3 cursor-pointer"
            style={{ height: NOTCH_BAR_HEIGHT }}
            onClick={isCallActive ? handleOpenCall : openNotch}
          >
            {renderBar()}
          </div>

          {/* Painel */}
          <AnimatePresence initial={false}>
            {isAchievement && !isExpanded && notchEvent && (
              <motion.div
                key={`achievement-${notchEvent.id}`}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0, transition: { height: CLOSE_TRANSITION, opacity: { duration: VIEW_OUT_S } } }}
                transition={{ height: geometryTransition(true), opacity: { duration: VIEW_IN_S, delay: 0.05 } }}
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
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0, transition: { height: CLOSE_TRANSITION, opacity: { duration: VIEW_OUT_S } } }}
                transition={{
                  height: geometryTransition(true),
                  opacity: { duration: VIEW_IN_S, delay: VIEW_OUT_S },
                }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-4 pt-1 flex flex-col gap-3.5">
                  {/* ── Dropzone: arraste imagens até aqui para salvá-las nas capturas ── */}
                  {dropzone.active && (
                    <section className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-white/25 bg-white/[0.05] px-4 py-5 text-center">
                      <Camera size={20} className="text-white/70" />
                      <p className="text-[13px] font-semibold text-white">
                        {dropzone.importing
                          ? "Salvando…"
                          : dropzone.message ?? (dropzone.over ? "Solte para salvar" : "Solte imagens aqui")}
                      </p>
                      {!dropzone.message && !dropzone.importing && (
                        <p className="text-[11px] text-white/45">Elas vão para as suas capturas</p>
                      )}
                    </section>
                  )}
                  {overloaded && (
                    <NotchCard>
                      <div className="flex items-center gap-4">
                        {config.showMascot && panelMascot(64)}
                        <div className="min-w-0">
                          <p className="text-[14px] font-semibold text-white">Muitos cliques de uma vez.</p>
                          <p className="mt-0.5 text-[12px] leading-snug text-white/55">
                            Me dá um segundo — volto ao trabalho em três segundos.
                          </p>
                        </div>
                      </div>
                    </NotchCard>
                  )}
                  {incomingInvite && !overloaded && !dropzone.active && (
                    <NotchCard tone="green">
                      <SectionLabel>Chamada recebida</SectionLabel>
                      <div className="flex items-center gap-3">
                        {config.showMascot && panelMascot(64, { mood: "excited" })}
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
                            className="flex h-11 w-11 items-center justify-center rounded-full bg-[#ff453a] text-white transition-all hover:brightness-110 active:scale-90"
                          >
                            <PhoneOff size={19} />
                          </button>
                          <button
                            type="button"
                            onClick={() => (overlayIncomingCall ? overlayIncomingCall.onAccept() : void voiceCall.answerCall())}
                            aria-label="Atender"
                            className="flex h-11 w-11 items-center justify-center rounded-full bg-[#30d158] text-white transition-all hover:brightness-110 active:scale-90"
                          >
                            <Phone size={19} />
                          </button>
                        </div>
                      </div>
                    </NotchCard>
                  )}
                  {tab === "controller" && !incomingInvite && !overloaded && !dropzone.active && (
                    <ControllerTab
                      state={controller}
                      mascot={panelMascot(96, { mood: controller.connected ? "gaming" : "sad", headphones: true })}
                    />
                  )}
                  <div className={dropzone.active || overloaded || tab === "controller" || Boolean(incomingInvite) ? "hidden" : "contents"}>
                  {/* ── Chamada de voz ── */}
                  {isCallActive && (
                    <NotchCard tone="green">
                      <SectionLabel>Chamada de voz</SectionLabel>
                      <div className="flex items-center gap-3">
                        {config.showMascot && panelMascot(64)}
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
                    <NotchCard tone="pink">
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
                              <div className={`absolute -bottom-2 -right-2 rounded-full bg-black p-0.5 ${config.showMascot && mascotHost !== "game" ? "" : "hidden"}`}>
                                <GazingMascot
                                  cursor={gazeCursor}
                                  size={36}
                                  mood={mascotMood}
                                  isHovered={isHovered}
                                  bodyColor={mascotBodyColor}
        shape={mascotShape}
        hat={config.hat}
        items={config.items}
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
                        <MediaProgress timelineRef={timelineRef} />
                      </div>
                      <div className="mt-3 flex items-center justify-center gap-7">
                        <button
                          type="button"
                          onClick={handleSkipPrev}
                          className="text-white/75 hover:text-white transition-all active:scale-90"
                          title="Faixa anterior"
                          aria-label="Faixa anterior"
                        >
                          <SkipBack size={18} className="fill-current" />
                        </button>
                        <button
                          type="button"
                          onClick={handleTogglePlayPause}
                          className="w-11 h-11 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-all active:scale-90"
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
                          className="text-white/75 hover:text-white transition-all active:scale-90"
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
                  )}

                  {/* ── Nada acontecendo ── */}
                  {!hasAnySection && (
                    <section
                      className="flex flex-col items-center gap-3 rounded-[24px] border border-white/[0.035] bg-[#141518] px-5 pb-4 pt-5"
                      style={{ backgroundImage: "radial-gradient(70% 90% at 50% 38%, rgba(255,255,255,0.075) 0%, transparent 70%)" }}
                    >
                      {config.showMascot && panelMascot(92)}
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
      </aside>
    </>
  );
};

/** Notch respeitando "Ativar o notch" das configurações (usado fora do overlay, ex.: dev no navegador). */
export const ConfiguredDesktopNotch: React.FC = () => {
  const config = useNotchConfig();
  return config.enabled ? <DesktopNotch config={config} /> : null;
};
