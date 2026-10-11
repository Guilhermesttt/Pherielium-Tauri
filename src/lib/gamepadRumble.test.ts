import { describe, expect, it } from "vitest";
import {
  RUMBLE_MODES,
  RUMBLE_MODE_IDS,
  actuatorOf,
  manualStep,
  playRumble,
  scaleStep,
  totalDurationMs,
  type DualRumbleActuator,
  type RumbleStep,
} from "./gamepadRumble";

interface Call {
  duration: number;
  weak: number;
  strong: number;
}

const fakeActuator = (opts: { failOn?: number; hold?: boolean } = {}) => {
  const calls: Call[] = [];
  let resets = 0;
  const actuator: DualRumbleActuator = {
    playEffect: async (_type, p) => {
      if (opts.failOn !== undefined && calls.length === opts.failOn) throw new Error("desconectado");
      calls.push({ duration: p.duration, weak: p.weakMagnitude, strong: p.strongMagnitude });
      if (opts.hold) await new Promise((r) => setTimeout(r, 30));
      return "complete";
    },
    reset: async () => {
      resets += 1;
    },
  };
  return { actuator, calls, resets: () => resets };
};

const fast = (n: number): RumbleStep[] =>
  Array.from({ length: n }, () => ({ gapMs: 0, durationMs: 1, weak: 1, strong: 1 }));

describe("modos de vibração", () => {
  it("são os quatro do tester, e todo passo fica em 0..1", () => {
    expect(RUMBLE_MODE_IDS).toEqual(["heavy", "light", "burst", "pulse"]);
    for (const id of RUMBLE_MODE_IDS) {
      const mode = RUMBLE_MODES[id];
      expect(mode.steps.length, id).toBeGreaterThan(0);
      for (const s of mode.steps) {
        expect(s.weak, id).toBeGreaterThanOrEqual(0);
        expect(s.weak, id).toBeLessThanOrEqual(1);
        expect(s.strong, id).toBeGreaterThanOrEqual(0);
        expect(s.strong, id).toBeLessThanOrEqual(1);
        expect(s.durationMs, id).toBeGreaterThan(0);
      }
    }
  });

  it("pesado usa mais o motor grave; leve só o agudo", () => {
    const heavy = RUMBLE_MODES.heavy.steps[0];
    const light = RUMBLE_MODES.light.steps[0];
    expect(heavy.strong).toBeGreaterThan(heavy.weak);
    expect(light.strong).toBe(0);
    expect(light.weak).toBeGreaterThan(0);
  });

  it("rajada tem 3 toques com pausa entre eles", () => {
    const burst = RUMBLE_MODES.burst.steps;
    expect(burst).toHaveLength(3);
    expect(burst[0].gapMs).toBe(0);
    expect(burst[1].gapMs).toBeGreaterThan(0);
  });

  it("pulso só sobe", () => {
    const levels = RUMBLE_MODES.pulse.steps.map((s) => s.strong);
    expect(levels.every((v, i) => i === 0 || v > levels[i - 1])).toBe(true);
    expect(levels[levels.length - 1]).toBe(1);
  });

  it("totalDurationMs soma pausas e toques", () => {
    expect(totalDurationMs(RUMBLE_MODES.burst.steps)).toBe(180 * 3 + 140 * 2);
  });
});

describe("scaleStep", () => {
  const step: RumbleStep = { gapMs: 5, durationMs: 100, weak: 0.5, strong: 1 };

  it("multiplica pela intensidade do perfil e preserva o tempo", () => {
    expect(scaleStep(step, 0.5)).toEqual({ gapMs: 5, durationMs: 100, weak: 0.25, strong: 0.5 });
  });

  it("intensidade 0 silencia; 1 mantém", () => {
    expect(scaleStep(step, 0)).toMatchObject({ weak: 0, strong: 0 });
    expect(scaleStep(step, 1)).toMatchObject({ weak: 0.5, strong: 1 });
  });

  it("intensidade fora da faixa ou NaN não estoura o limite do motor", () => {
    expect(scaleStep(step, 9).strong).toBe(1);
    expect(scaleStep(step, -3).strong).toBe(0);
    expect(scaleStep(step, Number.NaN).strong).toBe(0);
  });
});

describe("playRumble", () => {
  it("toca todos os passos na ordem, com as magnitudes escaladas", async () => {
    const { actuator, calls } = fakeActuator();
    const out = await playRumble(actuator, RUMBLE_MODES.pulse.steps, 0.5);
    expect(out).toBe("completed");
    expect(calls).toHaveLength(RUMBLE_MODES.pulse.steps.length);
    expect(calls[calls.length - 1].strong).toBeCloseTo(0.5, 5); // 1.0 × 0.5
    expect(calls[0].strong).toBeLessThan(calls[calls.length - 1].strong);
  });

  it("abortar no meio corta o passo, chama reset e não toca os seguintes", async () => {
    const { actuator, calls, resets } = fakeActuator({ hold: true });
    const controller = new AbortController();
    const running = playRumble(actuator, fast(10), 1, controller.signal);
    await new Promise((r) => setTimeout(r, 40));
    controller.abort();
    expect(await running).toBe("aborted");
    expect(calls.length).toBeLessThan(10);
    expect(resets()).toBe(1);
  });

  it("já abortado antes de começar não toca nada", async () => {
    const { actuator, calls } = fakeActuator();
    const controller = new AbortController();
    controller.abort();
    expect(await playRumble(actuator, fast(3), 1, controller.signal)).toBe("aborted");
    expect(calls).toHaveLength(0);
  });

  it("controle desconectado no meio vira 'failed', não exceção", async () => {
    const { actuator, calls } = fakeActuator({ failOn: 1 });
    expect(await playRumble(actuator, fast(4), 1)).toBe("failed");
    expect(calls).toHaveLength(1);
  });

  it("a pausa (gapMs) é respeitada entre os passos", async () => {
    const { actuator } = fakeActuator();
    const t0 = performance.now();
    await playRumble(
      actuator,
      [
        { gapMs: 0, durationMs: 1, weak: 1, strong: 1 },
        { gapMs: 60, durationMs: 1, weak: 1, strong: 1 },
      ],
      1,
    );
    expect(performance.now() - t0).toBeGreaterThanOrEqual(55);
  });
});

describe("actuatorOf / manualStep", () => {
  it("controle sem atuador ou sem playEffect devolve null", () => {
    expect(actuatorOf(null)).toBeNull();
    expect(actuatorOf({ vibrationActuator: null } as unknown as Gamepad)).toBeNull();
    expect(actuatorOf({ vibrationActuator: {} } as unknown as Gamepad)).toBeNull();
  });

  it("controle com playEffect devolve o atuador", () => {
    const { actuator } = fakeActuator();
    expect(actuatorOf({ vibrationActuator: actuator } as unknown as Gamepad)).toBe(actuator);
  });

  it("os dois motores do passo manual são independentes e limitados", () => {
    expect(manualStep(0.2, 0.9, 500)).toMatchObject({ weak: 0.2, strong: 0.9, durationMs: 500 });
    expect(manualStep(5, -1, 500)).toMatchObject({ weak: 1, strong: 0 });
  });
});
