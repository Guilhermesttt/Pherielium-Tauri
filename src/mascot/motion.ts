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

/** Valor de `springFromResponse`, mantido para quem ainda pensa em response/damping (ver o teste). */
export const COUCOU_OPEN_SPRING = springFromResponse(OPEN_SPRING_RESPONSE, OPEN_SPRING_DAMPING);

// ── Molas do notch (padrão Apple Spring, inspiradas no macOS e no Coucou) ───────────────────

/** Surgimento da ilha vindo do topo: desce, passa um pouco do ponto (overshoot elástico) e assenta. */
export const NOTCH_DROP_IN_SPRING = {
  type: "spring" as const,
  stiffness: 320,
  damping: 22,
  mass: 0.9,
};

/** Expansão morfológica (compacto → expandido): largura, altura e raio acompanham a mesma mola. */
export const NOTCH_EXPAND_SPRING = {
  type: "spring" as const,
  stiffness: 340,
  damping: 28,
  mass: 0.85,
};

/** Recolhimento para fora da tela: amortecimento alto, sem quicar contra o topo da moldura. */
export const NOTCH_RETRACT_TRANSITION = {
  type: "spring" as const,
  stiffness: 380,
  damping: 38,
  mass: 0.8,
};

/** Fim de curso da ilha escondida (px acima do topo): sai por inteiro, com a sombra e os cantos. */
export const NOTCH_HIDDEN_Y = -70;

/** Com "reduzir movimento": sem overshoot nem deslocamento longo, só um ajuste curto. */
export const NOTCH_REDUCED_TRANSITION = {
  type: "tween" as const,
  duration: 0.14,
  ease: "easeOut" as const,
};

export const OPEN_SPRING = NOTCH_EXPAND_SPRING;

export const CLOSE_TRANSITION = {
  type: "tween" as const,
  duration: CLOSE_DURATION_S,
  ease: [...CLOSE_EASE] as [number, number, number, number],
};

/** Crescer usa a mola de expansão; encolher usa a de recolhimento (amortecida, sem quicar para dentro da borda). */
export function geometryTransition(growing: boolean, reduced = false) {
  if (reduced) return NOTCH_REDUCED_TRANSITION;
  return growing ? NOTCH_EXPAND_SPRING : NOTCH_RETRACT_TRANSITION;
}

/**
 * Transição do container raiz: ao aparecer usa a mola com overshoot; ao se esconder espera o
 * atraso de recolhimento e usa a mola amortecida.
 */
export function notchPositionTransition(hidden: boolean, reduced = false) {
  if (reduced) return hidden ? { ...NOTCH_REDUCED_TRANSITION, delay: HIDE_DELAY_MS / 1000 } : NOTCH_REDUCED_TRANSITION;
  return hidden ? { ...NOTCH_RETRACT_TRANSITION, delay: HIDE_DELAY_MS / 1000 } : NOTCH_DROP_IN_SPRING;
}
