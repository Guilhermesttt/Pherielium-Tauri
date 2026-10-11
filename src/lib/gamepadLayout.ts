/**
 * Layout do controle "standard" da Web Gamepad API e o que dele se deduz.
 *
 * Tudo aqui é puro (sem DOM), para o visualizador e a lista de controles terem a
 * mesma verdade e para dar para testar sem controle plugado.
 *
 * O mapeamento "standard" é o mesmo para Xbox e PlayStation: o botão de índice 0
 * é o de baixo, e só o RÓTULO muda (A no Xbox, ✕ no PlayStation). Por isso o
 * rótulo vem de uma tabela por família, nunca de um `if` por controle.
 */
import type { GamepadFamily } from "../context/GamepadContext";

export type ButtonId =
  | "face_bottom" | "face_right" | "face_left" | "face_top"
  | "lb" | "rb" | "lt" | "rt"
  | "back" | "start" | "l3" | "r3"
  | "dpad_up" | "dpad_down" | "dpad_left" | "dpad_right"
  | "guide" | "touchpad";

interface ButtonSpec {
  /** Índice no array `buttons` do mapeamento standard. */
  index: number;
  id: ButtonId;
  labels: Record<GamepadFamily, string>;
}

/** Fonte única: índice standard → id → rótulo por família. */
export const STANDARD_BUTTONS: readonly ButtonSpec[] = [
  { index: 0, id: "face_bottom", labels: { xbox: "A", playstation: "✕", generic: "A" } },
  { index: 1, id: "face_right", labels: { xbox: "B", playstation: "○", generic: "B" } },
  { index: 2, id: "face_left", labels: { xbox: "X", playstation: "□", generic: "X" } },
  { index: 3, id: "face_top", labels: { xbox: "Y", playstation: "△", generic: "Y" } },
  { index: 4, id: "lb", labels: { xbox: "LB", playstation: "L1", generic: "L1" } },
  { index: 5, id: "rb", labels: { xbox: "RB", playstation: "R1", generic: "R1" } },
  { index: 6, id: "lt", labels: { xbox: "LT", playstation: "L2", generic: "L2" } },
  { index: 7, id: "rt", labels: { xbox: "RT", playstation: "R2", generic: "R2" } },
  { index: 8, id: "back", labels: { xbox: "View", playstation: "Share", generic: "Select" } },
  { index: 9, id: "start", labels: { xbox: "Menu", playstation: "Options", generic: "Start" } },
  { index: 10, id: "l3", labels: { xbox: "L3", playstation: "L3", generic: "L3" } },
  { index: 11, id: "r3", labels: { xbox: "R3", playstation: "R3", generic: "R3" } },
  { index: 12, id: "dpad_up", labels: { xbox: "↑", playstation: "↑", generic: "↑" } },
  { index: 13, id: "dpad_down", labels: { xbox: "↓", playstation: "↓", generic: "↓" } },
  { index: 14, id: "dpad_left", labels: { xbox: "←", playstation: "←", generic: "←" } },
  { index: 15, id: "dpad_right", labels: { xbox: "→", playstation: "→", generic: "→" } },
  { index: 16, id: "guide", labels: { xbox: "Guide", playstation: "PS", generic: "Guide" } },
  // Só o DualShock/DualSense expõem o touchpad como botão; nos outros nem existe.
  { index: 17, id: "touchpad", labels: { xbox: "Touchpad", playstation: "Touchpad", generic: "Touchpad" } },
];

const BY_INDEX = new Map(STANDARD_BUTTONS.map((b) => [b.index, b]));

export const buttonLabel = (index: number, family: GamepadFamily): string =>
  BY_INDEX.get(index)?.labels[family] ?? `Botão ${index}`;

export const buttonIdOf = (index: number): ButtonId | null => BY_INDEX.get(index)?.id ?? null;

/** Limiar a partir do qual um gatilho analógico conta como "apertado". */
export const PRESS_THRESHOLD = 0.5;

export interface ButtonSample {
  pressed: boolean;
  value: number;
}

