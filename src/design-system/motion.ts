/**
 * Molas e durações do app (react-spring). Uma família só: o movimento tem o mesmo "peso" em toda
 * parte. Use estes nomes em vez de números soltos.
 *
 * - soft:    padrão para entradas e saídas (assenta sem passar do ponto)
 * - snappy:  respostas diretas ao toque (botões, chips)
 * - bouncy:  confirmação de algo que o usuário acabou de fazer (passa um pouco do ponto)
 * - gentle:  elementos grandes (painéis, hero) e movimento ambiente
 */
export const SPRINGS = {
  soft: { tension: 380, friction: 24, mass: 0.9 },
  snappy: { tension: 420, friction: 28, mass: 0.8 },
  bouncy: { tension: 330, friction: 17, mass: 0.9 },
  gentle: { tension: 220, friction: 26, mass: 1 },
} as const;

export type SpringName = keyof typeof SPRINGS;

/** Durações (ms) para o que não é mola: fades e cores. */
export const DURATIONS = { instant: 90, quick: 150, base: 220, slow: 360 } as const;
