import { describe, expect, it } from "vitest";
import { MAX_STAGGERED, buildReveal, newIds, revealDelayMs, revealDurationMs } from "./gameReveal";

describe("newIds", () => {
  it("devolve só o que não estava antes, na ordem da lista", () => {
    expect(newIds(new Set(["a", "b"]), ["c", "a", "d", "b"])).toEqual(["c", "d"]);
  });

  it("nada novo, nada para revelar", () => {
    expect(newIds(new Set(["a"]), ["a"])).toEqual([]);
  });

  it("um jogo que saiu da lista não conta", () => {
    expect(newIds(new Set(["a", "b"]), ["a"])).toEqual([]);
  });
});

describe("buildReveal e atrasos", () => {
  it("numera os que chegaram juntos", () => {
    expect(buildReveal(["x", "y"], "sync")).toEqual({ x: { kind: "sync", index: 0 }, y: { kind: "sync", index: 1 } });
  });

  it("a sincronização entra em cascata e a adição manual entra de uma vez", () => {
    expect(revealDelayMs({ kind: "sync", index: 3 })).toBe(210);
    expect(revealDelayMs({ kind: "add", index: 3 })).toBe(0);
  });

  it("uma biblioteca grande não alonga a cascata além do limite", () => {
    expect(revealDelayMs({ kind: "sync", index: 500 })).toBe(MAX_STAGGERED * 70);
    expect(revealDurationMs(500, "sync")).toBe(MAX_STAGGERED * 70 + 900 + 200);
  });

  it("a duração cobre a última capa", () => {
    expect(revealDurationMs(1, "add")).toBe(1600);
  });
});
