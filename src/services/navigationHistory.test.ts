import { describe, expect, it } from "vitest";
import {
  NAV_HISTORY_LIMIT,
  createNavHistory,
  goBack,
  goForward,
  historyFlags,
  pushEntry,
} from "./navigationHistory";

describe("navigationHistory", () => {
  it("começa sem para onde voltar ou avançar", () => {
    expect(historyFlags(createNavHistory("ALL"))).toEqual({ canBack: false, canForward: false });
  });

  it("ignora a repetição da seção atual", () => {
    const h = pushEntry(createNavHistory("ALL"), "ALL");
    expect(h.entries).toEqual(["ALL"]);
  });

  it("volta e avança pelas seções visitadas", () => {
    let h = pushEntry(pushEntry(createNavHistory("ALL"), "FRIENDS"), "MODS");
    const back = goBack(h)!;
    expect(back.entry).toBe("FRIENDS");
    h = back.history;
    expect(historyFlags(h)).toEqual({ canBack: true, canForward: true });
    expect(goForward(h)!.entry).toBe("MODS");
  });

  it("apaga o avançar quando se navega para uma seção nova", () => {
    let h = pushEntry(pushEntry(createNavHistory("ALL"), "FRIENDS"), "MODS");
    h = goBack(h)!.history; // em FRIENDS
    h = pushEntry(h, "TROPHIES");
    expect(h.entries).toEqual(["ALL", "FRIENDS", "TROPHIES"]);
    expect(goForward(h)).toBeNull();
  });

  it("devolve null nas pontas", () => {
    const h = createNavHistory("ALL");
    expect(goBack(h)).toBeNull();
    expect(goForward(h)).toBeNull();
  });

  it("limita o tamanho guardando as mais recentes", () => {
    let h = createNavHistory("c0");
    for (let i = 1; i <= NAV_HISTORY_LIMIT + 10; i++) h = pushEntry(h, `c${i}`);
    expect(h.entries).toHaveLength(NAV_HISTORY_LIMIT);
    expect(h.entries.at(-1)).toBe(`c${NAV_HISTORY_LIMIT + 10}`);
    expect(h.index).toBe(NAV_HISTORY_LIMIT - 1);
  });
});
