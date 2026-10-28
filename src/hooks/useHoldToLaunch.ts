import { useCallback, useEffect, useRef, useState } from "react";
import { playHapticPattern, playRumble } from "../context/GamepadContext";
import { HOLD_RUMBLE_TICK_MS, holdProgress, rumbleForProgress } from "../components/game-detail/holdToLaunch";

/** Índice do botão de confirmar (X no PlayStation, A no Xbox) no mapeamento padrão da Gamepad API. */
const CONFIRM_BUTTON_INDEX = 0;

interface UseHoldToLaunchOptions {
  onComplete: () => void;
  /** Falso trava tudo (jogo abrindo, menu aberto, outra aba...). */
  enabled: boolean;
  /** Decide se o botão do controle pode começar a segurar agora (ex.: sem foco em outro controle da tela). */
  canStartFromGamepad: () => boolean;
}

type HoldSource = "pointer" | "gamepad";

/**
 * "Segure para iniciar": o progresso sobe enquanto o mouse, Enter/Espaço ou o botão de confirmar
 * do controle ficam pressionados e zera se soltar antes do fim. No controle, vibra mais forte
 * conforme a barra enche.
 */
export function useHoldToLaunch({ onComplete, enabled, canStartFromGamepad }: UseHoldToLaunchOptions) {
  const [progress, setProgress] = useState(0);
  const [source, setSource] = useState<HoldSource | null>(null);
  const sourceRef = useRef<HoldSource | null>(null);
  const startedAt = useRef<number | null>(null);
  const frame = useRef(0);
  const lastRumble = useRef(0);
  const completed = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const canStartRef = useRef(canStartFromGamepad);
  const tickRef = useRef<FrameRequestCallback>(() => undefined);
  useEffect(() => {
    onCompleteRef.current = onComplete;
    canStartRef.current = canStartFromGamepad;
  });

  const cancelHold = useCallback(() => {
    startedAt.current = null;
    sourceRef.current = null;
    completed.current = false;
    cancelAnimationFrame(frame.current);
  }, []);

  const stop = useCallback(() => {
    cancelHold();
    setSource(null);
    setProgress(0);
  }, [cancelHold]);

  const tick = useCallback((now: number) => {
    if (startedAt.current === null) return;
    const value = holdProgress(now - startedAt.current);
    setProgress(value);
    if (value >= 1) {
      if (!completed.current) {
        completed.current = true;
        playHapticPattern("launch");
        onCompleteRef.current();
      }
      return;
    }
    if (now - lastRumble.current >= HOLD_RUMBLE_TICK_MS) {
      lastRumble.current = now;
      const { weak, strong } = rumbleForProgress(value);
      playRumble(weak, strong, HOLD_RUMBLE_TICK_MS + 30);
    }
    frame.current = requestAnimationFrame((t) => tickRef.current(t));
  }, []);

  useEffect(() => {
    tickRef.current = tick;
  }, [tick]);

  const start = useCallback(
    (from: HoldSource) => {
      if (!enabled || startedAt.current !== null) return;
      startedAt.current = performance.now();
      sourceRef.current = from;
      completed.current = false;
      lastRumble.current = 0;
      setSource(from);
      frame.current = requestAnimationFrame((t) => tickRef.current(t));
    },
    [enabled],
  );

  // Desabilitar no meio do gesto (jogo abrindo, troca de aba) cancela a barra.
  const [wasEnabled, setWasEnabled] = useState(enabled);
  if (wasEnabled !== enabled) {
    setWasEnabled(enabled);
    if (!enabled) {
      setSource(null);
      setProgress(0);
    }
  }
  useEffect(() => {
    if (!enabled) cancelHold();
  }, [enabled, cancelHold]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  // O hook de botões do controle só avisa o aperto; o "segurando" é lido por polling.
  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    let wasDown = false;
    const poll = () => {
      const pads = navigator.getGamepads ? Array.from(navigator.getGamepads()) : [];
      const down = pads.some((pad) => pad?.buttons[CONFIRM_BUTTON_INDEX]?.pressed);
      if (down && !wasDown && canStartRef.current()) start("gamepad");
      if (!down && wasDown && sourceRef.current === "gamepad") stop();
      wasDown = down;
      raf = requestAnimationFrame(poll);
    };
    raf = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(raf);
  }, [enabled, start, stop]);

  const pointerHandlers = {
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
      if (event.button !== 0) return;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      start("pointer");
    },
    onPointerUp: () => {
      if (sourceRef.current === "pointer") stop();
    },
    onPointerCancel: stop,
    onKeyDown: (event: React.KeyboardEvent) => {
      if ((event.key === "Enter" || event.key === " ") && !event.repeat) {
        event.preventDefault();
        start("pointer");
      }
    },
    onKeyUp: (event: React.KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") stop();
    },
    onBlur: stop,
  };

  return { progress, holding: source !== null, pointerHandlers };
}
