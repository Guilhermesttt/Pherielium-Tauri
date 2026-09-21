import React from "react";

/**
 * Efeito Luma: borda/spotlight que segue o cursor.
 * Escreve --cg-x/--cg-y direto no elemento (sem re-render, só repaint).
 * A visibilidade é controlada por CSS (.cursor-glow), que respeita
 * prefers-reduced-motion e low-performance mode.
 */
export function handleCursorGlow(e: React.MouseEvent<HTMLElement>) {
  const el = e.currentTarget;
  const rect = el.getBoundingClientRect();
  el.style.setProperty("--cg-x", `${e.clientX - rect.left}px`);
  el.style.setProperty("--cg-y", `${e.clientY - rect.top}px`);
}
