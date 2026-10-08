import { describe, expect, it } from "vitest";
import { CLOSE_TRANSITION, OPEN_SPRING, geometryTransition, springFromResponse } from "./motion";

describe("motion do notch", () => {
  it("converte response/damping estilo SwiftUI em rigidez e amortecimento", () => {
    const s = springFromResponse(0.5, 0.72);
    expect(s.stiffness).toBeCloseTo(157.91, 1);
    expect(s.damping).toBeCloseTo(18.1, 1);
    expect(s.mass).toBe(1);
  });

  it("a mola de abertura é subamortecida (leve overshoot) e a de fechar não quica", () => {
    const critical = 2 * Math.sqrt(OPEN_SPRING.stiffness * OPEN_SPRING.mass);
    expect(OPEN_SPRING.damping).toBeLessThan(critical);
    expect(CLOSE_TRANSITION.type).toBe("tween");
    expect(CLOSE_TRANSITION.duration).toBeCloseTo(0.34);
  });

  it("cresce com mola e encolhe com curva", () => {
    expect(geometryTransition(true)).toBe(OPEN_SPRING);
    expect(geometryTransition(false)).toBe(CLOSE_TRANSITION);
  });
});
