import { getOverlayThemeTokens } from "../constants/overlayTheme";
import { normalizeHex, withAlpha } from "./mascotColor";
import { BACKGROUND_OPACITY_RANGE, CORNER_RADIUS_RANGE, type NotchConfig } from "./notchConfig";

/**
 * Estilo visual do notch/painel, derivado do TEMA VISUAL do launcher (phelierium,
 * cyberpunk, ps5...) e dos ajustes do usuário. Puro: o `DesktopNotch` e o painel
 * só consomem o resultado. O tema padrão reproduz exatamente o visual de antes.
 */
export interface NotchStyle {
  /** cor de fundo `#rrggbb` */
  surface: string;
  /** opacidade do fundo 0..1 (abaixo de 1 liga o vidro fosco) */
  surfaceOpacity: number;
  /** cor da borda fina (css rgba) ou `null` = sem borda */
  borderColor: string | null;
  /** cor do brilho externo (css rgba) */
  glowColor: string;
  /** intensidade do brilho 0..1 */
  glow: number;
  /** raio dos cantos de baixo no estado compacto (o expandido soma EXPANDED_RADIUS_BONUS) */
  cornerRadius: number;
  /** cantos chanfrados (cortados) em vez de arredondados */
  chamfer: boolean;
  /** acento do tema */
  accent: string;
  /** estilo padrão sem nenhuma personalização (grafite, sem borda) */
  isDefault: boolean;
}

export const EXPANDED_RADIUS_BONUS = 10;
export const DEFAULT_NOTCH_SURFACE = "#050506";

type StyleOverrides = Pick<
  NotchConfig,
  "useThemeStyle" | "cornerRadius" | "glowIntensity" | "backgroundOpacity" | "chamfer"
>;

const DEFAULT_STYLE: NotchStyle = {
  surface: DEFAULT_NOTCH_SURFACE,
  surfaceOpacity: 1,
  borderColor: null,
  glowColor: "rgba(255,255,255,0)",
  glow: 0,
  cornerRadius: 18,
  chamfer: false,
  accent: "#ffffff",
  isDefault: true,
};

const KNOWN_STYLED_THEMES = new Set(["cyberpunk", "ps5", "ps4", "playstation", "psp", "gamecube", "xbox360"]);

/** Base de cada tema (antes dos ajustes do usuário). */
export function baseStyleForTheme(visualTheme: string | null | undefined): NotchStyle {
  const theme = visualTheme || "phelierium";
  // tema desconhecido (ou o padrão) = visual padrão
  if (!KNOWN_STYLED_THEMES.has(theme)) return DEFAULT_STYLE;

  const accent = normalizeHex(getOverlayThemeTokens(theme).accent, "#ffffff");

  // "Pílula tática cyberpunk": ultra-escuro com vidro, borda neon fina e cantos cortados
  if (theme === "cyberpunk") {
    return {
      surface: "#0a0a0c",
      surfaceOpacity: 0.88,
      borderColor: withAlpha(accent, 0.6),
      glowColor: withAlpha(accent, 0.55),
      glow: 0.6,
      cornerRadius: 9,
      chamfer: true,
      accent,
      isDefault: false,
    };
  }

  // Demais temas: o mesmo notch limpo do padrão (SEM borda nem brilho); só o acento muda.
  // A borda neon fica restrita ao cyberpunk (ou ao slider de brilho do usuário).
  return { ...DEFAULT_STYLE, accent };
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export function resolveNotchStyle(
  visualTheme: string | null | undefined,
  overrides: Partial<StyleOverrides> = {},
): NotchStyle {
  const useTheme = overrides.useThemeStyle !== false;
  const base = useTheme ? baseStyleForTheme(visualTheme) : DEFAULT_STYLE;

  const cornerRadius =
    overrides.cornerRadius == null
      ? base.cornerRadius
      : clamp(overrides.cornerRadius, CORNER_RADIUS_RANGE.min, CORNER_RADIUS_RANGE.max);
  const glow = overrides.glowIntensity == null ? base.glow : clamp(overrides.glowIntensity, 0, 1);
  const surfaceOpacity =
    overrides.backgroundOpacity == null
      ? base.surfaceOpacity
      : clamp(overrides.backgroundOpacity, BACKGROUND_OPACITY_RANGE.min, BACKGROUND_OPACITY_RANGE.max);
  const chamfer = overrides.chamfer == null ? base.chamfer : overrides.chamfer;

  // Brilho ligado sem borda (ex.: tema padrão + slider): cria uma borda no acento.
  const accent = useTheme ? base.accent : DEFAULT_STYLE.accent;
  const borderColor = base.borderColor ?? (glow > 0 ? withAlpha(accent, 0.35) : null);

  const untouched =
    cornerRadius === base.cornerRadius &&
    glow === base.glow &&
    surfaceOpacity === base.surfaceOpacity &&
    chamfer === base.chamfer;

  return {
    ...base,
    cornerRadius,
    glow,
    surfaceOpacity,
    chamfer,
    borderColor,
    glowColor: base.glow > 0 ? base.glowColor : withAlpha(accent, 0.45),
    isDefault: base.isDefault && untouched,
  };
}

/** Fundo com opacidade (`rgba`) a partir da cor `#rrggbb` do estilo. */
export function surfaceColor(style: NotchStyle): string {
  return style.surfaceOpacity >= 1 ? style.surface : withAlpha(style.surface, style.surfaceOpacity);
}

/** `clip-path` com os dois cantos de baixo cortados (`cut` em px). */
export function chamferClipPath(cut: number): string {
  const c = Math.max(0, Math.round(cut));
  return `polygon(0 0, 100% 0, 100% calc(100% - ${c}px), calc(100% - ${c}px) 100%, ${c}px 100%, 0 calc(100% - ${c}px))`;
}

/** Camadas de sombra do notch (anel da borda + brilho + sombras de profundidade), sempre 4 para a mola interpolar. */
export function notchBoxShadow(style: NotchStyle, expanded: boolean): string {
  const ring = style.borderColor && !style.chamfer ? `0 0 0 1px ${style.borderColor}` : "0 0 0 0 transparent";
  const glow = style.glow > 0 ? `0 0 ${Math.round(6 + style.glow * 18)}px ${style.glowColor}` : "0 0 0 0 transparent";
  const depth1 = expanded ? "0 14px 34px rgba(0,0,0,0.38)" : "0 4px 14px rgba(0,0,0,0.22)";
  const depth2 = expanded ? "0 2px 8px rgba(0,0,0,0.3)" : "0 0 0 0 rgba(0,0,0,0)";
  return [ring, glow, depth1, depth2].join(", ");
}
