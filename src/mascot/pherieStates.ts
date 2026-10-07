import { EXPRESSION_BY_ID, type BotExpression } from "./engine/expressions";
import type { EyeCfg, StateId } from "./engine/states";
import { MASCOT_MOODS, type MascotMood } from "./moods";

/**
 * Tabela dos 24 humores da Pherie → estado/expressão do engine (bloub) + camadas
 * próprias (boca, bochechas, extras, balanço). É aqui que a Pherie deixa de ser o
 * bot do bloub: expressões extras (`gamer`, `listen`, `muted`, `annoyed`) e
 * acessórios (fone, orelhas) não existem no engine original.
 */

export type MouthKind = "smile" | "grin" | "o" | "frown" | "flat" | "smirk" | "small";
export type BounceKind = "gentle" | "bouncy" | "tremble" | "sway" | "wobble";
export type MascotExtra = "sweat" | "tear" | "anger" | "question" | "thought" | "dizzy";

export interface MoodSpec {
  state: StateId;
  /** id em EXPRESSION_BY_ID (bloub) ou PHERIE_EXPRESSIONS; só vale p/ o estado `idle`. */
  expression: string | null;
  mouth: MouthKind;
  /** opacidade das bochechas 0..1 */
  blush: number;
  bounce: BounceKind;
  extras?: MascotExtra[];
  /** inclinação da cabeça em graus */
  tilt?: number;
  /** fone sempre visível neste humor (também aparece com `inCall`/música) */
  headphones?: boolean;
}

const eye = (w: number, h: number, tilt = 0, open = 1): EyeCfg => ({ w, h, tilt, open });
const pair = (w: number, h: number, tilt = 0, open = 1): [EyeCfg, EyeCfg] => [
  eye(w, h, tilt, open),
  eye(w, h, -tilt, open),
];

/** Expressões que só existem na Pherie (o engine só usa os campos, o `id` é livre). */
export const PHERIE_EXPRESSIONS: Record<string, BotExpression> = {
  // foco de jogador: olhos um pouco mais estreitos e firmes
  gamer: {
    id: "gamer",
    gaze: { yaw: 6, pitch: 2, roll: 0 },
    split: 16,
    eyes: [eye(0.24, 0.3, 8), eye(0.24, 0.3, -8)],
  },
  // ouvindo na chamada: olhos grandes, cabeça levemente inclinada
  listen: {
    id: "listen",
    gaze: { yaw: 2, pitch: 3, roll: -3 },
    split: 16.5,
    eyes: pair(0.22, 0.46),
  },
  // microfone mutado: olhos serenos, boca reta
  muted: {
    id: "muted",
    gaze: { yaw: 3, pitch: 2, roll: 0 },
    split: 16,
    eyes: pair(0.2, 0.34),
  },
  // irritado de leve (clique no mascote): versão curta da `colere`
  annoyed: {
    id: "annoyed",
    gaze: { yaw: 3, pitch: 5, roll: 0 },
    split: 17,
    eyes: pair(0.3, 0.2, 18),
  },
  // pensando: olhar para o alto, um olho levemente mais aberto
  thinking: {
    id: "thinking",
    gaze: { yaw: 10, pitch: 26, roll: 4 },
    split: 16,
    eyes: [eye(0.2, 0.4), eye(0.22, 0.34)],
  },
  // dormindo: olhos quase fechados (o estado `sleep` do bloub não tem rosto)
  sleeping: {
    id: "sleeping",
    gaze: { yaw: 2, pitch: -6, roll: 0 },
    split: 16.5,
    eyes: pair(0.26, 0.4, 0, 0.08),
  },
  // tonto: olhos grandes e redondos + estrelas girando (extra "dizzy")
  dizzy: {
    id: "dizzy",
    gaze: { yaw: 0, pitch: 0, roll: 0 },
    split: 17,
    eyes: pair(0.34, 0.34),
  },
} as unknown as Record<string, BotExpression>;

export const MOOD_SPECS: Record<MascotMood, MoodSpec> = {
  idle: { state: "idle", expression: "neutre", mouth: "smile", blush: 0.25, bounce: "gentle" },
  sleeping: { state: "idle", expression: "sleeping", mouth: "small", blush: 0.2, bounce: "gentle" },
  music: { state: "idle", expression: "heureux", mouth: "smile", blush: 0.35, bounce: "bouncy", headphones: true },
  calling: { state: "idle", expression: "listen", mouth: "smile", blush: 0.3, bounce: "gentle", headphones: true },
  muted: { state: "idle", expression: "muted", mouth: "flat", blush: 0.2, bounce: "gentle", headphones: true },
  gaming: { state: "idle", expression: "gamer", mouth: "smirk", blush: 0.2, bounce: "gentle", headphones: true },
  happy: { state: "idle", expression: "heureux", mouth: "grin", blush: 0.45, bounce: "bouncy" },
  surprised: { state: "idle", expression: "surpris", mouth: "o", blush: 0.2, bounce: "bouncy" },
  excited: { state: "idle", expression: "excite", mouth: "grin", blush: 0.55, bounce: "bouncy" },
  angry: { state: "idle", expression: "colere", mouth: "frown", blush: 0.1, bounce: "tremble", extras: ["anger"] },
  sad: { state: "idle", expression: "triste", mouth: "frown", blush: 0.2, bounce: "gentle", extras: ["tear"] },
  scared: { state: "idle", expression: "effraye", mouth: "o", blush: 0.15, bounce: "tremble", extras: ["sweat"] },
  suspicious: { state: "idle", expression: "mefiant", mouth: "smirk", blush: 0.15, bounce: "gentle", tilt: -5 },
  confused: { state: "idle", expression: "confus", mouth: "flat", blush: 0.2, bounce: "sway", extras: ["question"], tilt: 6 },
  curious: { state: "idle", expression: "curieux", mouth: "small", blush: 0.3, bounce: "gentle", tilt: -9 },
  proud: { state: "idle", expression: "fier", mouth: "smirk", blush: 0.3, bounce: "gentle" },
  shy: { state: "idle", expression: "timide", mouth: "small", blush: 0.85, bounce: "gentle" },
  bored: { state: "idle", expression: "blase", mouth: "flat", blush: 0.1, bounce: "gentle" },
  drowsy: { state: "idle", expression: "somnolent", mouth: "small", blush: 0.2, bounce: "sway" },
  attentive: { state: "idle", expression: "attentif", mouth: "smile", blush: 0.25, bounce: "gentle" },
  wink: { state: "wink", expression: null, mouth: "grin", blush: 0.4, bounce: "gentle" },
  thinking: { state: "idle", expression: "thinking", mouth: "flat", blush: 0.2, bounce: "sway", tilt: 5, extras: ["thought"] },
  annoyed: { state: "idle", expression: "annoyed", mouth: "flat", blush: 0.15, bounce: "gentle" },
  dizzy: { state: "idle", expression: "dizzy", mouth: "o", blush: 0.2, bounce: "wobble", extras: ["dizzy"] },
};

/** Resolve o id de expressão (bloub ou Pherie) para o objeto que o engine consome. */
export function resolveExpression(id: string | null): BotExpression | null {
  if (!id) return null;
  return PHERIE_EXPRESSIONS[id] ?? EXPRESSION_BY_ID.get(id) ?? null;
}

/** Todo humor listado nas configs precisa ter especificação (garantido em teste). */
export function allMoodIds(): MascotMood[] {
  return MASCOT_MOODS.map((m) => m.id);
}
