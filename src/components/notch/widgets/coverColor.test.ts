import { describe, expect, it } from "vitest";
import { pickDominantColor, rgbString } from "./coverColor";

/** Monta pixels RGBA: `[r, g, b, quantidade]`. */
const pixels = (...groups: [number, number, number, number][]) =>
  groups.flatMap(([r, g, b, n]) => Array.from({ length: n }, () => [r, g, b, 255]).flat());

describe("pickDominantColor", () => {
  it("devolve a cor de uma capa lisa", () => {
    const c = pickDominantColor(pixels([200, 40, 30, 50]))!;
    expect(c.r).toBeGreaterThan(190);
    expect(c.g).toBeLessThan(60);
  });

  it("prefere a cor viva a um fundo cinza maior", () => {
    const c = pickDominantColor(pixels([120, 120, 120, 70], [230, 90, 20, 40]))!;
    expect(c.r).toBeGreaterThan(c.g);
    expect(c.r).toBeGreaterThan(c.b + 100);
  });

  it("ignora pixels transparentes", () => {
    expect(pickDominantColor([10, 200, 10, 0, 10, 200, 10, 0])).toBeNull();
    expect(pickDominantColor([])).toBeNull();
  });

  it("clareia capas quase pretas e escurece capas quase brancas", () => {
    const dark = pickDominantColor(pixels([8, 10, 12, 30]))!;
    expect(Math.max(dark.r, dark.g, dark.b)).toBeGreaterThanOrEqual(105);
    const light = pickDominantColor(pixels([250, 250, 245, 30]))!;
    expect(Math.max(light.r, light.g, light.b)).toBeLessThanOrEqual(216);
  });

  it("formata para rgba()", () => {
    expect(rgbString({ r: 1, g: 2, b: 3 })).toBe("1, 2, 3");
  });
});
