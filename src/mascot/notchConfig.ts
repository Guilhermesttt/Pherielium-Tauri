import { SHAPES } from "./engine/skins";
import { normalizeHex, resolveBodyColor } from "./mascotColor";

/**
 * Configuração do notch (barra no topo do overlay) e do mascote Pherie.
 * Vive em `overlay-prefs.json` (objeto `notch`) porque o overlay é outra janela,
 * sem `PreferencesProvider`/uid; assim vale antes do login, entre reinícios e é
 * empurrada ao vivo pelo evento `overlay:prefs`.
 */
export interface NotchConfig {
  /** Desliga o notch por completo (toasts e atalho do overlay continuam). */
  enabled: boolean;
  /** Esconde o notch quando outro app está em primeiro plano (nunca em chamada/jogo). */
  autoHide: boolean;
  expandOnHover: boolean;
  showClock: boolean;
  showMedia: boolean;
  showBubbleTips: boolean;
  /** Sons de interação do notch (abrir/fechar, play/pause, cutucar a Pherie...). */
  sounds: boolean;
  showMascot: boolean;
  /** Olhos e cabeça seguem o cursor. */
  followCursor: boolean;
  /** `#rrggbb` ou `null` (= grafite padrão). */
  bodyColor: string | null;
  /** Id de forma do bloub. */
  shape: string;
  /** Chapéu do mascote. */
  hat: HatId;
  /** Itens vestidos (óculos, halo, fones RGB). */
  items: ItemId[];
  /** Estilo do balão de fala. */
  bubbleStyle: BubbleStyle;
  /** Notch em jogo: linha de 4px (hover abre o HUD), compacto ou desligado. */
  gameHud: GameHudMode;
  /** Usa o estilo do tema visual do launcher (cyberpunk, ps5...). Desligado = estilo padrão. */
  useThemeStyle: boolean;
  /** Raio dos cantos em px, ou `null` = o do tema. */
  cornerRadius: number | null;
  /** Intensidade do brilho da borda 0..1, ou `null` = o do tema. */
  glowIntensity: number | null;
  /** Opacidade do fundo 0.5..1, ou `null` = a do tema. */
  backgroundOpacity: number | null;
  /** Cantos chanfrados (cortados), ou `null` = o do tema. */
  chamfer: boolean | null;
}

export type HatId = "none" | "witch" | "party" | "crown" | "beanie" | "top";
export type ItemId = "sunglasses" | "halo" | "rgbHeadphones";
export type BubbleStyle = "retro" | "soft";
export type GameHudMode = "line" | "compact" | "off";

export const HAT_OPTIONS: { id: HatId; label: string }[] = [
  { id: "none", label: "Sem chapéu" },
  { id: "witch", label: "Bruxa" },
  { id: "party", label: "Festa" },
  { id: "crown", label: "Coroa" },
  { id: "beanie", label: "Gorro" },
  { id: "top", label: "Cartola" },
];

export const ITEM_OPTIONS: { id: ItemId; label: string }[] = [
  { id: "sunglasses", label: "Óculos escuros" },
  { id: "halo", label: "Halo neon" },
  { id: "rgbHeadphones", label: "Fones RGB" },
];

/** Limites dos controles deslizantes. */
export const CORNER_RADIUS_RANGE = { min: 0, max: 28 } as const;
export const BACKGROUND_OPACITY_RANGE = { min: 0.5, max: 1 } as const;

export const DEFAULT_NOTCH_SHAPE = "squircle";

export const DEFAULT_NOTCH_CONFIG: NotchConfig = {
  enabled: true,
  autoHide: true,
  expandOnHover: true,
  showClock: true,
  showMedia: true,
  showBubbleTips: true,
  sounds: true,
  showMascot: true,
  followCursor: true,
  bodyColor: null,
  shape: DEFAULT_NOTCH_SHAPE,
  hat: "none",
  items: [],
  bubbleStyle: "soft",
  gameHud: "line",
  useThemeStyle: true,
  cornerRadius: null,
  glowIntensity: null,
  backgroundOpacity: null,
  chamfer: null,
};

/** Formas disponíveis, com rótulo em pt-BR (os ids vêm do bloub, em francês). */
export const NOTCH_SHAPES: { id: string; label: string }[] = [
  { id: "squircle", label: "Quadrado suave" },
  { id: "cercle", label: "Círculo" },
  { id: "galet", label: "Pedra" },
  { id: "capsule", label: "Cápsula" },
  { id: "hexagone", label: "Hexágono" },
  { id: "nuage", label: "Nuvem" },
  { id: "goutte", label: "Gota" },
  { id: "triangle", label: "Triângulo" },
];

