/**
 * Tokens visuais do painel expandido do overlay — mesma linguagem do notch:
 * preto #050506 translúcido, sem borda, sombra suave, molas e pílulas.
 */

/** Superfície das gavetas/docks: preto do notch com vidro fosco. */
export const PANEL_SURFACE_CLASS = "bg-[rgba(5,5,6,0.92)] backdrop-blur-2xl";

/** Sombra única (substitui as sombras pesadas de 80-100px). */
export const PANEL_SHADOW = "shadow-[0_18px_48px_rgba(0,0,0,0.45)]";

/** Foco visível consistente para teclado/gamepad. */
export const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50";

/**
 * Escala de empilhamento. O painel fica ABAIXO do notch e dos toasts para ainda ser
 * possível atender uma chamada (controles do notch / toast) com o painel aberto.
 * O CSS dos toasts (overlay.css) usa 10028 e o notch 10030.
 */
export const PANEL_Z = 10025;

import type { CSSProperties } from "react";
import { withAlpha } from "../../../mascot/mascotColor";
import { EXPANDED_RADIUS_BONUS, type NotchStyle } from "../../../mascot/notchTheme";

/**
 * Estilo inline do dock/gaveta derivado do estilo do notch: fundo (com a opacidade do
 * tema), borda/brilho no acento do tema e raio dos cantos. No tema padrão resulta
 * praticamente no visual de antes (#050506, sem borda, raio 28).
 */
export function panelSurfaceStyle(style: NotchStyle): CSSProperties {
  const alpha = style.isDefault ? 0.92 : Math.min(0.94, style.surfaceOpacity);
  const layers = [
    style.borderColor ? `0 0 0 1px ${style.borderColor}` : "0 0 0 0 transparent",
    style.glow > 0 ? `0 0 ${Math.round(8 + style.glow * 20)}px ${style.glowColor}` : "0 0 0 0 transparent",
    "0 18px 48px rgba(0,0,0,0.45)",
  ];
  return {
    backgroundColor: withAlpha(style.surface, alpha),
    boxShadow: layers.join(", "),
    // painéis grandes mantêm cantos suaves mesmo no estilo chanfrado (só o notch é cortado)
    borderRadius: style.chamfer ? 14 : style.cornerRadius + EXPANDED_RADIUS_BONUS,
  };
}
