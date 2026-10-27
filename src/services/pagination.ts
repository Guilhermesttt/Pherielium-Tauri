export interface PageSlice<T> {
  items: T[];
  /** Página mostrada, já ajustada ao que existe (1 a `pageCount`). */
  page: number;
  pageCount: number;
  /** Posição, começando em 1, do primeiro e do último item da página; 0 quando não há itens. */
  from: number;
  to: number;
}

/**
 * Uma página de uma lista. `page` fora do intervalo (por exemplo, a lista encolheu depois de uma
 * busca) é puxada para a página válida mais próxima, então a tela nunca fica numa página vazia.
 */
export function paginate<T>(list: readonly T[], page: number, pageSize: number): PageSlice<T> {
  const size = Math.max(1, Math.floor(pageSize));
  const pageCount = Math.max(1, Math.ceil(list.length / size));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), pageCount);
  const start = (current - 1) * size;
  const items = list.slice(start, start + size);
  return {
    items,
    page: current,
    pageCount,
    from: items.length === 0 ? 0 : start + 1,
    to: start + items.length,
  };
}
