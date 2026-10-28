import { describe, expect, it } from "vitest";
import { gameIdsOfCustomFilter } from "./customLibraryFilters";

const raw = JSON.stringify([
  { id: "custom_1", name: "Co-op", gameIds: ["a", "b"], createdAt: 1 },
  { id: "custom_2", name: "Vazio", gameIds: [], createdAt: 2 },
]);

describe("gameIdsOfCustomFilter", () => {
  it("devolve os jogos do filtro pedido", () => {
    expect(gameIdsOfCustomFilter(raw, "custom_1")).toEqual(new Set(["a", "b"]));
  });

  it("um filtro editado devolve a lista nova a partir do texto novo", () => {
    const edited = raw.replace('["a","b"]', '["a","b","c"]');
    expect(gameIdsOfCustomFilter(edited, "custom_1")).toEqual(new Set(["a", "b", "c"]));
  });

  it("um filtro sem jogos é um conjunto vazio, não 'não existe'", () => {
    expect(gameIdsOfCustomFilter(raw, "custom_2")).toEqual(new Set());
  });

  it("filtro inexistente, texto vazio ou quebrado dão null", () => {
    expect(gameIdsOfCustomFilter(raw, "custom_9")).toBeNull();
    expect(gameIdsOfCustomFilter(null, "custom_1")).toBeNull();
    expect(gameIdsOfCustomFilter("{", "custom_1")).toBeNull();
    expect(gameIdsOfCustomFilter('{"id":"custom_1"}', "custom_1")).toBeNull();
  });
});
