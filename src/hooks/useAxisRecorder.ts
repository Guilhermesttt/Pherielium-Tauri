import { useCallback, useEffect, useRef, useState } from "react";
import type { AxisSample } from "../lib/stickAnalysis";
import { acquireLauncherInputLock } from "../utils/launcherInputLock";

export type StickSide = "left" | "right";

export type RecorderStatus = "idle" | "running" | "done";

export interface RecorderState {
  status: RecorderStatus;
  stick: StickSide;
  elapsedMs: number;
  samples: AxisSample[];
}

const INITIAL: RecorderState = { status: "idle", stick: "left", elapsedMs: 0, samples: [] };

/** O quanto a tela se atualiza durante a gravação; o amostrador roda por quadro. */
const UI_REFRESH_MS = 100;
/** Teto de amostras guardadas: uma volta de stick não precisa de mais que isso. */
const MAX_SAMPLES = 6000;

/**
 * Grava os eixos CRUS de um stick a cada quadro (sem zona morta), para os testes
 * de drift e de circularidade.
 *
 * Enquanto grava, segura uma concessão do bloqueio de entrada do launcher: mexer
 * no stick para o teste também moveria o foco do launcher. A concessão é
 * devolvida ao parar, ao terminar sozinho (`durationMs`) e ao desmontar.
 */
export function useAxisRecorder(getPad: () => Gamepad | null) {
  const [state, setState] = useState<RecorderState>(INITIAL);

  const samplesRef = useRef<AxisSample[]>([]);
  const rafRef = useRef(0);
  const releaseRef = useRef<(() => void) | null>(null);
  const startedAtRef = useRef(0);
  const lastUiRef = useRef(0);

  const halt = useCallback(() => {
    window.cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    releaseRef.current?.();
    releaseRef.current = null;
  }, []);

  const publish = useCallback((status: RecorderStatus, stick: StickSide, now: number) => {
    setState({
      status,
      stick,
      elapsedMs: now - startedAtRef.current,
      samples: samplesRef.current.slice(),
    });
  }, []);

  const start = useCallback(
    (stick: StickSide, durationMs?: number) => {
      halt();
      samplesRef.current = [];
      startedAtRef.current = performance.now();
      lastUiRef.current = 0;
      releaseRef.current = acquireLauncherInputLock();
      const base = stick === "left" ? 0 : 2;
      publish("running", stick, startedAtRef.current);

      const tick = (now: number) => {
        const pad = getPad();
        if (pad) {
          const x = pad.axes[base];
          const y = pad.axes[base + 1];
          if (samplesRef.current.length < MAX_SAMPLES) {
            samplesRef.current.push({ x: Number.isFinite(x) ? x : 0, y: Number.isFinite(y) ? y : 0 });
          }
        }
        const elapsed = now - startedAtRef.current;
        if (durationMs !== undefined && elapsed >= durationMs) {
          halt();
          publish("done", stick, now);
          return;
        }
        if (now - lastUiRef.current >= UI_REFRESH_MS) {
          lastUiRef.current = now;
          publish("running", stick, now);
        }
        rafRef.current = window.requestAnimationFrame(tick);
      };
      rafRef.current = window.requestAnimationFrame(tick);
    },
    [getPad, halt, publish],
  );

  /** Conclui uma gravação manual (circularidade) mantendo o que foi gravado. */
  const finish = useCallback(() => {
    if (rafRef.current === 0) return;
    halt();
    publish("done", state.stick, performance.now());
  }, [halt, publish, state.stick]);

  const reset = useCallback(() => {
    halt();
    samplesRef.current = [];
    setState((s) => ({ ...INITIAL, stick: s.stick }));
  }, [halt]);

  useEffect(() => halt, [halt]);

  return { state, start, finish, reset };
}
