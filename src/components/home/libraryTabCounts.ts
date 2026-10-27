import type { Game } from "../../types/domain";

/**
 * Quantos jogos cada aba fixa da biblioteca tem, para mostrar o número ao lado do nome
 * ("TODOS OS JOGOS 66"). Abas de filtros personalizados não têm contagem aqui (`null`): o filtro
 * é avaliado em outro lugar.
 */
export function libraryTabCount(tabId: string, games: readonly Pick<Game, "isFavorite">[]): number | null {
  if (tabId === "ALL") return games.length;
  if (tabId === "FAVORITES") return games.filter((game) => game.isFavorite).length;
  return null;
}
