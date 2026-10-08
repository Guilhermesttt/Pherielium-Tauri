/**
 * Motion do notch, no estilo do Coucou (https://github.com/Louis-CFM/coucou, MIT,
 * Copyright (c) 2026 Louis Raillé): abrir = mola macia; fechar = curva temporal curta
 * sem overshoot. Valores portados de `windows/src/core/anim.ts`.
 */

/** Resposta (s) e amortecimento da mola de abertura do Coucou. */
export const OPEN_SPRING_RESPONSE = 0.5;
export const OPEN_SPRING_DAMPING = 0.72;

/** Fechamento: 340 ms, cubic-bezier(.45, 0, .2, 1). */
export const CLOSE_DURATION_S = 0.34;
export const CLOSE_EASE = [0.45, 0, 0.2, 1] as const;

/** Troca de vista do painel: sai em 0.16 s, entra em 0.3 s com overshoot leve. */
export const VIEW_OUT_S = 0.16;
export const VIEW_IN_S = 0.3;
export const VIEW_IN_EASE = [0.3, 1.2, 0.4, 1] as const;

/** Espera antes de a ilha recolher para dentro da borda da tela. */
export const HIDE_DELAY_MS = 420;

/**
 * Mola estilo SwiftUI (`response`, `dampingFraction`) como parâmetros de mola física:
 * ω₀ = 2π / response, rigidez = ω₀², amortecimento = 2·ζ·ω₀ (massa 1).
 */
export function springFromResponse(response: number, damping: number) {
  const omega = (2 * Math.PI) / response;
  return {
    type: "spring" as const,
    stiffness: omega * omega,
    damping: 2 * damping * omega,
    mass: 1,
  };
}

export const OPEN_SPRING = springFromResponse(OPEN_SPRING_RESPONSE, OPEN_SPRING_DAMPING);

export const CLOSE_TRANSITION = {
  type: "tween" as const,
  duration: CLOSE_DURATION_S,
  ease: [...CLOSE_EASE] as [number, number, number, number],
};

/** Crescer usa a mola, encolher usa a curva (sem quicar para dentro da borda). */
export function geometryTransition(growing: boolean) {
  return growing ? OPEN_SPRING : CLOSE_TRANSITION;
}
