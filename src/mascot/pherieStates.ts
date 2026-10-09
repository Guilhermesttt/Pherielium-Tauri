import { MASCOT_MOODS, type MascotMood } from "./moods";

/**
 * Camadas de cada um dos 24 humores da Pherie que não são o rosto: boca, bochechas,
 * extras, balanço do corpo, inclinação e fone. A forma dos olhos fica em `pherie/face.ts`.
 */

export type MouthKind = "smile" | "grin" | "o" | "frown" | "flat" | "smirk" | "small";
export type BounceKind = "gentle" | "bouncy" | "tremble" | "sway" | "wobble";
export type MascotExtra = "sweat" | "tear" | "anger" | "question" | "thought" | "dizzy";

export interface MoodSpec {
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

export const MOOD_SPECS: Record<MascotMood, MoodSpec> = {
  idle: { mouth: "smile", blush: 0.25, bounce: "gentle" },
  sleeping: { mouth: "small", blush: 0.2, bounce: "gentle" },
  music: { mouth: "smile", blush: 0.35, bounce: "bouncy", headphones: true },
  calling: { mouth: "smile", blush: 0.3, bounce: "gentle", headphones: true },
  muted: { mouth: "flat", blush: 0.2, bounce: "gentle", headphones: true },
  gaming: { mouth: "smirk", blush: 0.2, bounce: "gentle", headphones: true },
  happy: { mouth: "grin", blush: 0.45, bounce: "bouncy" },
  surprised: { mouth: "o", blush: 0.2, bounce: "bouncy" },
  excited: { mouth: "grin", blush: 0.55, bounce: "bouncy" },
  angry: { mouth: "frown", blush: 0.1, bounce: "tremble", extras: ["anger"] },
  sad: { mouth: "frown", blush: 0.2, bounce: "gentle", extras: ["tear"] },
  scared: { mouth: "o", blush: 0.15, bounce: "tremble", extras: ["sweat"] },
  suspicious: { mouth: "smirk", blush: 0.15, bounce: "gentle", tilt: -5 },
  confused: { mouth: "flat", blush: 0.2, bounce: "sway", extras: ["question"], tilt: 6 },
  curious: { mouth: "small", blush: 0.3, bounce: "gentle", tilt: -9 },
  proud: { mouth: "smirk", blush: 0.3, bounce: "gentle" },
  shy: { mouth: "small", blush: 0.85, bounce: "gentle" },
  bored: { mouth: "flat", blush: 0.1, bounce: "gentle" },
  drowsy: { mouth: "small", blush: 0.2, bounce: "sway" },
  attentive: { mouth: "smile", blush: 0.25, bounce: "gentle" },
  wink: { mouth: "grin", blush: 0.4, bounce: "gentle" },
  thinking: { mouth: "flat", blush: 0.2, bounce: "sway", tilt: 5, extras: ["thought"] },
  annoyed: { mouth: "flat", blush: 0.15, bounce: "gentle" },
  dizzy: { mouth: "o", blush: 0.2, bounce: "wobble", extras: ["dizzy"] },
};

/** Todo humor listado nas configs precisa ter especificação (garantido em teste). */
export function allMoodIds(): MascotMood[] {
  return MASCOT_MOODS.map((m) => m.id);
}
