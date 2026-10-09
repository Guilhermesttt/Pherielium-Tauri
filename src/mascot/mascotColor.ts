import { mixHex } from "./engine/skins";

/**
 * Cor do corpo da Pherie → paleta completa (gradiente, aro, orelhas, fone, rosto).
 * Tudo puro: o `MascotView` só consome o resultado. O rosto (olhos/boca) é
 * escolhido por contraste, então qualquer cor do seletor continua legível.
 */

/** Valor legado do antigo seletor (padrão "branco") = nenhuma cor escolhida. */
export const LEGACY_DEFAULT_MASCOT_COLOR = "#ffffff";

/** Aceita `#rgb`, `#rrggbb`, `#rrggbbaa` (com ou sem `#`); devolve `#rrggbb` minúsculo ou `fallback`. */
export function normalizeHex<T extends string | null>(input: unknown, fallback: T): string | T {
  if (typeof input !== "string") return fallback;
  let h = input.trim().toLowerCase();
  if (h.startsWith("#")) h = h.slice(1);
  if (!/^[0-9a-f]+$/.test(h)) return fallback;
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  else if (h.length === 8) h = h.slice(0, 6);
  if (h.length !== 6) return fallback;
  return `#${h}`;
}

/**
 * Converte o valor guardado nas preferências em cor de corpo. `null` = visual
 * padrão (escuro). O branco legado também vale como "padrão", para quem nunca
 * escolheu cor não passar a ter um mascote branco.
 */
export function resolveBodyColor(stored: unknown): string | null {
  const hex = normalizeHex(stored, null);
  if (!hex || hex === LEGACY_DEFAULT_MASCOT_COLOR) return null;
  return hex;
}

const channel = (v: number) => {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};

/** Luminância relativa WCAG (0 = preto, 1 = branco). */
export function luminance(hex: string): number {
  const h = normalizeHex(hex, "#000000");
  const v = parseInt(h.slice(1), 16);
  const r = (v >> 16) & 255;
  const g = (v >> 8) & 255;
  const b = v & 255;
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function withAlpha(hex: string, alpha: number): string {
  const h = normalizeHex(hex, "#000000");
  const v = parseInt(h.slice(1), 16);
  return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${alpha})`;
}

export interface BodyPalette {
  /** extremos do gradiente vertical do corpo */
  top: string;
  bottom: string;
  /** contorno do corpo */
  rim: string;
  ear: string;
  earStroke: string;
  /** olhos e boca */
  face: string;
  /** haste do microfone e anéis do "tonto" */
  accent: string;
  headphoneBand: string;
  headphoneCup: string;
  headphoneStroke: string;
  cheek: string;
  /** multiplicador da opacidade das bochechas (corpos rosados escondem as bochechas) */
  cheekScale: number;
  /** corpo claro? (decide rosto escuro e fone escuro) */
  light: boolean;
}

/** O visual padrão da Pherie: o planeta branco do logo, com rosto preto. */
export const DEFAULT_PALETTE: BodyPalette = {
  top: "#ffffff",
  bottom: "#e8e8ee",
  rim: "rgba(20,20,26,0.22)",
  ear: "#f2f2f6",
  earStroke: "#bdbdc6",
  face: "#0b0b0f",
  accent: "#0b0b0f",
  headphoneBand: "#2b2b31",
  headphoneCup: "#3a3a42",
  headphoneStroke: "#d9d9de",
  cheek: "rgb(255,140,160)",
  cheekScale: 1,
  light: true,
};

/** Cor mais escura que isso some no preto do notch (#050506): o corpo nunca desce abaixo. */
const MIN_TOP = "#34343a";
const MIN_BOTTOM = "#16161a";
const MIN_EAR = "#1e1e22";
const LIGHT_BODY_LUMINANCE = 0.45;

const atLeast = (hex: string, floor: string) => (luminance(hex) < luminance(floor) ? floor : hex);

export function deriveBodyPalette(input: string | null | undefined): BodyPalette {
  const body = normalizeHex(input, null);
  if (!body) return DEFAULT_PALETTE;

  const light = luminance(body) > LIGHT_BODY_LUMINANCE;
  const top = atLeast(mixHex(body, "#ffffff", 0.14), MIN_TOP);
  const bottom = atLeast(mixHex(body, "#000000", 0.3), MIN_BOTTOM);
  const ear = atLeast(mixHex(body, "#000000", 0.45), MIN_EAR);

  const r = parseInt(body.slice(1, 3), 16);
  const g = parseInt(body.slice(3, 5), 16);
  const b = parseInt(body.slice(5, 7), 16);
  const reddish = r > g + 60 && r > b;

  const face = light ? "#26262c" : "#ffffff";
  return {
    top,
    bottom,
    // corpo escuro: aro branco sutil; corpo claro: aro escuro, senão some no fundo
    rim: light ? withAlpha(mixHex(body, "#000000", 0.4), 0.55) : "rgba(255,255,255,0.16)",
    ear,
    earStroke: mixHex(ear, "#ffffff", 0.18),
    face,
    accent: face,
    headphoneBand: light ? "#2b2b31" : "#d9d9de",
    headphoneCup: light ? "#3a3a42" : "#eeeeee",
    headphoneStroke: light ? "#d9d9de" : "#1a1a1e",
    cheek: "rgb(255,140,160)",
    cheekScale: reddish ? 0.45 : 1,
    light,
  };
}

/**
 * Cor do mascote gravada pelo seletor ANTIGO do launcher
 * (`checkpoint_mascot_color_<uid>`). Só serve de origem da migração para a nova
 * configuração do notch; o overlay não tem uid/provider, então lê do localStorage
 * (mesma origem do launcher).
 */
export function readLegacyMascotColor(): string | null {
  try {
    const session = localStorage.getItem("phelierium_auth_session");
    const uid = session ? (JSON.parse(session)?.uid as string | undefined) : undefined;
    if (!uid) return null;
    return localStorage.getItem(`checkpoint_mascot_color_${uid}`) || null;
  } catch {
    return null;
  }
}
