import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import { resetCachedLedDevice } from "../services/controllerLed";
import { isLauncherInputLocked } from "../utils/launcherInputLock";

import {
  type ControllerConnectionType,
} from "../services/controllerBatteryService";

export type InputType = "mouse" | "keyboard" | "gamepad";
export type GamepadFamily = "playstation" | "xbox" | "generic";
export type { ControllerConnectionType };

interface GamepadContextValue {
  activeInputType: InputType;
  isGamepadConnected: boolean;
  gamepadFamily: GamepadFamily;
  connectedGamepadId: string | null;
  batteryLevel: number | null;
  batteryCharging: boolean;
  connectionType: ControllerConnectionType;
  isLowBattery: boolean;
}

const GamepadContext = createContext<GamepadContextValue | null>(null);

export type GamepadButtonName =
  | "X" | "O" | "SQUARE" | "TRIANGLE"
  | "L1" | "R1" | "L2" | "R2"
  | "L3" | "R3"
  | "SHARE" | "OPTIONS" | "GUIDE"
  | "DPAD_UP" | "DPAD_DOWN" | "DPAD_LEFT" | "DPAD_RIGHT";

// D-pad (12-15) NÃO entra aqui: é tratado exclusivamente pelo loop `dpadButtons`
// mais abaixo. Antes ele também caía nesse mapa e era disparado pelo loop
// genérico de botões — resultado: cada toque no D-pad disparava o evento
// DUAS vezes no mesmo frame (era esse o bug do "pula um item").
const BUTTON_MAP: Record<number, GamepadButtonName> = {
  0: "X",
  1: "O",
  2: "SQUARE",
  3: "TRIANGLE",
  4: "L1",
  5: "R1",
  6: "L2",
  7: "R2",
  8: "SHARE",
  9: "OPTIONS",
  10: "L3",
  11: "R3",
  16: "GUIDE",
};

// Task 1: DEDICATED_BUTTON_INDEXES é derivado automaticamente do BUTTON_MAP
// para nunca desatualizar caso o mapa seja modificado.
// Triggers (L2/R2 = 6,7) e D-pad (12-15) têm loops dedicados e são excluídos do genérico.
const DPAD_BUTTON_INDEXES = new Set([12, 13, 14, 15]);
const DEDICATED_BUTTON_INDEXES = (() => {
  const dedicated = new Set<number>(DPAD_BUTTON_INDEXES);
  for (const [idx, name] of Object.entries(BUTTON_MAP)) {
    if (((["L2", "R2"] as GamepadButtonName[]) as string[]).includes(name)) {
      dedicated.add(Number(idx));
    }
  }
  return dedicated;
})();

interface GamepadButtonSubscriber {
  id: symbol;
  callback: () => void;
  priority: number;
}

const gamepadButtonSubscribers = new Map<GamepadButtonName, Set<GamepadButtonSubscriber>>();

export function detectGamepadFamily(id: string): GamepadFamily {
  const lower = id.toLowerCase();
  if (
    lower.includes("xbox") ||
    lower.includes("045e") ||
    lower.includes("xinput")
  ) {
    return "xbox";
  }
  if (
    lower.includes("dualsense") ||
    lower.includes("dualshock") ||
    lower.includes("wireless controller") ||
    lower.includes("054c") ||
    lower.includes("playstation") ||
    lower.includes("ps5") ||
    lower.includes("ps4")
  ) {
    return "playstation";
  }
  return "generic";
}

// Task 4: Trigger normalizado — ambas as fontes (button + axis) em escala 0-1 consistente
function readTriggerValue(gp: Gamepad, side: "L2" | "R2"): number {
  const buttonIndex = side === "L2" ? 6 : 7;
  const axisIndex = side === "L2" ? 4 : 5;
  // Clamp explícito para garantir escala 0-1 (alguns drivers reportam fora do range)
  const buttonValue = Math.max(0, Math.min(1, gp.buttons[buttonIndex]?.value ?? 0));
  // Eixo pode ser negativo em repouso num driver — descarta negativo
  const axisValue = Math.max(0, gp.axes[axisIndex] ?? 0);
  return Math.max(buttonValue, axisValue);
}

