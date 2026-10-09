import type { MascotMood } from "../moods";

/** Formas de olho da Pherie (vocabulário do Coucou: cada emoção tem a sua forma). */
export type EyeShape = "pill" | "wide" | "dot" | "happy" | "closed" | "tired" | "spiral" | "star";

export interface EyeSpec {
  shape: EyeShape;
  /** largura/altura em unidades do corpo (raio do corpo = 100) */
  w: number;
  h: number;
  /** pálpebra inclinada em graus: positivo = ponta interna baixa (bravo), negativo = triste */
  lid: number;
}

export interface FaceSpec {
  left: EyeSpec;
  right: EyeSpec;
  /** olhar padrão do humor (-1..1), somado ao cursor */
  gazeX: number;
  gazeY: number;
}

const e = (shape: EyeShape, w: number, h: number, lid = 0): EyeSpec => ({ shape, w, h, lid });
const both = (spec: EyeSpec, gazeX = 0, gazeY = 0): FaceSpec => ({
  left: spec,
  right: { ...spec, lid: -spec.lid },
  gazeX,
  gazeY,
});

const PILL = e("pill", 38, 40);

/** Rosto de cada humor: a forma do olho já conta a emoção. */
export const FACES: Record<MascotMood, FaceSpec> = {
  idle: both(PILL),
  sleeping: both(e("closed", 30, 12)),
  music: both(e("happy", 32, 18)),
  calling: both(e("wide", 26, 50)),
  muted: both(e("pill", 20, 36)),
  gaming: both(e("pill", 24, 34, 10)),
  happy: both(e("happy", 34, 20)),
  surprised: both(e("wide", 46, 48)),
  excited: both(e("star", 44, 44)),
  angry: both(e("pill", 26, 36, 22)),
  sad: both(e("pill", 22, 40, -20), 0, 0.25),
  scared: both(e("dot", 14, 14)),
  suspicious: both(e("tired", 28, 22, 6), 0.4, 0),
  confused: { left: e("pill", 21, 48), right: e("pill", 21, 32), gazeX: 0, gazeY: 0 },
  curious: { left: e("pill", 34, 36), right: e("wide", 48, 50), gazeX: 0.3, gazeY: -0.2 },
  proud: both(e("happy", 34, 18)),
  shy: both(e("dot", 16, 16), -0.3, 0.3),
  bored: both(e("tired", 28, 24), 0, 0.1),
  drowsy: both(e("tired", 28, 18, -4), 0, 0.2),
  attentive: both(e("pill", 34, 44)),
  wink: { left: e("pill", 38, 40), right: e("happy", 38, 20), gazeX: 0, gazeY: 0 },
  thinking: { left: e("pill", 20, 42), right: e("pill", 22, 34), gazeX: 0.5, gazeY: -0.5 },
  annoyed: both(e("tired", 30, 22, 14)),
  dizzy: both(e("spiral", 36, 36)),
};

export function faceFor(mood: MascotMood): FaceSpec {
  return FACES[mood] ?? FACES.idle;
}
