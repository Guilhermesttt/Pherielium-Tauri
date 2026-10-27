/**
 * Regras da lista em "roleta" (WheelListbox): a opção em foco fica em destaque e as vizinhas
 * ficam menores, apagadas e desfocadas conforme a distância, como na lista de palavras do vídeo
 * de referência. Puro (sem React) para poder ser testado.
 */

export interface RowVisual {
  opacity: number;
  /** desfoque em px */
  blur: number;
  scale: number;
  /** deslocamento horizontal em px: as vizinhas recuam um pouco, formando a curva da roleta */
  x: number;
}

/** Aparência de uma linha a `distance` linhas da que está em foco (0 = a própria). */
export function rowVisual(distance: number): RowVisual {
  const d = Math.min(Math.abs(distance), 4);
  return {
    opacity: d === 0 ? 1 : Math.max(0.14, 0.62 - (d - 1) * 0.2),
    blur: d === 0 ? 0 : Math.min(5, 1.2 + d * 1.1),
    scale: 1 - d * 0.045,
    x: d === 0 ? 0 : d * -3,
  };
}

/** Índice depois de andar `delta` linhas; para nas pontas em vez de dar a volta. */
export function moveFocus(index: number, delta: number, length: number): number {
  if (length <= 0) return 0;
  return Math.min(length - 1, Math.max(0, index + delta));
}

/** Quanto subir a coluna para a linha em foco ficar no centro da janela. */
export function columnOffset(focusIndex: number, rowHeight: number, viewportHeight: number): number {
  return viewportHeight / 2 - rowHeight / 2 - focusIndex * rowHeight;
}