const isPressed = (button: GamepadButton | undefined) =>
  Boolean(button?.pressed || (button?.value ?? 0) > 0.5);

const isGamepadOverlayTogglePressed = (gamepad: Gamepad) =>
  isPressed(gamepad.buttons[16])
  || (isPressed(gamepad.buttons[8]) && isPressed(gamepad.buttons[9]));

// ─── Feedback háptico (vibração) ─────────────────────────────────────────────
type HapticPatternName = "nav" | "action" | "launch";

interface HapticStep {
  delay: number;
  duration: number;
  weakMagnitude: number;
  strongMagnitude: number;
}

const HAPTIC_PATTERNS: Record<HapticPatternName, HapticStep[]> = {
  nav: [{ delay: 0, duration: 28, weakMagnitude: 0.12, strongMagnitude: 0 }],
  action: [{ delay: 0, duration: 45, weakMagnitude: 0.22, strongMagnitude: 0.08 }],
  launch: [
    { delay: 0, duration: 60, weakMagnitude: 0.15, strongMagnitude: 0 },
    { delay: 150, duration: 60, weakMagnitude: 0.28, strongMagnitude: 0.10 },
    { delay: 300, duration: 260, weakMagnitude: 0.38, strongMagnitude: 0.55 },
  ],
};

// Task 11: Validação runtime dos padrões hápticos (sem Zod como dep extra)
if (import.meta.env.DEV) {
  for (const [patternName, steps] of Object.entries(HAPTIC_PATTERNS)) {
    for (const [i, step] of steps.entries()) {
      const errors: string[] = [];
      if (step.delay < 0 || step.delay > 5000) errors.push(`delay ${step.delay} fora de [0,5000]`);
      if (step.duration < 10 || step.duration > 1000) errors.push(`duration ${step.duration} fora de [10,1000]`);
      if (step.weakMagnitude < 0 || step.weakMagnitude > 1) errors.push(`weakMagnitude ${step.weakMagnitude} fora de [0,1]`);
      if (step.strongMagnitude < 0 || step.strongMagnitude > 1) errors.push(`strongMagnitude ${step.strongMagnitude} fora de [0,1]`);
      if (errors.length) {
        console.error(`[HapticPatterns] Padrão '${patternName}' step[${i}] inválido:`, errors);
      }
    }
  }
}

const isHapticsEnabledGlobal = (): boolean => {
  try {
    const v = localStorage.getItem("checkpoint_haptics_enabled_global");
    return v !== "false";
  } catch { return true; }
};

const getHapticActuator = (gp: Gamepad) =>
  (gp as unknown as { vibrationActuator?: { playEffect: (type: string, params: object) => Promise<unknown> } })
    .vibrationActuator;

const playPatternOnGamepad = (gp: Gamepad, steps: HapticStep[]) => {
  if (!isHapticsEnabledGlobal()) return;
  const actuator = getHapticActuator(gp);
  if (!actuator?.playEffect) return;

  steps.forEach((step) => {
    window.setTimeout(() => {
      actuator.playEffect("dual-rumble", {
        startDelay: 0,
        duration: step.duration,
        weakMagnitude: step.weakMagnitude,
        strongMagnitude: step.strongMagnitude,
      }).catch(() => undefined);
    }, step.delay);
  });
};

const fireHaptic = (gp: Gamepad, kind: "nav" | "action" = "nav") => {
  playPatternOnGamepad(gp, HAPTIC_PATTERNS[kind]);
};

export const playHapticPattern = (pattern: HapticPatternName) => {
  const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
  Array.from(gamepads)
    .filter((gp): gp is Gamepad => gp !== null)
    .forEach((gp) => playPatternOnGamepad(gp, HAPTIC_PATTERNS[pattern]));
};

