import React from "react";
import { createOrb, createOrbTheme, type OrbController, type OrbState } from "orbloom";
import "orbloom/styles.css";

export type OrbloomCallState = "idle" | "ringing" | "connecting" | "active-speaking" | "active-quiet" | "muted" | "error";

interface OrbloomOrbProps {
  /** Estado semântico da chamada já mapeado pelo componente pai */
  orbState?: OrbState;
  /** Stream de áudio para reatividade real (local ou remoto). Se ausente, usa animação idle. */
  audioStream?: MediaStream | null;
  /** Nível manual 0..1 (fallback quando não há stream). Ignorado se audioStream existir. */
  level?: number;
  /** Diâmetro em px (vira --orb-diameter) */
  size?: number;
  quality?: "low" | "balanced" | "high";
  className?: string;
  label?: string;
  /**
   * Identificador estável do participante (uid, feed id, nome).
   * Gera uma cor de accents determinística por usuário — cada pessoa
   * da call tem o próprio tingimento no orb.
   */
  participantId?: string | null;
  /**
   * Cor personalizada do perfil da pessoa (ex: hex '#8B5CF6').
   * Se definida, a orb reflete a cor exata do perfil.
   */
  color?: string | null;
  /**
   * Flutuação ambiente (sobe/desce via CSS). Desligue nas superfícies
   * de chamada para o orb ficar estático (o interior continua vivo e
   * reativo à voz — só a posição para de flutuar).
   */
  ambientMotion?: boolean;
  /** Se for o usuário local, aplica as preferências customizadas salvas do Orbloom */
  isLocal?: boolean;
  /** Configuração customizada explícita do Orbloom */
  customConfig?: OrbloomCustomConfig | null;
}

export interface OrbloomCustomConfig {
  preset: string;
  seed?: number;
  appearance?: {
    intensity: number;
    detail: number;
    glass: number;
    glow: number;
  };
  motion?: {
    speed: number;
    drift: number;
  };
  audioResponse?: {
    brightness: number;
    motion: number;
    pulse: number;
  };
}

const ORBLOOM_CONFIG_STORAGE_KEY = "checkpoint_orbloom_custom_config";

