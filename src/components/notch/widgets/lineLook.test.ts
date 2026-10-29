import { describe, expect, it } from "vitest";
import { lineLook } from "./NotchWidgets";

describe("lineLook", () => {
  it("a linha em curso fica nítida e as outras se apagam com a distância", () => {
    expect(lineLook(0)).toEqual({ opacity: 1, blur: 0 });
    const steps = [0, 1, 2, 3].map((d) => lineLook(d));
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i].opacity).toBeLessThan(steps[i - 1].opacity);
      expect(steps[i].blur).toBeGreaterThan(steps[i - 1].blur);
    }
  });

  it("linhas muito distantes somem (e não pagam o custo do desfoque)", () => {
    expect(lineLook(9)).toEqual({ opacity: 0, blur: 0 });
  });
});
