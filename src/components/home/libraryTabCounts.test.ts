import { describe, expect, it } from "vitest";
import { libraryTabCount } from "./libraryTabCounts";

const games = [{ isFavorite: true }, { isFavorite: false }, { isFavorite: true }, {}];

describe("libraryTabCount", () => {
  it("conta todos os jogos e só os favoritos", () => {
    expect(libraryTabCount("ALL", games)).toBe(4);
    expect(libraryTabCount("FAVORITES", games)).toBe(2);
  });

  it("zero é um número válido (a aba continua mostrando 0)", () => {
    expect(libraryTabCount("ALL", [])).toBe(0);
    expect(libraryTabCount("FAVORITES", [{ isFavorite: false }])).toBe(0);
  });

  it("abas de filtro personalizado ficam sem contagem", () => {
    expect(libraryTabCount("custom-123", games)).toBeNull();
  });
});
