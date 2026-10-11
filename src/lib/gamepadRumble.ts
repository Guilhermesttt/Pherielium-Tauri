/**
 * Teste de vibração pela Gamepad API (`dual-rumble`).
 *
 * Os controles têm DOIS motores: o forte (grave, "strong") e o fraco (agudo,
 * "weak"). Os modos são uma tabela de passos; o player só os executa em ordem.
 * A intensidade do perfil (0..1) multiplica tudo, então o teste mostra o que o
 * jogo sentiria com aquele ajuste e não um valor independente dele.
 */

export interface RumbleStep {
  /** Pausa antes deste passo, em ms. */
  gapMs: number;
  durationMs: number;
  /** Motor fraco (agudo), 0..1. */
  weak: number;
  /** Motor forte (grave), 0..1. */
  strong: number;
}

export type RumbleModeId = "heavy" | "light" | "burst" | "pulse";

export interface RumbleMode {
  label: string;
  hint: string;
  steps: readonly RumbleStep[];
}

const ramp = (from: number, to: number, count: number, durationMs: number): RumbleStep[] =>
  Array.from({ length: count }, (_, i) => {
    const level = from + ((to - from) * i) / Math.max(1, count - 1);
    return { gapMs: 0, durationMs, weak: level, strong: level };
  });

export const RUMBLE_MODES: Record<RumbleModeId, RumbleMode> = {
  heavy: {
    label: "Pesado",
    hint: "Motor grave no máximo, agudo moderado.",
    steps: [{ gapMs: 0, durationMs: 700, weak: 0.4, strong: 1 }],
  },
  light: {
    label: "Leve",
    hint: "Só o motor agudo, suave.",
    steps: [{ gapMs: 0, durationMs: 700, weak: 0.7, strong: 0 }],
  },
  burst: {
    label: "Rajada",
    hint: "Três toques secos.",
    steps: [
      { gapMs: 0, durationMs: 180, weak: 1, strong: 1 },
      { gapMs: 140, durationMs: 180, weak: 1, strong: 1 },
      { gapMs: 140, durationMs: 180, weak: 1, strong: 1 },
    ],
  },
  pulse: {
    label: "Pulso",
    hint: "Sobe devagar até o máximo.",
    steps: ramp(0.15, 1, 8, 110),
  },
};

export const RUMBLE_MODE_IDS = Object.keys(RUMBLE_MODES) as RumbleModeId[];

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

/** Aplica a intensidade do perfil a um passo, sem sair de 0..1. */
export const scaleStep = (step: RumbleStep, intensity: number): RumbleStep => {
  const k = clamp01(intensity);
  return { ...step, weak: clamp01(step.weak * k), strong: clamp01(step.strong * k) };
};

export const totalDurationMs = (steps: ReadonlyArray<RumbleStep>): number =>
  steps.reduce((sum, s) => sum + s.gapMs + s.durationMs, 0);

/** O mínimo do atuador que usamos; é o que dá para trocar por um falso nos testes. */
export interface DualRumbleActuator {
  playEffect: (
    type: "dual-rumble",
    params: { startDelay: number; duration: number; weakMagnitude: number; strongMagnitude: number },
  ) => Promise<unknown>;
  reset?: () => Promise<unknown>;
}

/** O atuador do controle, ou `null` quando ele não vibra ou o navegador não suporta. */
export function actuatorOf(pad: Gamepad | null | undefined): DualRumbleActuator | null {
  const actuator = pad?.vibrationActuator as unknown as DualRumbleActuator | null | undefined;
  return actuator && typeof actuator.playEffect === "function" ? actuator : null;
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (ms <= 0 || signal?.aborted) return resolve();
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });

export type RumbleOutcome = "completed" | "aborted" | "failed";

/**
 * Executa os passos em ordem. `signal` interrompe: o passo em curso é cortado
 * (`reset`) e nenhum passo seguinte é tocado.
 */
export async function playRumble(
  actuator: DualRumbleActuator,
  steps: ReadonlyArray<RumbleStep>,
  intensity: number,
  signal?: AbortSignal,
): Promise<RumbleOutcome> {
  try {
    for (const raw of steps) {
      if (signal?.aborted) break;
      const step = scaleStep(raw, intensity);
      await sleep(step.gapMs, signal);
      if (signal?.aborted) break;
      await actuator.playEffect("dual-rumble", {
        startDelay: 0,
        duration: step.durationMs,
        weakMagnitude: step.weak,
        strongMagnitude: step.strong,
      });
    }
  } catch {
    // O controle foi desconectado no meio, ou o motor recusou o efeito.
    return "failed";
  }
  if (signal?.aborted) {
    await actuator.reset?.().catch(() => undefined);
    return "aborted";
  }
  return "completed";
}

/** Um passo contínuo para o controle manual (motor fraco e forte separados). */
export const manualStep = (weak: number, strong: number, durationMs: number): RumbleStep => ({
  gapMs: 0,
  durationMs,
  weak: clamp01(weak),
  strong: clamp01(strong),
});
