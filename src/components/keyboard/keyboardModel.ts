/**
 * Modelo do teclado virtual do controle: o desenho das teclas e as regras de digitação, sem React.
 * O formato segue o teclado do Steam Deck: o símbolo de cima aparece pequeno acima do principal,
 * teclas de ação (Backspace, Buscar, Shift...) são mais largas e mostram o botão do controle.
 */

export type KeyAction =
  | "backspace"
  | "tab"
  | "caps"
  | "shift"
  | "submit"
  | "emoji"
  | "accents"
  | "space"
  | "caretLeft"
  | "caretRight"
  | "paste"
  | "hide";

export interface CharKeyDef {
  kind: "char";
  id: string;
  base: string;
  /** Símbolo com Shift (letras ficam em maiúscula sozinhas). */
  shifted?: string;
  /** Largura em colunas de uma grade de 60 (1 tecla comum = 4). */
  span: number;
}

export interface ActionKeyDef {
  kind: "action";
  id: string;
  action: KeyAction;
  span: number;
}

export type KeyDef = CharKeyDef | ActionKeyDef;

const char = (base: string, shifted?: string, span = 4): CharKeyDef => ({
  kind: "char",
  id: `char:${base}`,
  base,
  shifted,
  span,
});

const action = (act: KeyAction, span: number, id: string = act): ActionKeyDef => ({
  kind: "action",
  id: `action:${id}`,
  action: act,
  span,
});

const row = (keys: string[], shiftedKeys: string[] = []): CharKeyDef[] =>
  keys.map((key, index) => char(key, shiftedKeys[index]));

const noShift = (count: number): undefined[] => Array.from({ length: count }, () => undefined);

/** As cinco fileiras: cada uma soma 60 colunas, então todas têm a mesma largura. */
export const KEY_ROWS: KeyDef[][] = [
  [
    ...row(["`", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "="], ["~", "!", "@", "#", "$", "%", "^", "&", "*", "(", ")", "_", "+"]),
    action("backspace", 8),
  ],
  [
    action("tab", 6),
    ...row(["q", "w", "e", "r", "t", "y", "u", "i", "o", "p", "[", "]"], [...noShift(10), "{", "}"] as string[]),
    char("\\", "|", 6),
  ],
  [
    action("caps", 7),
    ...row(["a", "s", "d", "f", "g", "h", "j", "k", "l", ";", "'"], [...noShift(9), ":", '"'] as string[]),
    action("submit", 9),
  ],
  [
    action("shift", 9, "shiftLeft"),
    ...row(["z", "x", "c", "v", "b", "n", "m", ",", ".", "/"], [...noShift(7), "<", ">", "?"] as string[]),
    action("shift", 11, "shiftRight"),
  ],
  [
    action("emoji", 6),
    action("accents", 6),
    action("space", 24),
    action("caretLeft", 6),
    action("caretRight", 6),
    action("paste", 6),
    action("hide", 6),
  ],
];

/** Acentos do português, para quem digita nomes e mensagens sem teclado físico. */
export const ACCENT_KEYS = [
  "á", "à", "â", "ã", "ä",
  "é", "è", "ê", "ë", "í",
  "ì", "î", "ï", "ó", "ò",
  "ô", "õ", "ö", "ú", "ù",
  "û", "ü", "ç", "ñ", "ß",
] as const;

export const EMOJI_KEYS = [
  "😀", "😂", "😍", "😎", "🥳",
  "😅", "🤔", "😭", "😡", "😴",
  "👍", "👎", "👏", "🙏", "🤝",
  "❤️", "🔥", "💀", "🎮", "🏆",
  "🎉", "👀", "💪", "😈", "🤯",
] as const;

// ── Digitação ────────────────────────────────────────────────────────────────

export interface TextState {
  value: string;
  caret: number;
}

export interface ModifierState {
  shift: boolean;
  caps: boolean;
}

const isLetter = (value: string): boolean => value.length === 1 && value.toLowerCase() !== value.toUpperCase();

/** O que a tecla digita: letras seguem Shift e Caps; símbolos só o Shift. */
export function charOutput(key: CharKeyDef, { shift, caps }: ModifierState): string {
  if (isLetter(key.base)) return shift !== caps ? key.base.toUpperCase() : key.base;
  return shift && key.shifted ? key.shifted : key.base;
}

/** Acentos e emojis: Shift (ou Caps) deixa o acento em maiúscula; emoji não muda. */
export function extraOutput(value: string, { shift, caps }: ModifierState): string {
  return isLetter(value) && shift !== caps ? value.toUpperCase() : value;
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export function insertText(state: TextState, text: string, maxLength = -1): TextState {
  const caret = clamp(state.caret, 0, state.value.length);
  const room = maxLength >= 0 ? Math.max(0, maxLength - state.value.length) : Infinity;
  const inserted = Array.from(text).slice(0, room).join("");
  if (!inserted) return state;
  return {
    value: state.value.slice(0, caret) + inserted + state.value.slice(caret),
    caret: caret + inserted.length,
  };
}

export function backspace(state: TextState): TextState {
  const caret = clamp(state.caret, 0, state.value.length);
  if (caret === 0) return state;
  // apaga o caractere inteiro: um emoji ocupa duas unidades em UTF-16
  const before = state.value.slice(0, caret);
  const last = Array.from(before).pop() ?? "";
  const cut = caret - last.length;
  return { value: state.value.slice(0, cut) + state.value.slice(caret), caret: cut };
}

export function moveCaret(state: TextState, delta: number): TextState {
  const caret = clamp(state.caret + delta, 0, state.value.length);
  return caret === state.caret ? state : { ...state, caret };
}
