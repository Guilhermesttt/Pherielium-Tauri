import { describe, expect, it } from "vitest";
import { FRAME_BUDGET_MS, frameWindowIsSlow } from "./videoHold";

describe("frameWindowIsSlow", () => {
  it("60 fps: dentro do orçamento", () => {
    expect(frameWindowIsSlow(Array(30).fill(16.7))).toBe(false);
  });

  it("mediana acima do orçamento (~30 fps) estoura; abaixo, não", () => {
    expect(frameWindowIsSlow(Array(30).fill(FRAME_BUDGET_MS + 3))).toBe(true);
    expect(frameWindowIsSlow(Array(30).fill(FRAME_BUDGET_MS - 3))).toBe(false);
  });

  it("um tranco isolado não decide (mediana, não média)", () => {
    const deltas = [...Array(29).fill(16.7), 400];
    expect(frameWindowIsSlow(deltas)).toBe(false);
  });

  it("sem amostras não desliga nada", () => {
    expect(frameWindowIsSlow([])).toBe(false);
  });
});
