import { useCallback, useEffect, useRef, useState } from "react";
import { usePreferences, type VisualTheme } from "../context/PreferencesContext";
import { useGamepad } from "../context/GamepadContext";
import {
  applyThemeLed,
  getControllerLedState,
  requestControllerLedAccess,
  subscribeControllerLedState,
  testControllerLed,
  type ControllerLedState,
} from "../services/controllerLed";

// Task 7: Queue para evitar chamadas concorrentes ao LED (race condition)
let _ledInFlight = false;
let _pendingLedTheme: string | null = null;

async function applyThemeLedQueued(theme: string): Promise<void> {
  _pendingLedTheme = theme;
  if (_ledInFlight) return; // outra chamada já vai processar o pending

  _ledInFlight = true;
  try {
    while (_pendingLedTheme !== null) {
      const currentTheme = _pendingLedTheme as VisualTheme;
      _pendingLedTheme = null;
      await applyThemeLed(currentTheme);
    }
  } finally {
    _ledInFlight = false;
  }
}

/**
 * Sincroniza a cor da lightbar (DualShock 4 / DualSense) com o tema visual.
 * Requer permissão WebHID — tenta automaticamente ao conectar um controle PlayStation.
 */
export function useControllerLed(): void {
  const { visualTheme } = usePreferences();
  const { isGamepadConnected, gamepadFamily } = useGamepad();
  const accessRequested = useRef(false);

  useEffect(() => {
    if (!isGamepadConnected || gamepadFamily !== "playstation") return;

    void applyThemeLedQueued(visualTheme);

    const handleUserActivation = () => {
      if (accessRequested.current || !("hid" in navigator)) return;
      accessRequested.current = true;

      // WebHID exige requestDevice diretamente na ativacao; um await anterior invalida o gesto.
      void requestControllerLedAccess().then((granted) => {
        if (granted) void applyThemeLedQueued(visualTheme);
      });
    };

    window.addEventListener("pointerdown", handleUserActivation, { once: true });
    window.addEventListener("keydown", handleUserActivation, { once: true });

    return () => {
      window.removeEventListener("pointerdown", handleUserActivation);
      window.removeEventListener("keydown", handleUserActivation);
    };
  }, [isGamepadConnected, gamepadFamily, visualTheme]);
}

export function useControllerLedStatus(): ControllerLedState & {
  requestAccess: () => void;
  testLed: () => void;
} {
  const { visualTheme } = usePreferences();
  const [state, setState] = useState<ControllerLedState>(getControllerLedState);

  useEffect(() => subscribeControllerLedState(setState), []);

  const requestAccess = useCallback(() => {
    void requestControllerLedAccess().then((granted) => {
      if (granted) void applyThemeLed(visualTheme);
    });
  }, [visualTheme]);

  const testLed = useCallback(() => {
    void testControllerLed(visualTheme);
  }, [visualTheme]);

  return { ...state, requestAccess, testLed };
}