export interface PressedButton {
  index: number;
  id: ButtonId | null;
  label: string;
  /** 0..1; só interessa para os gatilhos analógicos. */
  value: number;
}

/** Quais botões estão apertados agora, na ordem do índice. */
export function pressedButtons(
  buttons: ReadonlyArray<ButtonSample>,
  family: GamepadFamily,
): PressedButton[] {
  const out: PressedButton[] = [];
  buttons.forEach((b, index) => {
    if (!b) return;
    if (b.pressed || b.value >= PRESS_THRESHOLD) {
      out.push({ index, id: buttonIdOf(index), label: buttonLabel(index, family), value: b.value });
    }
  });
  return out;
}

/** "✕ + R2 (62%)" — texto do que está sendo apertado. Vazio se nada. */
export function describePressed(pressed: ReadonlyArray<PressedButton>): string {
  return pressed
    .map((p) => (p.id === "lt" || p.id === "rt" ? `${p.label} (${Math.round(p.value * 100)}%)` : p.label))
    .join(" + ");
}

// ── Eixos ───────────────────────────────────────────────────────────────────

export interface StickPoint {
  x: number;
  y: number;
  /** Distância do centro, 0..1. */
  magnitude: number;
}

/**
 * Posição do stick limitada ao círculo unitário. Muitos controles têm os eixos
 * quadrados (a diagonal chega a ~1,41), o que faria o ponto sair do desenho.
 */
export function stickPoint(x: number, y: number): StickPoint {
  const sx = Number.isFinite(x) ? x : 0;
  const sy = Number.isFinite(y) ? y : 0;
  const mag = Math.hypot(sx, sy);
  if (mag <= 1) return { x: sx, y: sy, magnitude: mag };
  return { x: sx / mag, y: sy / mag, magnitude: 1 };
}

// ── Identificação do dispositivo ────────────────────────────────────────────

export type ControllerKind = "dualshock4" | "dualsense" | "xbox" | "switch" | "generic";

export interface DeviceInfo {
  vendor: string | null;
  product: string | null;
  kind: ControllerKind;
  /** Nome sem o sufixo técnico do navegador. */
  name: string;
  /** "standard" quando o navegador já normalizou o mapeamento. */
  standardMapping: boolean;
}

/** VID:PID conhecidos. Tabela, não cadeia de `if`. */
const KNOWN_DEVICES: ReadonlyArray<{ vendor: string; products: readonly string[] | "*"; kind: ControllerKind }> = [
  { vendor: "054c", products: ["05c4", "09cc"], kind: "dualshock4" },
  { vendor: "054c", products: ["0ce6", "0df2"], kind: "dualsense" },
  { vendor: "045e", products: "*", kind: "xbox" },
  { vendor: "057e", products: "*", kind: "switch" },
];

export const KIND_LABEL: Record<ControllerKind, string> = {
  dualshock4: "DualShock 4",
  dualsense: "DualSense",
  xbox: "Xbox",
  switch: "Nintendo Switch",
  generic: "Controle genérico",
};

/**
 * `id` do Chromium/WebView2 costuma vir como
 * "Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 09cc)" ou
 * "Xbox 360 Controller (XInput STANDARD GAMEPAD)".
 */
export function parseGamepadId(id: string): DeviceInfo {
  const vendor = /vendor:\s*([0-9a-f]{4})/i.exec(id)?.[1]?.toLowerCase() ?? null;
  const product = /product:\s*([0-9a-f]{4})/i.exec(id)?.[1]?.toLowerCase() ?? null;
  const name = id.replace(/\s*\([^)]*\)\s*$/, "").trim() || "Controle";

  const known = KNOWN_DEVICES.find(
    (d) =>
      d.vendor === vendor &&
      (d.products === "*" || (product !== null && d.products.includes(product))),
  );
  // Sem VID/PID (XInput não os informa), o nome ainda diz se é Xbox.
  const byName: ControllerKind = /xbox|xinput/i.test(id) ? "xbox" : "generic";

  return {
    vendor,
    product,
    kind: known?.kind ?? byName,
    name,
    standardMapping: /standard/i.test(id),
  };
}
