import React from "react";
import { ThinkingOrb, type OrbState as ThinkingOrbState, type OrbTheme } from "thinking-orbs";
import { useLowPerf } from "./PerformanceComponents";

export type { ThinkingOrbState, OrbTheme };

/** Atalhos semânticos do hub -> estados do thinking-orbs */
export const THINKING_LOADER_STATES = {
  sync: "searching",
  ai: "working",
  solving: "solving",
  listening: "listening",
  connecting: "connecting",
  weaving: "weaving",
  composing: "composing",
  idle: "breathing",
  shaping: "shaping",
} as const satisfies Record<string, ThinkingOrbState>;

export type ThinkingLoaderPreset = keyof typeof THINKING_LOADER_STATES;

interface ThinkingOrbLoaderProps {
  /** Estado direto do thinking-orbs (prevalece sobre `preset`) */
  state?: ThinkingOrbState;
  /** Atalho semântico */
  preset?: ThinkingLoaderPreset;
  /** 64 (avatar) ou 20 (inline) — únicos tamanhos calibrados pelo pacote */
  size?: 64 | 20;
  speed?: number;
  /** Tema do pacote: `dark` = tinta clara p/ fundos escuros (padrão do hub) */
  theme?: OrbTheme;
  className?: string;
  style?: React.CSSProperties;
  label?: string;
}

/**
 * Loader pontilhado (thinking-orbs) fixo no tema dark da paleta Orbloom.
 * Congela a animação em low-perf / prefers-reduced-motion.
 */
export const ThinkingOrbLoader: React.FC<ThinkingOrbLoaderProps> = ({
  state,
  preset = "sync",
  size = 64,
  speed = 1,
  theme = "dark",
  className = "",
  style,
  label = "Carregando",
}) => {
  const low = useLowPerf();
  const [reducedMotion, setReducedMotion] = React.useState(false);

  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    <ThinkingOrb
      state={state ?? THINKING_LOADER_STATES[preset]}
      size={size}
      theme={theme}
      speed={speed}
      paused={low || reducedMotion}
      className={className}
      style={style}
      role="img"
      aria-label={label}
    />
  );
};

export default ThinkingOrbLoader;
