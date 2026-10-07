/**
 * Headbang da Pherie no ritmo da música (puro, testável). O backend manda `beat`
 * (batida dos graves) e o nível; aqui viram um envelope que sobe a 1 na batida e
 * decai rápido, e esse envelope vira inclinação/queda da cabeça.
 */
export interface AudioReactive {
  /** nível geral 0..1 */
  rms: number;
  low: number;
  mid: number;
  high: number;
  /** `performance.now()` da última batida (0 = nunca) */
  beatAt: number;
  /** `performance.now()` do último quadro recebido (0 = nunca) */
  lastAt: number;
}

export const EMPTY_AUDIO: AudioReactive = { rms: 0, low: 0, mid: 0, high: 0, beatAt: 0, lastAt: 0 };

/** Sem quadros por mais que isso = sem áudio ao vivo (o notch volta à animação padrão). */
export const AUDIO_STALE_MS = 450;
/** Taxa de decaimento do envelope da batida (1/s): ~140 ms para cair a ~37%. */
export const BEAT_DECAY_RATE = 7;

export function isAudioLive(audio: AudioReactive, now: number): boolean {
  return audio.lastAt > 0 && now - audio.lastAt < AUDIO_STALE_MS;
}

/** Envelope da batida: sobe a 1 quando há batida nova e decai exponencialmente. */
export function nextBeatEnvelope(env: number, dtSeconds: number, hasNewBeat: boolean): number {
  if (hasNewBeat) return 1;
  const decayed = env * Math.exp(-BEAT_DECAY_RATE * Math.max(0, dtSeconds));
  return decayed < 0.001 ? 0 : decayed;
}

export interface HeadbangPose {
  /** deslocamento vertical (unidades do viewBox do mascote, ~100 = raio do corpo) */
  y: number;
  /** inclinação em graus */
  rotate: number;
  /** escala */
  scale: number;
}

/**
 * Pose da cabeça: a batida "afunda" a cabeça e a inclina alternando o lado a cada batida;
 * o nível geral dá um leve pulsar de escala. `beatIndex` par/ímpar escolhe o lado.
 */
export function headbangPose(envelope: number, beatIndex: number, rms: number): HeadbangPose {
  const side = beatIndex % 2 === 0 ? 1 : -1;
  const env = Math.min(1, Math.max(0, envelope));
  return {
    y: env * 9,
    rotate: side * env * 7,
    scale: 1 + Math.min(1, Math.max(0, rms)) * 0.05 - env * 0.03,
  };
}

/** `transform` CSS do SVG do mascote para a pose (vazio quando está parado). */
export function headbangTransform(pose: HeadbangPose): string {
  if (pose.y === 0 && pose.rotate === 0 && Math.abs(pose.scale - 1) < 0.0005) return "";
  return `translateY(${pose.y.toFixed(2)}px) rotate(${pose.rotate.toFixed(2)}deg) scale(${pose.scale.toFixed(4)})`;
}

/** Alturas (0..1) das 4 barras do equalizador a partir das bandas (graves→agudos). */
export function equalizerHeights(audio: Pick<AudioReactive, "low" | "mid" | "high" | "rms">): [number, number, number, number] {
  const boost = (v: number) => Math.min(1, Math.pow(Math.max(0, v) * 3.2, 0.7));
  const low = boost(audio.low);
  const mid = boost(audio.mid);
  const high = boost(audio.high);
  const body = boost(audio.rms);
  // barras 1..4: graves, graves+médios, médios+agudos, agudos
  return [low, (low + mid) / 2 || body * 0.6, (mid + high) / 2 || body * 0.6, high];
}
