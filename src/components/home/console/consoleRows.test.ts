import { describe, expect, it } from "vitest";
import type { Game } from "../../../types/domain";
import { buildConsoleRow, platformKey, resolveWallFocus, stepColumn, stepRow, type WallRow } from "./consoleRows";

const game = (id: string, extra: Partial<Game> = {}): Game => ({ id, title: id, ...extra }) as Game;

const steamA = game("a", { launcherType: "steam" } as Partial<Game>);
const steamB = game("b", { launcherType: "steam", isFavorite: true } as Partial<Game>);
const epicC = game("c", { launcherType: "epic" } as Partial<Game>);
const localD = game("d");

describe("platformKey", () => {
  it("normaliza a loja e manda o desconhecido para local", () => {
    expect(platformKey(steamA)).toBe("steam");
    expect(platformKey(localD)).toBe("local");
    expect(platformKey(game("x", { source: "manual" }))).toBe("local");
  });
});

describe("buildConsoleRow", () => {
  const all = [steamA, steamB, epicC, localD];

  it("na aba Todos: recentes primeiro, depois o resto, sem repetir", () => {
    const rows = buildConsoleRow(all, [epicC, steamA], { isAllCategory: true, title: "Biblioteca" });
    expect(rows).toHaveLength(1);
    expect(rows[0].games.map((g) => g.id)).toEqual(["c", "a", "b", "d"]);
  });

  it("recentes fora da busca não entram", () => {
    const rows = buildConsoleRow([steamB, localD], [epicC, steamB], { isAllCategory: true, title: "Biblioteca" });
    expect(rows[0].games.map((g) => g.id)).toEqual(["b", "d"]);
  });

  it("em outra aba é o recorte como está; sem jogos, nenhuma fileira", () => {
    expect(buildConsoleRow([steamB], [epicC], { isAllCategory: false, title: "Favoritos" })).toEqual([
      { id: "library", title: "Favoritos", games: [steamB] },
    ]);
    expect(buildConsoleRow([], [epicC], { isAllCategory: true, title: "Biblioteca" })).toEqual([]);
  });
});

describe("foco nas fileiras", () => {
  const rows: WallRow[] = [
    { id: "continue", title: "Continuar", games: [epicC] },
    { id: "favorites", title: "Favoritos", games: [steamB] },
    { id: "steam", title: "Steam", games: [steamA, steamB] },
    { id: "epic", title: "Epic", games: [epicC] },
    { id: "local", title: "Local", games: [localD] },
  ];

  it("prefere a fileira ativa quando o jogo está nela", () => {
    expect(resolveWallFocus(rows, 3, "c")).toEqual({ row: 3, col: 0 });
    expect(resolveWallFocus(rows, 2, "b")).toEqual({ row: 2, col: 1 });
  });

  it("senão vai para a primeira fileira que tem o jogo", () => {
    expect(resolveWallFocus(rows, 4, "b")).toEqual({ row: 1, col: 0 });
    expect(resolveWallFocus(rows, 0, undefined)).toEqual({ row: 0, col: 0 });
    expect(resolveWallFocus([], 3, "a")).toEqual({ row: 0, col: 0 });
  });

  it("anda na fileira e para nas bordas", () => {
    expect(stepColumn(rows, { row: 2, col: 0 }, 1)?.id).toBe("b");
    expect(stepColumn(rows, { row: 2, col: 1 }, 1)).toBeNull();
    expect(stepColumn(rows, { row: 2, col: 0 }, -1)).toBeNull();
  });

  it("troca de fileira mantendo a coluna, ou o último numa fileira curta", () => {
    expect(stepRow(rows, { row: 2, col: 1 }, 1)).toEqual({ row: 3, game: epicC });
    expect(stepRow(rows, { row: 1, col: 0 }, 1)).toEqual({ row: 2, game: steamA });
    expect(stepRow(rows, { row: 0, col: 0 }, -1)).toBeNull();
    expect(stepRow(rows, { row: 4, col: 0 }, 1)).toBeNull();
  });
});
