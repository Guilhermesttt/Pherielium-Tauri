import type { VisualTheme } from "../context/PreferencesContext";

export interface OverlayThemeTokens {
  accent: string;
  accentMuted: string;
  accentGlow: string;
}

const OVERLAY_THEME_TOKENS: Record<VisualTheme, OverlayThemeTokens> = {
  phelierium: { accent: "#e85002", accentMuted: "rgba(232,80,2,0.85)", accentGlow: "rgba(232,80,2,0.4)" },
  checkpoint: { accent: "#e85002", accentMuted: "rgba(232,80,2,0.85)", accentGlow: "rgba(232,80,2,0.4)" },
  ps5: { accent: "#8bbfff", accentMuted: "rgba(139,191,255,0.85)", accentGlow: "rgba(139,191,255,0.4)" },
  ps4: { accent: "#1685ff", accentMuted: "rgba(22,133,255,0.85)", accentGlow: "rgba(22,133,255,0.4)" },
  playstation: { accent: "#5367b8", accentMuted: "rgba(83,103,184,0.85)", accentGlow: "rgba(83,103,184,0.4)" },
  psp: { accent: "#cbd5e1", accentMuted: "rgba(203,213,225,0.85)", accentGlow: "rgba(203,213,225,0.4)" },
  gamecube: { accent: "#8b5cf6", accentMuted: "rgba(139,92,246,0.85)", accentGlow: "rgba(139,92,246,0.4)" },
  xbox360: { accent: "#84cc16", accentMuted: "rgba(132,204,22,0.85)", accentGlow: "rgba(132,204,22,0.4)" },
  cyberpunk: { accent: "#ffee00", accentMuted: "rgba(255,238,0,0.9)", accentGlow: "rgba(255,238,0,0.45)" },
};

export function getOverlayThemeTokens(visualTheme?: string | null): OverlayThemeTokens {
  const key = (visualTheme || "phelierium") as VisualTheme;
  return OVERLAY_THEME_TOKENS[key] ?? OVERLAY_THEME_TOKENS.phelierium;
}
