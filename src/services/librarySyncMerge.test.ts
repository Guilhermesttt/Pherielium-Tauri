import { describe, expect, it } from "vitest";
import type { Game } from "../types/domain";
import { mergeSyncedGame } from "./librarySyncMerge";

const base = (over: Partial<Game> = {}): Game => ({ id: "g1", title: "Hades", image: "loja.jpg", ...over }) as Game;

describe("mergeSyncedGame", () => {
  it("um jogo novo fica como a sincronização trouxe", () => {
    const synced = base({ hoursPlayed: 3 });
    expect(mergeSyncedGame(undefined, synced)).toBe(synced);
  });

  it("o favorito sobrevive à sincronização (ela não sabe de favoritos)", () => {
    const merged = mergeSyncedGame(base({ isFavorite: true }), base({ hoursPlayed: 12 }));
    expect(merged.isFavorite).toBe(true);
    expect(merged.hoursPlayed).toBe(12);
  });

  it("campos que só a pessoa definiu não somem", () => {
    const existing = base({ launchArgs: "-novid" } as Partial<Game>);
    expect(mergeSyncedGame(existing, base())).toMatchObject({ launchArgs: "-novid" });
  });

  it("o que a loja informa atualiza (horas e conquistas)", () => {
    const merged = mergeSyncedGame(base({ hoursPlayed: 1, completedAchievements: 2 }), base({ hoursPlayed: 5, completedAchievements: 9 }));
    expect(merged).toMatchObject({ hoursPlayed: 5, completedAchievements: 9 });
  });

  it("jogo editado à mão mantém nome, arte e executável", () => {
    const existing = base({ title: "Meu Hades", image: "minha.jpg", executablePath: "D:/hades.exe", userEdited: true });
    const merged = mergeSyncedGame(existing, base({ title: "Hades", image: "loja.jpg", executablePath: "1145360" }));
    expect(merged).toMatchObject({ title: "Meu Hades", image: "minha.jpg", executablePath: "D:/hades.exe", userEdited: true });
  });

  it("jogo não editado recebe a arte nova da loja", () => {
    const merged = mergeSyncedGame(base({ image: "velha.jpg" }), base({ image: "nova.jpg" }));
    expect(merged.image).toBe("nova.jpg");
  });
});
