import React from "react";

/**
 * Fundo ambiente: dois focos de luz desfocados na cor da arte do jogo em foco, atrás do
 * conteúdo. Dá profundidade sem sombra pesada e faz o app "mudar de clima" com o jogo.
 *
 * Estático de propósito: nada anima aqui, então não custa quadros a 144 Hz. A troca de cor
 * é um fade de `opacity` em CSS (some com `prefers-reduced-motion`).
 */
export interface AmbientBackdropProps {
  /** Qualquer cor CSS (a de `useGameColor` serve). Sem cor, nada é desenhado. */
  color?: string | null;
  /** 0 a 1; o padrão é discreto para não competir com o texto. */
  intensity?: number;
  className?: string;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export const AmbientBackdrop: React.FC<AmbientBackdropProps> = ({ color, intensity = 0.35, className }) => {
  if (!color) return null;
  const strength = Math.round(clamp01(intensity) * 100);
  return (
    <div
      aria-hidden="true"
      data-ambient-backdrop=""
      className={`pointer-events-none absolute inset-0 z-0 overflow-hidden transition-opacity duration-500 motion-reduce:transition-none ${className ?? ""}`}
      style={{
        backgroundImage: [
          `radial-gradient(60% 55% at 78% 8%, color-mix(in srgb, ${color} ${strength}%, transparent), transparent 70%)`,
          `radial-gradient(45% 45% at 8% 92%, color-mix(in srgb, ${color} ${Math.round(strength * 0.6)}%, transparent), transparent 70%)`,
        ].join(", "),
      }}
    />
  );
};
