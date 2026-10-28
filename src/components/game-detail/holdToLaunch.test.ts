import { describe, expect, it } from "vitest";
import { HOLD_TO_LAUNCH_MS, holdProgress, rumbleForProgress } from "./holdToLaunch";

describe("holdProgress", () => {
  it("vai de 0 a 1 e trava em 1", () => {
    expect(holdProgress(0)).toBe(0);
    expect(holdProgress(HOLD_TO_LAUNCH_MS / 2)).toBeCloseTo(0.5);
    expect(holdProgress(HOLD_TO_LAUNCH_MS * 3)).toBe(1);
  });

  it("ignora tempos inválidos ou negativos", () => {
    expect(holdProgress(-10)).toBe(0);
    expect(holdProgress(Number.NaN)).toBe(0);
  });
});

describe("rumbleForProgress", () => {
  it("cresce de forma monótona conforme a barra enche", () => {
    let previous = rumbleForProgress(0);
    for (const p of [0.25, 0.5, 0.75, 1]) {
      const current = rumbleForProgress(p);
      expect(current.weak).toBeGreaterThan(previous.weak);
      expect(current.strong).toBeGreaterThan(previous.strong);
      previous = current;
    }
  });

  it("fica sempre dentro do intervalo aceito pelo controle (0 a 1)", () => {
    for (const p of [-1, 0, 0.5, 1, 2]) {
      const { weak, strong } = rumbleForProgress(p);
      expect(weak).toBeGreaterThanOrEqual(0);
      expect(weak).toBeLessThanOrEqual(1);
      expect(strong).toBeGreaterThanOrEqual(0);
      expect(strong).toBeLessThanOrEqual(1);
    }
  });
});
