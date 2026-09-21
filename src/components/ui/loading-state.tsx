"use client";

import { useEffect, useState } from "react";
import { ThinkingOrbLoader, type ThinkingOrbState } from "../ThinkingOrbLoader";

/* ─────────────────────────────────────────────────────────
 * LOADING STATE — thinking-orb loader
 *
 * As 9 variações são os estados do thinking-orbs (cada um com
 * sua animação calibrada):
 *   working, searching, solving, listening, connecting,
 *   weaving, composing, breathing, shaping
 *
 * Nomes legados (Drive/Dots/Orbit/Thinking) continuam
 * funcionando via mapa abaixo.
 *
 * Tamanhos: sm → orb 20px (inline), md/lg → orb 64px.
 * `dark` inverte a tinta para fundos claros.
 *
 * Paired with a shimmering label and a live elapsed timer
 * in mono tabular figures.
 * ───────────────────────────────────────────────────────── */

const LEGACY_VARIANTS: Record<string, ThinkingOrbState> = {
  Drive: "working",
  Dots: "searching",
  Orbit: "breathing",
  Thinking: "searching",
};

function resolveOrbState(variant: string): ThinkingOrbState {
  if (variant in LEGACY_VARIANTS) return LEGACY_VARIANTS[variant];
  return variant as ThinkingOrbState;
}

function useElapsed(enabled = true) {
  const [ds, setDs] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const t = setInterval(() => setDs((d) => d + 1), 100);
    return () => clearInterval(t);
  }, [enabled]);
  const total = ds / 10;
  if (total < 60) return `${total.toFixed(1)}s`;
  return `${Math.floor(total / 60)}m ${(total % 60).toFixed(1)}s`;
}

export interface LoadingStateProps {
  label?: string;
  variant?: ThinkingOrbState | "Drive" | "Dots" | "Orbit" | "Thinking";
  className?: string;
  showTimer?: boolean;
  size?: "sm" | "md" | "lg";
  dark?: boolean;
  /** Exibe o orb ao lado do texto (padrão true) */
  showIcon?: boolean;
}

export function LoadingState({
  label = "Carregando",
  variant = "working",
  className = "",
  showTimer = true,
  size = "md",
  dark = false,
  showIcon = true,
}: LoadingStateProps) {
  const elapsed = useElapsed(showTimer);
  const orbState = resolveOrbState(variant);

  const textSize = size === "sm" ? "text-[11px]" : size === "lg" ? "text-[14px]" : "text-[13px]";
  const timerSize = size === "sm" ? "text-[10px]" : size === "lg" ? "text-[13px]" : "text-[12px]";

  const shimmerGradient = dark
    ? "linear-gradient(90deg, rgba(0,0,0,0.4) 35%, rgba(0,0,0,0.95) 50%, rgba(0,0,0,0.4) 65%)"
    : "linear-gradient(90deg, rgba(255,255,255,0.4) 35%, rgba(255,255,255,0.95) 50%, rgba(255,255,255,0.4) 65%)";

  return (
    <div className={`flex w-fit items-center gap-2.5 ${className}`}>
      {showIcon && (
        <span aria-hidden className="inline-flex shrink-0 items-center">
          <ThinkingOrbLoader
            state={orbState}
            size={size === "sm" ? 20 : 64}
            theme={dark ? "light" : "dark"}
            label={label}
          />
        </span>
      )}
      {label && (
        <span
          className={`bg-clip-text ${textSize} font-medium text-transparent`}
          style={{
            backgroundImage: shimmerGradient,
            backgroundSize: "200% 100%",
            animation: "shimmer-text 1.4s linear infinite",
          }}
        >
          {label}
        </span>
      )}
      {showTimer && (
        <span className={`font-mono ${timerSize} ${dark ? "text-black/50" : "text-white/50"} tabular-nums`}>
          {elapsed}
        </span>
      )}
    </div>
  );
}

export default LoadingState;
