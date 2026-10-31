import { describe, expect, it } from "vitest";
import {
  CLOSE_TRANSITION,
  HIDE_DELAY_MS,
  NOTCH_DROP_IN_SPRING,
  NOTCH_EXPAND_SPRING,
  NOTCH_HIDDEN_Y,
  NOTCH_REDUCED_TRANSITION,
  NOTCH_RETRACT_TRANSITION,
  OPEN_SPRING,
  geometryTransition,
  notchPositionTransition,
  springFromResponse,
} from "./motion";

describe("motion do notch", () => {
  it("converte response/damping estilo SwiftUI em rigidez e amortecimento", () => {
    const s = springFromResponse(0.5, 0.72);
    expect(s.stiffness).toBeCloseTo(157.91, 1);
    expect(s.damping).toBeCloseTo(18.1, 1);
    expect(s.mass).toBe(1);
  });

  const ratio = (s: { stiffness: number; damping: number; mass: number }) => s.damping / (2 * Math.sqrt(s.stiffness * s.mass));

  it("a mola de surgimento quica (subamortecida) e a de recolher não passa do topo", () => {
    expect(ratio(NOTCH_DROP_IN_SPRING)).toBeLessThan(0.75);
    expect(ratio(NOTCH_DROP_IN_SPRING)).toBeGreaterThan(0.5);
    expect(ratio(NOTCH_RETRACT_TRANSITION)).toBeGreaterThanOrEqual(1);
    // a expansão é macia: no máximo um tremor, nada de balanço
    expect(ratio(NOTCH_EXPAND_SPRING)).toBeGreaterThan(0.75);
    expect(OPEN_SPRING).toBe(NOTCH_EXPAND_SPRING);
    expect(CLOSE_TRANSITION.type).toBe("tween");
    expect(CLOSE_TRANSITION.duration).toBeCloseTo(0.34);
  });

  it("cresce com a mola de expansão e encolhe com a amortecida", () => {
    expect(geometryTransition(true)).toBe(NOTCH_EXPAND_SPRING);
    expect(geometryTransition(false)).toBe(NOTCH_RETRACT_TRANSITION);
  });

  it("esconde com atraso e mola amortecida; aparece com a de overshoot", () => {
    expect(notchPositionTransition(false)).toBe(NOTCH_DROP_IN_SPRING);
    expect(notchPositionTransition(true)).toMatchObject({ ...NOTCH_RETRACT_TRANSITION, delay: HIDE_DELAY_MS / 1000 });
    expect(NOTCH_HIDDEN_Y).toBeLessThan(0);
  });

  it("com reduzir movimento não há mola nem overshoot", () => {
    expect(geometryTransition(true, true)).toBe(NOTCH_REDUCED_TRANSITION);
    expect(notchPositionTransition(false, true).type).toBe("tween");
    expect(notchPositionTransition(true, true).type).toBe("tween");
  });
});
