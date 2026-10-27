/**
 * Próximo objetivo de troféus: o jogo mais perto da Platina (100% das conquistas).
 * Puro e sem dependências de tela, para a regra ser testada à parte.
 */
export interface GoalCandidate<G> {
  game: G;
  /** total de conquistas do jogo */
  t: number;
  /** conquistas já desbloqueadas */
  u: number;
}

export interface PlatinumGoal<G> {
  game: G;
  total: number;
  unlocked: number;
  remaining: number;
  /** 0 a 99, arredondado como a lista de jogos; 100 só quando a Platina de fato saiu */
  percent: number;
}

/**
 * Entre os jogos que ainda não chegaram a 100%, escolhe o de maior progresso; no empate,
 * o que falta menos; depois o título. Jogos sem nenhum desbloqueio não são "objetivo":
 * quem não começou ainda não tem um caminho até a Platina.
 */
export function closestToPlatinum<G extends { title?: string }>(
  candidates: readonly GoalCandidate<G>[],
): PlatinumGoal<G> | null {
  let best: PlatinumGoal<G> | null = null;
  for (const { game, t, u } of candidates) {
    if (t <= 0 || u <= 0 || u >= t) continue;
    const goal: PlatinumGoal<G> = {
      game,
      total: t,
      unlocked: u,
      remaining: t - u,
      percent: Math.min(99, Math.round((u / t) * 100)),
    };
    if (!best || isBetter(goal, best)) best = goal;
  }
  return best;
}

function isBetter<G extends { title?: string }>(a: PlatinumGoal<G>, b: PlatinumGoal<G>): boolean {
  if (a.unlocked / a.total !== b.unlocked / b.total) return a.unlocked / a.total > b.unlocked / b.total;
  if (a.remaining !== b.remaining) return a.remaining < b.remaining;
  return (a.game.title ?? "").localeCompare(b.game.title ?? "") < 0;
}
