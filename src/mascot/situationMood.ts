import type { MascotMood } from "./moods";

/** Passos da Pherie parada: de entediada a dormindo. Madrugada: ela cansa bem mais cedo. */
const IDLE_STEPS_DAY: ReadonlyArray<readonly [number, MascotMood]> = [
  [300_000, "sleeping"],
  [150_000, "drowsy"],
  [60_000, "bored"],
];
const IDLE_STEPS_NIGHT: ReadonlyArray<readonly [number, MascotMood]> = [
  [90_000, "sleeping"],
  [20_000, "drowsy"],
];

export const isLateNight = (hour: number) => hour >= 23 || hour < 5;

/** Humor pelo tempo sem ninguém mexer (`null` = ainda desperta). */
export function idleMood(idleMs: number, hour: number): MascotMood | null {
  for (const [after, mood] of isLateNight(hour) ? IDLE_STEPS_NIGHT : IDLE_STEPS_DAY) {
    if (idleMs >= after) return mood;
  }
  return null;
}

/** Reação ao fim de uma sessão de jogo (`null` = sessão curta, sem reação). */
export function gameEndMood(elapsedSeconds: number): MascotMood | null {
  if (elapsedSeconds >= 1800) return "proud";
  if (elapsedSeconds >= 300) return "happy";
  return null;
}

/** Reação ao fim de uma chamada: saudade quando foi uma conversa de verdade. */
export function callEndMood(durationSeconds: number): MascotMood | null {
  return durationSeconds >= 60 ? "sad" : null;
}

/** Duração (ms) das reações curtas. */
export const TRANSIENT_MS = {
  surprised: 1100,
  annoyed: 1500,
  confused: 2200,
  excited: 1600,
  wink: 900,
  sad: 2600,
  proud: 3600,
  happy: 2400,
  bored: 2400,
} as const;
