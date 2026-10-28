/**
 * Quais jogos acabaram de chegar à fileira da Home, para a capa entrar com animação em vez de só
 * aparecer. Funções puras; o hook `useGameReveal` liga isso à tela.
 */

/** De onde veio a novidade: "add" = a pessoa adicionou (jogo novo ou jogo posto num filtro); "sync" = sincronização. */
export type RevealKind = "add" | "sync";

export interface Reveal {
  kind: RevealKind;
  /** Posição entre os que chegaram juntos: define o atraso da cascata. */
  index: number;
}

/** Os ids de `current` que não estavam em `previous`, na ordem em que aparecem. */
export function newIds(previous: ReadonlySet<string>, current: readonly string[]): string[] {
  return current.filter((id) => !previous.has(id));
}

/** Monta o mapa id → revelação; vazio quando ninguém chegou. */
export function buildReveal(ids: readonly string[], kind: RevealKind): Record<string, Reveal> {
  return Object.fromEntries(ids.map((id, index) => [id, { kind, index }]));
}

/** Quanto tempo o mapa precisa ficar de pé: o atraso da última capa mais a animação dela. */
export function revealDurationMs(count: number, kind: RevealKind): number {
  const stagger = kind === "sync" ? SYNC_STAGGER_MS : 0;
  const animation = kind === "sync" ? 900 : 1400;
  return Math.min(count - 1, MAX_STAGGERED) * stagger + animation + 200;
}

/** Atraso entre uma capa e a seguinte na cascata da sincronização. */
export const SYNC_STAGGER_MS = 70;
/** A partir daqui as capas entram juntas: uma biblioteca de 300 jogos não leva 20 s para aparecer. */
export const MAX_STAGGERED = 14;

/** Atraso de entrada da capa `index`, em ms. */
export function revealDelayMs(reveal: Reveal): number {
  return reveal.kind === "sync" ? Math.min(reveal.index, MAX_STAGGERED) * SYNC_STAGGER_MS : 0;
}
