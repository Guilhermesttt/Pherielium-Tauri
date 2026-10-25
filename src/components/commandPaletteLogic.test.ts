import { describe, expect, it } from "vitest";
import {
  RECENTS_LIMIT,
  chipCounts,
  formatResumeAge,
  parseRecents,
  pickResumeGame,
  pushRecent,
  scoreItem,
  searchItems,
  type SearchableItem,
} from "./commandPaletteLogic";

const item = (id: string, title: string, kind: SearchableItem["kind"], subtitle?: string): SearchableItem => ({
  id,
  title,
  kind,
  subtitle,
});

const ITEMS = [
  item("g1", "Jogar Counter-Strike 2", "game", "Steam"),
  item("g2", "Jogar Hades II", "game", "Epic"),
  item("p1", "Abrir chat com Sacrig", "person", "Jogando Counter-Strike 2"),
  item("m1", "Gerenciador de Mods", "mod"),
  item("a1", "Troféus & Conquistas", "action"),
];

describe("scoreItem", () => {
  it("começo do título vence começo de palavra, que vence trecho", () => {
    const startsWith = scoreItem(item("x", "Hades", "game"), "had");
    const wordStart = scoreItem(item("y", "Jogar Hades", "game"), "had");
    const contains = scoreItem(item("z", "Shades of Gray", "game"), "had");
    expect(startsWith).toBeGreaterThan(wordStart);
    expect(wordStart).toBeGreaterThan(contains);
    expect(contains).toBeGreaterThan(0);
  });

  it("ignora acento e maiúscula", () => {
    expect(scoreItem(item("a", "Troféus & Conquistas", "action"), "TROFEU")).toBeGreaterThan(0);
  });

  it("o subtítulo conta, mas por último, e o que não casa é 0", () => {
    expect(scoreItem(item("a", "Abrir chat", "person", "Jogando Hades"), "hades")).toBe(1);
    expect(scoreItem(item("a", "Abrir chat", "person"), "zzz")).toBe(0);
  });
});

describe("searchItems", () => {
  it("o chip restringe ao tipo", () => {
    expect(searchItems(ITEMS, "", "games").map((i) => i.id)).toEqual(["g1", "g2"]);
    expect(searchItems(ITEMS, "", "people").map((i) => i.id)).toEqual(["p1"]);
    expect(searchItems(ITEMS, "", "mods").map((i) => i.id)).toEqual(["m1"]);
    expect(searchItems(ITEMS, "", "actions").map((i) => i.id)).toEqual(["a1"]);
  });

  it("ordena por relevância e mantém a ordem original no empate", () => {
    const result = searchItems(ITEMS, "counter", "all").map((i) => i.id);
    expect(result).toEqual(["g1", "p1"]);
  });

  it("respeita o limite", () => {
    expect(searchItems(ITEMS, "", "all", 2)).toHaveLength(2);
  });
});

describe("chipCounts", () => {
  it("conta por tipo só o que casa com a busca", () => {
    const counts = chipCounts(ITEMS, "counter");
    expect(counts).toEqual({ all: 2, games: 1, people: 1, mods: 0, actions: 0 });
  });
});

describe("recentes", () => {
  it("põe no começo, sem repetir, e limita o tamanho", () => {
    expect(pushRecent(["a", "b", "c"], "b")).toEqual(["b", "a", "c"]);
    let ids: string[] = [];
    for (let i = 0; i < RECENTS_LIMIT + 3; i++) ids = pushRecent(ids, `x${i}`);
    expect(ids).toHaveLength(RECENTS_LIMIT);
    expect(ids[0]).toBe(`x${RECENTS_LIMIT + 2}`);
  });

  it("ignora o que não for lista de textos vindo do disco", () => {
    expect(parseRecents(null)).toEqual([]);
    expect(parseRecents({ a: 1 })).toEqual([]);
    expect(parseRecents(["a", 2, "b", null])).toEqual(["a", "b"]);
  });
});

describe("retomar", () => {
  it("escolhe o jogo jogado por último", () => {
    const games = [
      { id: "a", lastPlayedAt: "2026-10-01T10:00:00Z" },
      { id: "b", lastPlayedAt: "2026-10-20T10:00:00Z" },
      { id: "c" },
      { id: "d", lastPlayedAt: "data inválida" },
    ];
    expect(pickResumeGame(games)?.id).toBe("b");
  });

  it("sem nenhuma sessão registrada, não há o que retomar", () => {
    expect(pickResumeGame([{ id: "a" }, { id: "b", lastPlayedAt: null }])).toBeNull();
    expect(pickResumeGame([])).toBeNull();
  });

  it("formata há quanto tempo foi", () => {
    const now = new Date("2026-10-21T12:00:00Z").getTime();
    expect(formatResumeAge("2026-10-21T11:30:00Z", now)).toBe("há 30 min");
    expect(formatResumeAge("2026-10-21T07:00:00Z", now)).toBe("há 5 h");
    expect(formatResumeAge("2026-10-18T12:00:00Z", now)).toBe("há 3 d");
    expect(formatResumeAge(undefined, now)).toBe("");
    expect(formatResumeAge("lixo", now)).toBe("");
  });
});