/** Cores de corpo prontas (as do bloub) com rótulo pt-BR. `null` = padrão. */
export const NOTCH_BODY_PRESETS: { hex: string | null; label: string }[] = [
  { hex: null, label: "Padrão" },
  { hex: "#e8483f", label: "Vermelho" },
  { hex: "#f08a24", label: "Laranja" },
  { hex: "#f0b429", label: "Âmbar" },
  { hex: "#3ecf8e", label: "Verde" },
  { hex: "#2fbfa0", label: "Turquesa" },
  { hex: "#3b93f0", label: "Azul" },
  { hex: "#8b5cf6", label: "Violeta" },
  { hex: "#e152b0", label: "Rosa" },
  { hex: "#8b5e3c", label: "Marrom" },
  { hex: "#a3a3a3", label: "Cinza" },
  { hex: "#f1efe9", label: "Creme" },
];

const VALID_SHAPES = new Set<string>(SHAPES.map((s) => s.id));

const bool = (value: unknown, fallback: boolean) => (typeof value === "boolean" ? value : fallback);

const VALID_HATS = new Set<string>(HAT_OPTIONS.map((e) => e.id));
const VALID_ITEMS = new Set<string>(ITEM_OPTIONS.map((i) => i.id));

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** `null` = "usar o do tema"; número fora da faixa é limitado; qualquer outra coisa herda `fallback`. */
function nullableNumber(value: unknown, fallback: number | null, min: number, max: number): number | null {
  if (value === null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return clamp(value, min, max);
  return fallback;
}

function sanitizeItems(value: unknown, fallback: ItemId[]): ItemId[] {
  if (!Array.isArray(value)) return fallback;
  const seen = new Set<string>();
  const out: ItemId[] = [];
  for (const item of value) {
    if (typeof item === "string" && VALID_ITEMS.has(item) && !seen.has(item)) {
      seen.add(item);
      out.push(item as ItemId);
    }
  }
  return out;
}

/** Valida/normaliza qualquer coisa vinda do disco ou do evento; campos inválidos voltam ao padrão. */
export function sanitizeNotchConfig(raw: unknown, base: NotchConfig = DEFAULT_NOTCH_CONFIG): NotchConfig {
  const v = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const shape = typeof v.shape === "string" && VALID_SHAPES.has(v.shape) ? v.shape : base.shape;
  return {
    enabled: bool(v.enabled, base.enabled),
    autoHide: bool(v.autoHide, base.autoHide),
    expandOnHover: bool(v.expandOnHover, base.expandOnHover),
    showClock: bool(v.showClock, base.showClock),
    showMedia: bool(v.showMedia, base.showMedia),
    showBubbleTips: bool(v.showBubbleTips, base.showBubbleTips),
    sounds: bool(v.sounds, base.sounds),
    showMascot: bool(v.showMascot, base.showMascot),
    followCursor: bool(v.followCursor, base.followCursor),
    // null é um valor válido ("padrão"); só strings inválidas caem no fallback
    bodyColor: "bodyColor" in v ? normalizeHex(v.bodyColor, null) : base.bodyColor,
    shape,
    // `ears` (orelhas) foi aposentado: quem tinha orelhas fica sem chapéu
    hat: typeof v.hat === "string" && VALID_HATS.has(v.hat) ? (v.hat as HatId) : base.hat,
    items: sanitizeItems(v.items, base.items),
    bubbleStyle: v.bubbleStyle === "retro" || v.bubbleStyle === "soft" ? v.bubbleStyle : base.bubbleStyle,
    gameHud: v.gameHud === "line" || v.gameHud === "compact" || v.gameHud === "off" ? v.gameHud : base.gameHud,
    useThemeStyle: bool(v.useThemeStyle, base.useThemeStyle),
    cornerRadius: nullableNumber(v.cornerRadius, base.cornerRadius, CORNER_RADIUS_RANGE.min, CORNER_RADIUS_RANGE.max),
    glowIntensity: nullableNumber(v.glowIntensity, base.glowIntensity, 0, 1),
    backgroundOpacity: nullableNumber(
      v.backgroundOpacity,
      base.backgroundOpacity,
      BACKGROUND_OPACITY_RANGE.min,
      BACKGROUND_OPACITY_RANGE.max,
    ),
    chamfer: v.chamfer === null ? null : typeof v.chamfer === "boolean" ? v.chamfer : base.chamfer,
  };
}

/**
 * Configuração efetiva: a gravada em `overlay-prefs.json` ou, para quem nunca
 * abriu a nova aba, o padrão com a cor do corpo migrada da preferência legada
 * (`checkpoint_mascot_color_<uid>`), para ninguém perder a cor que já escolheu.
 */
export function effectiveNotchConfig(stored: unknown, legacyMascotColor: unknown): NotchConfig {
  if (stored && typeof stored === "object") return sanitizeNotchConfig(stored);
  return { ...DEFAULT_NOTCH_CONFIG, bodyColor: resolveBodyColor(legacyMascotColor) };
}

export function notchConfigsEqual(a: NotchConfig, b: NotchConfig): boolean {
  return (Object.keys(a) as (keyof NotchConfig)[]).every((k) => {
    const x = a[k];
    const y = b[k];
    if (Array.isArray(x) && Array.isArray(y)) return x.length === y.length && x.every((item, i) => item === y[i]);
    return x === y;
  });
}
