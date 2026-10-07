/**
 * Espelho em JS dos tokens de movimento de src/index.css (--dur-focus / --ease-focus),
 * para animacoes do framer-motion. Mantenha os dois em sincronia.
 */
export const FOCUS_DURATION_S = 0.28;
export const FOCUS_EASE = [0.22, 1, 0.36, 1] as const;

export const FOCUS_TRANSITION = {
  duration: FOCUS_DURATION_S,
  ease: FOCUS_EASE,
} as const;