export function loadSavedOrbloomConfig(): OrbloomCustomConfig | null {
  try {
    const raw = localStorage.getItem(ORBLOOM_CONFIG_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveOrbloomConfig(config: OrbloomCustomConfig): void {
  try {
    localStorage.setItem(ORBLOOM_CONFIG_STORAGE_KEY, JSON.stringify(config));
    window.dispatchEvent(new CustomEvent("checkpoint:orbloom-config-changed", { detail: config }));
  } catch (err) {
    console.error("Failed to save orbloom config", err);
  }
}

export function clearOrbloomConfig(): void {
  try {
    localStorage.removeItem(ORBLOOM_CONFIG_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent("checkpoint:orbloom-config-changed", { detail: null }));
  } catch (err) {
    console.error("Failed to clear orbloom config", err);
  }
}

/**
 * Mapeia estado da chamada Phelierium -> estado semântico do Orbloom.
 * Mantém o vocabulário do orbloom: idle | listening | thinking | speaking | success | error
 */
export function mapCallToOrbState(opts: {
  isRinging?: boolean;
  isConnecting?: boolean;
  isMuted?: boolean;
  isDeafened?: boolean;
  isSpeaking?: boolean;
  callActive?: boolean;
}): OrbState {
  if (opts.isConnecting) return "thinking";
  if (opts.isRinging) return "idle";
  if (opts.isMuted || opts.isDeafened) return "idle";
  if (opts.isSpeaking) return "speaking";
  if (opts.callActive) return "listening";
  return "idle";
}

/**
 * Trios de accents calibrados para o vidro escuro (highlight branco
 * preserva os glints do glass). O índice vem do hash do participante,
 * garantindo que cada usuário da chamada tenha uma cor marcante e distinta.
 */
const PARTICIPANT_ACCENTS: ReadonlyArray<readonly [string, string, string]> = [
  ["#8B5CF6", "#6D28D9", "#FFFFFF"], // violeta (Phelierium purple)
  ["#22D3EE", "#0E7490", "#FFFFFF"], // cyan
  ["#10B981", "#047857", "#FFFFFF"], // esmeralda
  ["#F59E0B", "#B45309", "#FFFFFF"], // âmbar / dourado
  ["#EC4899", "#BE185D", "#FFFFFF"], // rosa vibrante
  ["#3B82F6", "#1D4ED8", "#FFFFFF"], // azul safira
  ["#84CC16", "#4D7C0F", "#FFFFFF"], // lima
  ["#F97316", "#C2410C", "#FFFFFF"], // laranja
  ["#EF4444", "#B91C1C", "#FFFFFF"], // carmim
  ["#06B6D4", "#0891B2", "#FFFFFF"], // oceano
  ["#A855F7", "#7E22CE", "#FFFFFF"], // púrpura
  ["#14B8A6", "#0F766E", "#FFFFFF"], // teal
];

function hexToAccents(hex: string): readonly [string, string, string] {
  const clean = hex.replace(/^#/, "").trim();
  if (!/^[0-9a-fA-F]{3}$/.test(clean) && !/^[0-9a-fA-F]{6}$/.test(clean)) {
    return PARTICIPANT_ACCENTS[0];
  }
  let r = 0;
  let g = 0;
  let b = 0;
  if (clean.length === 3) {
    r = parseInt(clean[0] + clean[0], 16);
    g = parseInt(clean[1] + clean[1], 16);
    b = parseInt(clean[2] + clean[2], 16);
  } else {
    r = parseInt(clean.slice(0, 2), 16);
    g = parseInt(clean.slice(2, 4), 16);
    b = parseInt(clean.slice(4, 6), 16);
  }
  const factor = 0.65;
  const dr = Math.round(r * factor).toString(16).padStart(2, "0");
  const dg = Math.round(g * factor).toString(16).padStart(2, "0");
  const db = Math.round(b * factor).toString(16).padStart(2, "0");
  const hex6 = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  const darker = `#${dr}${dg}${db}`;
  return [hex6.toUpperCase(), darker.toUpperCase(), "#FFFFFF"];
}

function hashParticipantId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function accentsForParticipant(
  participantId?: string | null,
  customColor?: string | null
): {
  accents: readonly [string, string, string];
  seed: number;
  index: number;
} {
  if (customColor && customColor.startsWith("#")) {
    const accents = hexToAccents(customColor);
    const hash = participantId ? hashParticipantId(participantId) : 1234;
    const seed = 1 + ((hash % 1000) / 1000) * 10;
    return { accents, seed, index: 0 };
  }

  const id = participantId || "default";
  const hash = hashParticipantId(id);
  const index = hash % PARTICIPANT_ACCENTS.length;
  // seed estável por usuário: mesma pessoa, mesmo arranjo de estrelas
  const seed = 1 + ((hash % 1000) / 1000) * 10;
  return { accents: PARTICIPANT_ACCENTS[index], seed, index };
}

/**
 * ID seguro para o tema do Orbloom:
 * orbloom exige: /^[a-z][a-z0-9-]{0,63}$/ (começa com letra minúscula, máx 64 chars)
 */
function toSafeOrbThemeId(index: number, raw?: string | null): string {
  const hash = raw ? hashParticipantId(String(raw)) : 0;
  const hashStr = hash.toString(36).toLowerCase();
  return `cp-u${index}-${hashStr}`.slice(0, 32);
}

/**
 * Tema Checkpoint/Orbloom — fundação deep-field (bolha escura com estrelas)
 * tingida pelo perfil do participante: base escura, accents por usuário.
 */
function getCheckpointTheme(participantId?: string | null, customColor?: string | null) {
  const { accents, seed, index } = accentsForParticipant(participantId, customColor);
  const themeId = toSafeOrbThemeId(index, customColor || participantId);
  return createOrbTheme({
    preset: "deep-field-blue-01",
    id: themeId,
    seed,
    colors: {
      base: "#161616",
      interior: "#0F0F0F",
      accents,
    },
    appearance: {
      intensity: 1.25,
      detail: 0.75,
      glass: 0.45,
      glow: 1.1,
    },
    motion: {
      speed: 0.7,
      drift: 0.6,
    },
    // Resposta de voz no máximo: brightness 2 = brilho forte ao falar,
    // motion 2 = órbita interna acelera/gira com a voz, pulse 1.8 = aurora reativa.
    audioResponse: {
      brightness: 2,
      motion: 2,
      pulse: 1.8,
    },
  });
}

const themeCache = new Map<string, ReturnType<typeof createOrbTheme>>();
function checkpointTheme(participantId?: string | null, customColor?: string | null) {
  const key = `${participantId ?? "default"}:${customColor ?? ""}`;
  let theme = themeCache.get(key);
  if (!theme) {
    theme = getCheckpointTheme(participantId, customColor);
    themeCache.set(key, theme);
  }
  return theme;
}

const OrbloomOrbComponent: React.FC<OrbloomOrbProps> = ({
  orbState = "idle",
  audioStream = null,
  level,
  size = 180,
  quality = "balanced",
  className = "",
  label = "Atividade de voz",
  participantId = null,
  color = null,
  ambientMotion = true,
  isLocal = false,
  customConfig = null,
}) => {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const controllerRef = React.useRef<OrbController | null>(null);
  const audioCleanupRef = React.useRef<(() => void) | null>(null);
  const [webglFailed, setWebglFailed] = React.useState(false);

  const [localSavedConfig, setLocalSavedConfig] = React.useState<OrbloomCustomConfig | null>(() => {
    if (isLocal) {
      return loadSavedOrbloomConfig();
    }
    return null;
  });

  React.useEffect(() => {
    if (!isLocal) return;
    const handleConfigChange = (e: Event) => {
      const customEvent = e as CustomEvent<OrbloomCustomConfig | null>;
      setLocalSavedConfig(customEvent.detail ?? null);
    };
    window.addEventListener("checkpoint:orbloom-config-changed", handleConfigChange);
    return () => {
      window.removeEventListener("checkpoint:orbloom-config-changed", handleConfigChange);
    };
  }, [isLocal]);

  const effectiveCustomConfig = customConfig ?? (isLocal ? localSavedConfig : null);

  const theme = React.useMemo(() => {
    if (effectiveCustomConfig) {
      try {
        const themeId = `usr-${effectiveCustomConfig.preset.replace(/[^a-z0-9-]/g, "")}`.slice(0, 32);
        return createOrbTheme({
          preset: effectiveCustomConfig.preset as any,
          id: themeId,
          seed: effectiveCustomConfig.seed ?? 2.4,
          appearance: effectiveCustomConfig.appearance,
          motion: effectiveCustomConfig.motion,
          audioResponse: effectiveCustomConfig.audioResponse,
        });
      } catch {
        return effectiveCustomConfig.preset;
      }
    }
    return checkpointTheme(participantId, color);
  }, [participantId, color, effectiveCustomConfig]);

  React.useEffect(() => {
    if (controllerRef.current && theme) {
      try {
        controllerRef.current.setTheme(theme as any);
      } catch (err) {
        console.warn("Failed to update Orbloom theme:", err);
      }
    }
  }, [theme]);

  // Lifecycle: create / destroy
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (typeof window === "undefined") return;

    // Respeita prefers-reduced-motion via modo "user" do próprio orbloom
    let controller: OrbController | null = null;
    try {
      controller = createOrb(canvas, {
        theme,
        quality,
        state: orbState,
        reducedMotion: "user",
        onError: () => setWebglFailed(true),
      });
    } catch {
      setWebglFailed(true);
      return;
    }
    controllerRef.current = controller;

    const handleHide = () => {
      if (document.hidden) controller?.pause();
      else controller?.resume();
    };
    document.addEventListener("visibilitychange", handleHide);
    window.addEventListener("pagehide", () => controller?.destroy(), { once: true });

    return () => {
      document.removeEventListener("visibilitychange", handleHide);
      audioCleanupRef.current?.();
      audioCleanupRef.current = null;
      controller?.destroy();
      controllerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tema por participante (cor de cada usuário da call)
  React.useEffect(() => {
    try {
      controllerRef.current?.setTheme(theme);
    } catch {
      /* mantém o tema atual em caso de falha */
    }
  }, [theme]);

  // Estado semântico
  React.useEffect(() => {
    controllerRef.current?.setState(orbState);
  }, [orbState]);

  // Qualidade
  React.useEffect(() => {
    controllerRef.current?.setQuality(quality);
  }, [quality]);

  // Fonte de áudio: stream real -> analyser; senão nível manual; senão idle (0 -> animação procedural)
  React.useEffect(() => {
    const controller = controllerRef.current;
    if (!controller) return;

    // limpa fonte anterior
    audioCleanupRef.current?.();
    audioCleanupRef.current = null;
    controller.disconnectAudio();

    if (audioStream && audioStream.getAudioTracks().length > 0) {
      try {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) {
          controller.setAudioLevel(level ?? 0);
          return;
        }
        const ctx = new Ctx();
        const src = ctx.createMediaStreamSource(audioStream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.55;
        src.connect(analyser);
        void ctx.resume().catch(() => {});
        const disconnect = controller.attachAudioSource(analyser);
        audioCleanupRef.current = () => {
          disconnect();
          try { src.disconnect(); } catch { /* noop */ }
          void ctx.close().catch(() => {});
        };
        return () => {
          audioCleanupRef.current?.();
          audioCleanupRef.current = null;
        };
      } catch {
        controller.setAudioLevel(level ?? 0);
        return;
      }
    }

    controller.setAudioLevel(level ?? 0);
  }, [audioStream, level]);

  return (
    <div
      className={`orb-motion ${webglFailed ? "orb-no-webgl" : ""} ${className}`}
      data-ambient-motion={ambientMotion ? "true" : "false"}
      style={{ ["--orb-diameter" as string]: `${size}px`, width: size, height: size }}
    >
      <div className="orb-shell">
        <div className="orb-clip">
          <canvas ref={canvasRef} className="orb-canvas" aria-label={label} role="img" />
          <div className="orb-fallback" aria-hidden="true" />
        </div>
        <div className="orb-chrome" aria-hidden="true" />
      </div>
    </div>
  );
};

/**
 * Memoized: each tile mounts its own WebGL context via `createOrb`, so with a
 * full grid of participants this component is the single most expensive thing
 * on the call surface. Skipping re-renders when props are unchanged avoids
 * redundant work in React's commit phase (the WebGL draw loop itself already
 * runs independently via rAF inside the orbloom controller).
 */
export const OrbloomOrb = React.memo(OrbloomOrbComponent);

export default OrbloomOrb;
