import type { MouthKind } from "./pherieStates";

/**
 * Bocas da Pherie, em coordenadas locais: origem no centro da boca, largura total
 * = 1 (x de -0.5 a 0.5), y positivo para baixo. O componente aplica
 * translate/rotate/scale conforme a cabeça (ancorado nos olhos), então a boca
 * acompanha a orientação do rosto automaticamente.
 */
export interface MouthShape {
  d: string;
  /** true = preenchida (boca aberta); false = traço */
  fill: boolean;
  /** espessura do traço em unidades locais (ignorada quando `fill`) */
  stroke: number;
}

const SHAPES: Record<MouthKind, MouthShape> = {
  smile: { d: "M -0.2 -0.02 C -0.09 0.1 0.09 0.1 0.2 -0.02", fill: false, stroke: 0.07 },
  small: { d: "M -0.11 0 C -0.05 0.06 0.05 0.06 0.11 0", fill: false, stroke: 0.06 },
  grin: { d: "M -0.32 -0.06 C -0.17 0.3 0.17 0.3 0.32 -0.06", fill: false, stroke: 0.09 },
  flat: { d: "M -0.17 0 L 0.17 0", fill: false, stroke: 0.07 },
  frown: { d: "M -0.19 0.06 C -0.1 -0.1 0.1 -0.1 0.19 0.06", fill: false, stroke: 0.07 },
  smirk: { d: "M -0.19 0.03 C -0.05 0.09 0.12 0.03 0.21 -0.1", fill: false, stroke: 0.075 },
  o: { d: "M -0.09 0 a 0.09 0.12 0 1 0 0.18 0 a 0.09 0.12 0 1 0 -0.18 0 Z", fill: true, stroke: 0 },
};

/** Abaixo disso a Pherie é considerada em silêncio (boca volta ao humor). */
export const SPEECH_THRESHOLD = 0.06;

/**
 * Boca falando: elipse cuja abertura segue o volume (0..1). Largura cresce pouco
 * (vogais abertas ficam mais redondas), altura cresce bastante.
 */
export function talkingMouth(level: number): MouthShape {
  const l = Math.min(1, Math.max(0, level));
  const rx = 0.1 + 0.07 * l;
  const ry = 0.035 + 0.2 * l;
  return {
    d: `M ${-rx} 0 a ${rx} ${ry} 0 1 0 ${rx * 2} 0 a ${rx} ${ry} 0 1 0 ${-rx * 2} 0 Z`,
    fill: true,
    stroke: 0,
  };
}

/** Forma da boca: falando (volume acima do limiar) tem prioridade sobre o humor. */
export function mouthShape(kind: MouthKind, level: number): MouthShape {
  return level > SPEECH_THRESHOLD ? talkingMouth(level) : SHAPES[kind];
}

/**
 * Suavização attack/release do volume: sobe rápido (a boca abre na hora) e desce
 * devagar (não pisca entre sílabas). `dt` em segundos.
 */
export function smoothLevel(current: number, target: number, dt: number): number {
  const rate = target > current ? 28 : 9;
  const k = 1 - Math.exp(-rate * dt);
  return current + (target - current) * k;
}
