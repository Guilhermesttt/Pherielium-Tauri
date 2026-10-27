import { describe, expect, it } from "vitest";
import { paginate } from "./pagination";

const list = Array.from({ length: 32 }, (_, index) => index + 1);

describe("paginate", () => {
  it("devolve 15 por página e conta as páginas", () => {
    const first = paginate(list, 1, 15);
    expect(first.items).toHaveLength(15);
    expect(first.pageCount).toBe(3);
    expect([first.from, first.to]).toEqual([1, 15]);
  });

  it("a última página leva só o que sobrou", () => {
    const last = paginate(list, 3, 15);
    expect(last.items).toEqual([31, 32]);
    expect([last.from, last.to]).toEqual([31, 32]);
  });

  it("página fora do intervalo vai para a mais próxima (a lista encolheu)", () => {
    expect(paginate(list, 9, 15).page).toBe(3);
    expect(paginate(list, 0, 15).page).toBe(1);
    expect(paginate(list, Number.NaN, 15).page).toBe(1);
    expect(paginate(list.slice(0, 5), 3, 15).items).toHaveLength(5);
  });

  it("lista vazia tem uma página vazia, sem itens e sem posição", () => {
    const empty = paginate([], 1, 15);
    expect(empty).toEqual({ items: [], page: 1, pageCount: 1, from: 0, to: 0 });
  });

  it("um tamanho de página inválido não quebra", () => {
    expect(paginate(list, 1, 0).items).toHaveLength(1);
  });
});
