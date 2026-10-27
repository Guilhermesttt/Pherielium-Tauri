/**
 * Histórico de navegação entre seções do hub (as `activeCategory` do Home), para as setas
 * voltar/avançar da barra de título. Puro: não conhece React nem a janela.
 *
 * Só seções entram aqui. Painéis abertos por cima (detalhe de jogo, modais) têm o próprio
 * botão de fechar e não são "páginas".
 */
export interface NavHistory {
  entries: readonly string[];
  index: number;
}

/** Mais que isso não ajuda ninguém e só cresce na memória. */
export const NAV_HISTORY_LIMIT = 50;

export const createNavHistory = (initial: string): NavHistory => ({ entries: [initial], index: 0 });

/** Entra uma nova seção: apaga o "avançar" e ignora repetição da seção atual. */
export function pushEntry(history: NavHistory, category: string): NavHistory {
  if (history.entries[history.index] === category) return history;
  const kept = history.entries.slice(0, history.index + 1);
  const entries = [...kept, category].slice(-NAV_HISTORY_LIMIT);
  return { entries, index: entries.length - 1 };
}

export const canGoBack = (history: NavHistory) => history.index > 0;
export const canGoForward = (history: NavHistory) => history.index < history.entries.length - 1;

export interface NavStep {
  history: NavHistory;
  entry: string;
}

/** Devolve o novo histórico e a seção de destino, ou `null` se não há para onde ir. */
export function goBack(history: NavHistory): NavStep | null {
  if (!canGoBack(history)) return null;
  const next = { ...history, index: history.index - 1 };
  return { history: next, entry: next.entries[next.index] };
}

export function goForward(history: NavHistory): NavStep | null {
  if (!canGoForward(history)) return null;
  const next = { ...history, index: history.index + 1 };
  return { history: next, entry: next.entries[next.index] };
}

export interface NavHistoryFlags {
  canBack: boolean;
  canForward: boolean;
}

export const historyFlags = (history: NavHistory): NavHistoryFlags => ({
  canBack: canGoBack(history),
  canForward: canGoForward(history),
});

/** Eventos entre a barra de título (fora do Home) e o Home, no padrão `checkpoint:*` do app. */
export const NAV_HISTORY_REQUEST_EVENT = "checkpoint:nav-history";
export const NAV_HISTORY_STATE_EVENT = "checkpoint:nav-history-state";