// ─── Aceleração progressiva do analógico ────────────────────────────────────
const AXIS_INITIAL_DELAY = 320;
const AXIS_FAST_INTERVAL = 80;
const AXIS_ACCEL_STEPS = 5;
const AXIS_DEADZONE = 0.28;

interface AxisState {
  direction: "up" | "down" | "left" | "right" | null;
  heldSince: number;
  lastFire: number;
  repeatCount: number;
}

export const GamepadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeInputType, setActiveInputType] = useState<InputType>("mouse");
  const [isGamepadConnected, setIsGamepadConnected] = useState(false);
  const [gamepadFamily, setGamepadFamily] = useState<GamepadFamily>("generic");
  const [connectedGamepadId, setConnectedGamepadId] = useState<string | null>(null);

  const [batteryState, setBatteryState] = useState({
    batteryLevel: null as number | null,
    isCharging: false,
    connectionType: "unknown" as ControllerConnectionType,
    isLowBattery: false,
  });

  const [overlayHasFocus, setOverlayHasFocus] = useState(false);
  const overlayFocusRef = useRef(false); // CORREÇÃO: Ref para manter o valor atualizado no pollGamepads

  const requestRef = useRef<number>(0);
  const lastButtonState = useRef<Record<string, boolean>>({});
  const lastGuideToggle = useRef<number>(0);
  const axisState = useRef<Record<"h" | "v", AxisState>>({
    h: { direction: null, heldSince: 0, lastFire: 0, repeatCount: 0 },
    v: { direction: null, heldSince: 0, lastFire: 0, repeatCount: 0 },
  });
  const lastRightStickWasActive = useRef(false);
  // Task 12: Rastreia última posição do stick direito para threshold de mudança
  const lastRightStickXRef = useRef(0);
  const lastRightStickYRef = useRef(0);
  // Task 9: Rastreia último input para smart polling idle
  const lastInputTimeRef = useRef(performance.now());

  const activeInputRef = useRef<InputType>("mouse");
  activeInputRef.current = activeInputType;
  const isConnectedRef = useRef(false);
  isConnectedRef.current = isGamepadConnected;
  const connectedIdRef = useRef<string | null>(null);
  connectedIdRef.current = connectedGamepadId;

  // Listener para foco do overlay via IPC do Electron e CustomEvent
  React.useEffect(() => {
    const unbind = window.electronAPI?.onOverlayHubInputLock?.((payload: { locked: boolean }) => {
      const isLocked = Boolean(payload?.locked);
      setOverlayHasFocus(isLocked);
      overlayFocusRef.current = isLocked;
    });

    const handleOverlayFocus = (event: CustomEvent) => {
      const hasFocus = Boolean(event.detail?.hasFocus);
      setOverlayHasFocus(hasFocus);
      overlayFocusRef.current = hasFocus;
    };
    window.addEventListener("checkpoint:overlay-focus-changed", handleOverlayFocus as EventListener);
    return () => {
      unbind?.();
      window.removeEventListener("checkpoint:overlay-focus-changed", handleOverlayFocus as EventListener);
    };
  }, []);

  React.useEffect(() => {
    if (overlayHasFocus) {
      setActiveInputType("mouse");
    }
  }, [overlayHasFocus]);

  const handleGamepadConnected = useCallback((e: GamepadEvent) => {
    setIsGamepadConnected(true);
    setConnectedGamepadId(e.gamepad.id);
    setGamepadFamily(detectGamepadFamily(e.gamepad.id));
    setActiveInputType("gamepad");
  }, []);

  const handleGamepadDisconnected = useCallback((event: GamepadEvent) => {
    if (connectedIdRef.current && event.gamepad.id !== connectedIdRef.current) return;
    setIsGamepadConnected(false);
    setConnectedGamepadId(null);
    setGamepadFamily("generic");
    setActiveInputType("mouse");
    lastButtonState.current = {};
    axisState.current.h = { direction: null, heldSince: 0, lastFire: 0, repeatCount: 0 };
    axisState.current.v = { direction: null, heldSince: 0, lastFire: 0, repeatCount: 0 };
    resetCachedLedDevice();
  }, []);

  const dispatchButtonPress = useCallback((buttonName: GamepadButtonName) => {
    if (isLauncherInputLocked()) return;
    const subscribers = Array.from(gamepadButtonSubscribers.get(buttonName) ?? []);
    if (subscribers.length === 0) return;

    const highestPriority = Math.max(...subscribers.map((s) => s.priority));
    subscribers
      .filter((s) => s.priority === highestPriority)
      .forEach((s) => s.callback());
  }, []);

  const getRepeatInterval = (repeatCount: number): number => {
    const t = Math.min(repeatCount / AXIS_ACCEL_STEPS, 1);
    return AXIS_INITIAL_DELAY + (AXIS_FAST_INTERVAL - AXIS_INITIAL_DELAY) * t;
  };

  const pollGamepads = useCallback(() => {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    const connectedGamepads = Array.from(gamepads).filter(
      (gp): gp is Gamepad => gp !== null,
    );

    const activeGamepad =
      connectedGamepads.find((gp) => gp.id === connectedIdRef.current) ??
      connectedGamepads[0] ??
      null;

    const gamepadFound = activeGamepad !== null;
    const now = performance.now();

    // ── Overlay toggle ──────────────────────────────
    connectedGamepads.forEach((gp) => {
      const isOverlayToggle = isGamepadOverlayTogglePressed(gp);
      const stateKey = `${gp.index}:overlay-toggle`;
      const wasPressed = lastButtonState.current[stateKey];
      const outsideCooldown = lastGuideToggle.current === 0 || now - lastGuideToggle.current > 650;

      if (isOverlayToggle && !wasPressed && outsideCooldown) {
        lastGuideToggle.current = now;

        // CORREÇÃO: Evita crash caso a chamada seja síncrona ou undefined
        try {
          const res = window.electronAPI?.toggleOverlayPanel();
          if (res && typeof res.catch === 'function') {
            res.catch(() => undefined);
          }
        } catch (error) {
          console.error("Erro ao alternar overlay:", error);
        }
      }
      lastButtonState.current[stateKey] = isOverlayToggle;
    });

    // CORREÇÃO: Usando `overlayFocusRef.current` no lugar do state travado no closure
    if (activeGamepad && document.hasFocus() && !overlayFocusRef.current) {
      const gp = activeGamepad;
      let inputDetected = false;

      gp.buttons.forEach((button, buttonIndex) => {
        if (DEDICATED_BUTTON_INDEXES.has(buttonIndex)) return;

        const pressed = button.pressed || button.value > 0.5;
        const stateKey = `${gp.index}:btn:${buttonIndex}`;
        const wasPressed = lastButtonState.current[stateKey];

        if (pressed && !wasPressed) {
          inputDetected = true;
          const name = BUTTON_MAP[buttonIndex];
          if (name) {
            dispatchButtonPress(name);
            fireHaptic(gp, "action");
          }
        }

        lastButtonState.current[stateKey] = pressed;
      });

      // ── Triggers analógicos (L2 / R2) ────────────────────────────────────
      (["L2", "R2"] as const).forEach((trigger) => {
        const value = readTriggerValue(gp, trigger);
        const pressed = value > 0.55;
        const stateKey = `${gp.index}:trigger:${trigger}`;
        const wasPressed = lastButtonState.current[stateKey];

        if (pressed && !wasPressed) {
          inputDetected = true;
          dispatchButtonPress(trigger);
          fireHaptic(gp, "action");
        }
        lastButtonState.current[stateKey] = pressed;
      });

      // ── D-pad físico ─────────────────────────────────────────────────────
      const dpadButtons: Array<[number, GamepadButtonName]> = [
        [12, "DPAD_UP"], [13, "DPAD_DOWN"], [14, "DPAD_LEFT"], [15, "DPAD_RIGHT"],
      ];
      let dpadActive = false;
      dpadButtons.forEach(([idx, name]) => {
        const pressed = gp.buttons[idx]?.pressed ?? false;
        const stateKey = `${gp.index}:dpad:${idx}`;
        const wasPressed = lastButtonState.current[stateKey];
        if (pressed && !wasPressed) {
          inputDetected = true;
          dispatchButtonPress(name);
          fireHaptic(gp, "nav");
        }
        lastButtonState.current[stateKey] = pressed;
        if (pressed) dpadActive = true;
      });

      // ── Analógico esquerdo ──────────────────────────────────────────────
      if (!dpadActive) {
        const xAxis = gp.axes[0] ?? 0;
        const yAxis = gp.axes[1] ?? 0;

        // Task 6: Deadzone circular — evita drift diagonal quando um eixo está na borda
        const magnitude = Math.sqrt(xAxis * xAxis + yAxis * yAxis);
        let nx = 0, ny = 0;
        if (magnitude >= AXIS_DEADZONE) {
          const scale = (magnitude - AXIS_DEADZONE) / (1 - AXIS_DEADZONE) / magnitude;
          nx = xAxis * scale;
          ny = yAxis * scale;
        }

        // Horizontal
        const hDir: "left" | "right" | null = nx < -0.1 ? "left" : nx > 0.1 ? "right" : null;
        const hState = axisState.current.h;

        if (hDir) {
          const btnName = hDir === "left" ? "DPAD_LEFT" : "DPAD_RIGHT";
          if (hState.direction !== hDir) {
            hState.direction = hDir;
            hState.heldSince = now;
            hState.lastFire = now;
            hState.repeatCount = 0;
            dispatchButtonPress(btnName);
            fireHaptic(gp, "nav");
            inputDetected = true;
          } else {
            const held = now - hState.heldSince;
            const interval = held < AXIS_INITIAL_DELAY
              ? AXIS_INITIAL_DELAY
              : getRepeatInterval(hState.repeatCount);
            if (now - hState.lastFire >= interval) {
              hState.lastFire = now;
              hState.repeatCount++;
              dispatchButtonPress(btnName);
              fireHaptic(gp, "nav");
              inputDetected = true;
            }
          }
        } else {
          hState.direction = null;
          hState.repeatCount = 0;
        }

        // Vertical
        const vDir: "up" | "down" | null = ny < -0.1 ? "up" : ny > 0.1 ? "down" : null;
        const vState = axisState.current.v;

        if (vDir) {
          const btnName = vDir === "up" ? "DPAD_UP" : "DPAD_DOWN";
          if (vState.direction !== vDir) {
            vState.direction = vDir;
            vState.heldSince = now;
            vState.lastFire = now;
            vState.repeatCount = 0;
            dispatchButtonPress(btnName);
            fireHaptic(gp, "nav");
            inputDetected = true;
          } else {
            const held = now - vState.heldSince;
            const interval = held < AXIS_INITIAL_DELAY
              ? AXIS_INITIAL_DELAY
              : getRepeatInterval(vState.repeatCount);
            if (now - vState.lastFire >= interval) {
              vState.lastFire = now;
              vState.repeatCount++;
              dispatchButtonPress(btnName);
              fireHaptic(gp, "nav");
              inputDetected = true;
            }
          }
        } else {
          vState.direction = null;
          vState.repeatCount = 0;
        }
      } else {
        axisState.current.h = { direction: null, heldSince: 0, lastFire: 0, repeatCount: 0 };
        axisState.current.v = { direction: null, heldSince: 0, lastFire: 0, repeatCount: 0 };
      }

      // ── Analógico direito ────────────────────────────────────────────────
      const rightX = gp.axes[2] ?? 0;
      const rightY = gp.axes[3] ?? 0;
      const RIGHT_DEADZONE = 0.2;
      const RIGHT_STICK_CHANGE_THRESHOLD = 0.05;

      // Task 6 (aplicado ao direito também): deadzone circular
      const rightMag = Math.sqrt(rightX * rightX + rightY * rightY);
      let nRightX = 0, nRightY = 0;
      if (rightMag >= RIGHT_DEADZONE) {
        const rightScale = (rightMag - RIGHT_DEADZONE) / (1 - RIGHT_DEADZONE) / rightMag;
        nRightX = rightX * rightScale;
        nRightY = rightY * rightScale;
      }
      const rightActive = nRightX !== 0 || nRightY !== 0;

      if (!isLauncherInputLocked()) {
        if (rightActive) {
          inputDetected = true;
          // Task 12: Só dispara evento se houve mudança acima do threshold
          const xChanged = Math.abs(nRightX - lastRightStickXRef.current) > RIGHT_STICK_CHANGE_THRESHOLD;
          const yChanged = Math.abs(nRightY - lastRightStickYRef.current) > RIGHT_STICK_CHANGE_THRESHOLD;
          if (xChanged || yChanged || !lastRightStickWasActive.current) {
            lastRightStickXRef.current = nRightX;
            lastRightStickYRef.current = nRightY;
            lastRightStickWasActive.current = true;
            window.dispatchEvent(
              new CustomEvent("gamepad:rightstick", {
                detail: { x: nRightX, y: nRightY },
              }),
            );
          }
        } else if (lastRightStickWasActive.current) {
          lastRightStickWasActive.current = false;
          lastRightStickXRef.current = 0;
          lastRightStickYRef.current = 0;
          window.dispatchEvent(
            new CustomEvent("gamepad:rightstick", {
              detail: { x: 0, y: 0 },
            }),
          );
        }
      }

      if (inputDetected && activeInputRef.current !== "gamepad") {
        setActiveInputType("gamepad");
      }
      // Task 9: Atualiza timestamp do último input DENTRO do bloco onde inputDetected é definido
      if (inputDetected) lastInputTimeRef.current = now;
    }

    if (gamepadFound && activeGamepad) {
      if (!isConnectedRef.current) {
        setIsGamepadConnected(true);
        setConnectedGamepadId(activeGamepad.id);
        setGamepadFamily(detectGamepadFamily(activeGamepad.id));
        setActiveInputType("gamepad");
      } else if (connectedIdRef.current !== activeGamepad.id) {
        setConnectedGamepadId(activeGamepad.id);
        setGamepadFamily(detectGamepadFamily(activeGamepad.id));
      }
    } else if (!gamepadFound && isConnectedRef.current) {
      setIsGamepadConnected(false);
      setConnectedGamepadId(null);
      setGamepadFamily("generic");
      lastButtonState.current = {};
      axisState.current.h = { direction: null, heldSince: 0, lastFire: 0, repeatCount: 0 };
      axisState.current.v = { direction: null, heldSince: 0, lastFire: 0, repeatCount: 0 };
      resetCachedLedDevice();
      if (activeInputRef.current === "gamepad") {
        setActiveInputType("mouse");
      }
    }

    // Task 9: Smart polling — reduz para 10 FPS quando sem input por 2s
    const IDLE_TIMEOUT_MS = 2000;
    const isIdle = now - lastInputTimeRef.current > IDLE_TIMEOUT_MS;

    if (gamepadFound && document.hasFocus()) {
      if (isIdle) {
        // Idle mode: 10 FPS (~100ms) poupa CPU sem prejudicar responsividade perceptível
        requestRef.current = window.setTimeout(pollGamepads, 100) as unknown as number;
      } else {
        requestRef.current = requestAnimationFrame(pollGamepads);
      }
    } else {
      // Sem controle ou app em segundo plano: polling mínimo de 500ms
      requestRef.current = window.setTimeout(pollGamepads, 500) as unknown as number;
    }
  }, [dispatchButtonPress]);

  useEffect(() => {
    const handleConnected = (e: GamepadEvent) => {
      handleGamepadConnected(e);
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        clearTimeout(requestRef.current);
      }
      requestRef.current = requestAnimationFrame(pollGamepads);
    };

    const handleFocus = () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        clearTimeout(requestRef.current);
      }
      requestRef.current = requestAnimationFrame(pollGamepads);
    };

    window.addEventListener("gamepadconnected", handleConnected);
    window.addEventListener("gamepaddisconnected", handleGamepadDisconnected);
    window.addEventListener("focus", handleFocus);
    requestRef.current = requestAnimationFrame(pollGamepads);

    return () => {
      window.removeEventListener("gamepadconnected", handleConnected);
      window.removeEventListener("gamepaddisconnected", handleGamepadDisconnected);
      window.removeEventListener("focus", handleFocus);
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        clearTimeout(requestRef.current);
      }
    };
  }, [handleGamepadConnected, handleGamepadDisconnected, pollGamepads]);

  useEffect(() => {
    let lastMouseX = -1;
    let lastMouseY = -1;

    const onMouseMove = (e: MouseEvent) => {
      // Ignora micro-movimentos espúrios (ruído de sensor ou vibração háptica do controle na mesa)
      if (lastMouseX !== -1 && lastMouseY !== -1) {
        const dx = Math.abs(e.clientX - lastMouseX);
        const dy = Math.abs(e.clientY - lastMouseY);
        if (dx < 3 && dy < 3) return;
      }
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;

      if (activeInputRef.current !== "mouse") {
        setActiveInputType("mouse");
      }
    };

    const onMouseDownOrWheel = () => {
      if (activeInputRef.current !== "mouse") {
        setActiveInputType("mouse");
      }
    };

    const onKeyboard = (e: Event) => {
      if (!(e as KeyboardEvent).isTrusted) return;
      if (activeInputRef.current !== "keyboard") {
        setActiveInputType("keyboard");
      }
    };

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("mousedown", onMouseDownOrWheel, { passive: true });
    window.addEventListener("wheel", onMouseDownOrWheel, { passive: true });
    window.addEventListener("keydown", onKeyboard, { passive: true });

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mousedown", onMouseDownOrWheel);
      window.removeEventListener("wheel", onMouseDownOrWheel);
      window.removeEventListener("keydown", onKeyboard);
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (isGamepadConnected && activeInputType === "gamepad") {
      root.dataset.gamepadNavigation = "active";
    } else {
      delete root.dataset.gamepadNavigation;
    }
    return () => { delete root.dataset.gamepadNavigation; };
  }, [activeInputType, isGamepadConnected]);

  return (
    <GamepadContext.Provider
      value={{
        activeInputType,
        isGamepadConnected,
        gamepadFamily,
        connectedGamepadId,
        batteryLevel: batteryState.batteryLevel,
        batteryCharging: batteryState.isCharging,
        connectionType: batteryState.connectionType,
        isLowBattery: batteryState.isLowBattery,
      }}
    >
      {children}
    </GamepadContext.Provider>
  );
};

export const useGamepad = () => {
  const context = useContext(GamepadContext);
  if (!context) {
    throw new Error("useGamepad must be used within a GamepadProvider");
  }
  return context;
};

export const useGamepadButton = (
  button: GamepadButtonName,
  callback: () => void,
  enabled = true,
  priority = 0,
) => {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled) return;

    const subscriber: GamepadButtonSubscriber = {
      id: Symbol(button),
      callback: () => callbackRef.current(),
      priority,
    };
    const subscribers = gamepadButtonSubscribers.get(button) ?? new Set<GamepadButtonSubscriber>();
    subscribers.add(subscriber);
    gamepadButtonSubscribers.set(button, subscribers);

    return () => {
      subscribers.delete(subscriber);
      if (subscribers.size === 0) gamepadButtonSubscribers.delete(button);
    };
  }, [button, enabled, priority]);
};