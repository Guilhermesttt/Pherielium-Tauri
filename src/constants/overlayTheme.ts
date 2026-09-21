import type { VisualTheme } from "../context/PreferencesContext";

export interface OverlayThemeTokens {
  accent: string;
  accentMuted: string;
  accentGlow: string;
}

const OVERLAY_THEME_TOKENS: Record<VisualTheme, OverlayThemeTokens> = {
  phelierium: { accent: "#ffffff", accentMuted: "rgba(255,255,255,0.72)", accentGlow: "rgba(255,255,255,0.35)" },
  checkpoint: { accent: "#ffffff", accentMuted: "rgba(255,255,255,0.72)", accentGlow: "rgba(255,255,255,0.35)" },
  ps5: { accent: "#38bdf8", accentMuted: "rgba(56,189,248,0.85)", accentGlow: "rgba(56,189,248,0.4)" },
  ps4: { accent: "#2563eb", accentMuted: "rgba(37,99,235,0.85)", accentGlow: "rgba(37,99,235,0.4)" },
  playstation: { accent: "#1d4ed8", accentMuted: "rgba(29,78,216,0.85)", accentGlow: "rgba(29,78,216,0.4)" },
  psp: { accent: "#06b6d4", accentMuted: "rgba(6,182,212,0.85)", accentGlow: "rgba(6,182,212,0.4)" },
  gamecube: { accent: "#8b5cf6", accentMuted: "rgba(139,92,246,0.85)", accentGlow: "rgba(139,92,246,0.4)" },
  xbox360: { accent: "#22c55e", accentMuted: "rgba(34,197,94,0.85)", accentGlow: "rgba(34,197,94,0.4)" },
  cyberpunk: { accent: "#fcee0a", accentMuted: "rgba(252,238,10,0.9)", accentGlow: "rgba(252,238,10,0.45)" },
};

export function getOverlayThemeTokens(visualTheme?: string | null): OverlayThemeTokens {
  const key = (visualTheme || "phelierium") as VisualTheme;
  return OVERLAY_THEME_TOKENS[key] ?? OVERLAY_THEME_TOKENS.phelierium;
}
