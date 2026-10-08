import { describe, expect, it } from "vitest";
import { mapGenreToPersona, normalizeGenre } from "./genrePersona";

describe("mapGenreToPersona", () => {
  it("metal, heavy metal, hardcore e grunge viram metal", () => {
    for (const g of ["Metal", "Heavy Metal", "Hardcore", "Grunge", "Nu Metal", "Alternative Metal"]) {
      expect(mapGenreToPersona([g]), g).toBe("metal");
    }
  });

  it("pop, dance, disco e electronic viram pop", () => {
    for (const g of ["Pop", "Dance", "Disco", "Electronic", "Electronica", "House"]) {
      expect(mapGenreToPersona([g]), g).toBe("pop");
    }
  });

  it("lofi, jazz, chill, classical e ambient viram chill", () => {
    for (const g of ["Lofi", "Lo-Fi", "Jazz", "Chill", "Classical", "Clássica", "Ambient"]) {
      expect(mapGenreToPersona([g]), g).toBe("chill");
    }
  });

  it("rock tradicional, indie e desconhecido ficam no padrão", () => {
    for (const g of ["Rock", "Indie Rock", "Alternative", "Country", "Hip-Hop/Rap"]) {
      expect(mapGenreToPersona([g]), g).toBe("padrao");
    }
  });

  it("lista vazia, nula ou só lixo vira padrão", () => {
    expect(mapGenreToPersona([])).toBe("padrao");
    expect(mapGenreToPersona(null)).toBe("padrao");
    expect(mapGenreToPersona(["", "  "])).toBe("padrao");
  });

  it("prioridade: metal vence pop, pop vence chill", () => {
    expect(mapGenreToPersona(["Electronic", "Heavy Metal"])).toBe("metal");
    expect(mapGenreToPersona(["Ambient", "Pop"])).toBe("pop");
  });

  it("não confunde palavras parecidas (popular, hip hop)", () => {
    expect(mapGenreToPersona(["Popular Music"])).toBe("padrao");
    expect(mapGenreToPersona(["Hip Hop"])).toBe("padrao");
    expect(mapGenreToPersona(["Dance Pop"])).toBe("pop");
  });

  it("normaliza acento, caixa e separadores", () => {
    expect(normalizeGenre("  Música  Clássica ")).toBe("musica classica");
    expect(mapGenreToPersona(["Rock/Heavy_Metal"])).toBe("metal");
  });
});
