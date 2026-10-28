/** Quanto tempo o botão "Iniciar" precisa ficar pressionado (mouse, teclado ou controle). */
export const HOLD_TO_LAUNCH_MS = 1100;

/** Intervalo entre as vibrações do controle enquanto o botão está pressionado. */
export const HOLD_RUMBLE_TICK_MS = 90;

export interface RumbleMagnitudes {
  weak: number;
  strong: number;
}

/** Fração (0 a 1) do tempo de segurar já cumprida. */
export function holdProgress(elapsedMs: number, durationMs: number = HOLD_TO_LAUNCH_MS): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0;
  return Math.min(1, elapsedMs / durationMs);
}

/**
 * Intensidade da vibração para um progresso. Começa como um leve zumbido (motor fraco) e o motor
 * forte entra de forma curva perto do fim, então o último trecho "aperta" mais que o começo.
 */
export function rumbleForProgress(progress: number): RumbleMagnitudes {
  const p = Math.min(1, Math.max(0, progress));
  return {
    weak: 0.1 + 0.5 * p,
    strong: 0.9 * p * p,
  };
}
