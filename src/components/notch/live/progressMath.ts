/** Linha do tempo da mídia do PC (Windows GSMTC): posição, duração e quando foi medida. */
export interface MediaTimeline {
  positionSeconds: number;
  durationSeconds: number;
  /** instante (ms, relógio do PC) em que `positionSeconds` valia */
  sampledAtMs: number;
  playing: boolean;
}

interface RawTimeline {
  positionSeconds?: unknown;
  durationSeconds?: unknown;
  updatedAtMs?: unknown;
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/** Lê o que o backend devolveu; `null` quando não há duração (transmissões ao vivo, apps sem timeline). */
export function parseTimeline(info: RawTimeline | null | undefined, playing: boolean, now: number): MediaTimeline | null {
  if (!info) return null;
  const duration = num(info.durationSeconds);
  if (duration <= 0) return null;
  const updated = num(info.updatedAtMs);
  // timestamp inválido ou no futuro (relógio diferente): vale o instante da leitura
  const sampledAtMs = updated > 0 && updated <= now + 2000 ? updated : now;
  return {
    positionSeconds: Math.min(duration, Math.max(0, num(info.positionSeconds))),
    durationSeconds: duration,
    sampledAtMs,
    playing,
  };
}

/** Posição agora: andou desde a medição, se está tocando; nunca passa da duração. */
export function currentPosition(t: MediaTimeline, now: number): number {
  const elapsed = t.playing ? Math.max(0, (now - t.sampledAtMs) / 1000) : 0;
  return Math.min(t.durationSeconds, t.positionSeconds + elapsed);
}

export const progressFraction = (t: MediaTimeline, now: number) =>
  t.durationSeconds > 0 ? currentPosition(t, now) / t.durationSeconds : 0;

/** `m:ss` (ou `h:mm:ss`). */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}
