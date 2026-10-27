import { describe, expect, it } from "vitest";
import { BACKDROP, backdropOpacity } from "./bootIntroBackdrop";

describe("backdropOpacity", () => {
  it("fica invisível no começo e sobe até o pico", () => {
    expect(backdropOpacity(0)).toBe(0);
    expect(backdropOpacity(BACKDROP.rampFrom)).toBe(0);
    expect(backdropOpacity((BACKDROP.rampFrom + BACKDROP.rampTo) / 2)).toBeCloseTo(BACKDROP.peak / 2);
    expect(backdropOpacity(BACKDROP.rampTo)).toBeCloseTo(BACKDROP.peak);
  });

  it("segura o pico e depois some", () => {
    expect(backdropOpacity(6)).toBeCloseTo(BACKDROP.peak);
    expect(backdropOpacity(BACKDROP.fadeTo)).toBe(0);
    expect(backdropOpacity(99)).toBe(0);
  });

  it("nunca passa do pico nem fica negativa", () => {
    for (let t = -1; t < 15; t += 0.25) {
      const value = backdropOpacity(t);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(BACKDROP.peak + 1e-9);
    }
  });
});
