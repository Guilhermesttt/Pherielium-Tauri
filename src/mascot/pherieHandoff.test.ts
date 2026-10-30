import { describe, expect, it } from "vitest";
import { PRESENCE_STALE_MS, notchHoldsPherie, parsePresence } from "./pherieHandoff";

describe("notchHoldsPherie", () => {
  it("sem sinal nenhum, a Pherie é do hub", () => {
    expect(notchHoldsPherie(null, 1000)).toBe(false);
  });

  it("a notch está com ela enquanto os sinais continuam chegando", () => {
    expect(notchHoldsPherie({ active: true, at: 1000 }, 1000 + PRESENCE_STALE_MS)).toBe(true);
  });

  it("se os sinais param (overlay fechou ou travou), ela volta para o hub sozinha", () => {
    expect(notchHoldsPherie({ active: true, at: 1000 }, 1001 + PRESENCE_STALE_MS)).toBe(false);
  });

  it("a notch avisando que dispensou a Pherie devolve na hora", () => {
    expect(notchHoldsPherie({ active: false, at: 1000 }, 1001)).toBe(false);
  });
});

describe("parsePresence", () => {
  it("aceita só { active: boolean } e carimba o instante", () => {
    expect(parsePresence({ active: true }, 5)).toEqual({ active: true, at: 5 });
    expect(parsePresence({ active: false }, 5)).toEqual({ active: false, at: 5 });
  });

  it("ignora payloads malformados", () => {
    for (const bad of [null, undefined, 3, "x", {}, { active: "sim" }, { active: 1 }]) {
      expect(parsePresence(bad, 5)).toBeNull();
    }
  });
});
