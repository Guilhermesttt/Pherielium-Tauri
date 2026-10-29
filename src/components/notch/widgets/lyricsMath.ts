export interface LyricLine {
  timeMs: number;
  text: string;
}

/** O que o backend devolve: linhas com tempo (se houver) e/ou a letra corrida. */
export interface Lyrics {
  synced: LyricLine[];
  plain: string | null;
}

/**
 * Índice da linha em curso para a posição da música, ou -1 antes da primeira linha.
 * `offsetMs` adianta a letra (a leitura do player chega com um pequeno atraso).
 */
export function activeLineIndex(lines: LyricLine[], positionMs: number, offsetMs = 250): number {
  const target = positionMs + offsetMs;
  let low = 0;
  let high = lines.length - 1;
  let found = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (lines[mid].timeMs <= target) {
      found = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return found;
}
