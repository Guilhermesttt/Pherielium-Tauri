import React from "react";

/**
 * Balão de fala retrô: contorno de pixel em borda dupla e cauda triangular apontando
 * para o mascote (à esquerda). Usado nas dicas do painel ocioso quando `bubbleStyle === "retro"`.
 */
export const RetroBubble: React.FC<{ children: React.ReactNode; accent?: string }> = ({
  children,
  accent = "#ffffff",
}) => (
  <div className="relative flex-1 min-w-0" data-retro-bubble>
    <div
      className="relative bg-[#0b0b0e] px-3.5 py-2.5"
      style={{
        border: `2px solid ${accent}`,
        boxShadow: `inset 0 0 0 2px #0b0b0e, inset 0 0 0 3px ${accent}55, 3px 3px 0 ${accent}33`,
        borderRadius: 2,
      }}
    >
      {children}
    </div>
    {/* cauda triangular (borda + miolo) */}
    <span
      aria-hidden
      className="absolute top-1/2 -translate-y-1/2"
      style={{
        left: -11,
        width: 0,
        height: 0,
        borderTop: "8px solid transparent",
        borderBottom: "8px solid transparent",
        borderRight: `11px solid ${accent}`,
      }}
    />
    <span
      aria-hidden
      className="absolute top-1/2 -translate-y-1/2"
      style={{
        left: -7,
        width: 0,
        height: 0,
        borderTop: "6px solid transparent",
        borderBottom: "6px solid transparent",
        borderRight: "8px solid #0b0b0e",
      }}
    />
  </div>
);
