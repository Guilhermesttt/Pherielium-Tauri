import { useCallback, useEffect, useRef, useState } from "react";
import { detectGamepadFamily, type GamepadFamily } from "../context/GamepadContext";
import {
  parseGamepadId,
  pressedButtons,
  type ButtonSample,
  type DeviceInfo,
  type PressedButton,
} from "../lib/gamepadLayout";

export interface LiveDevice {
  index: number;
  id: string;
  family: GamepadFamily;
  info: DeviceInfo;
}

export interface LiveGamepadSnapshot {
  devices: LiveDevice[];
  /** Controle que está sendo mostrado (o último que mexeu, ou o escolhido). */
  activeIndex: number | null;
  buttons: ButtonSample[];
  axes: number[];
  pressed: PressedButton[];
  /** Último botão apertado; fica depois de soltar, para dar tempo de ler. */
  lastPressed: PressedButton | null;
}

const EMPTY: LiveGamepadSnapshot = {
  devices: [],
  activeIndex: null,
  buttons: [],
  axes: [],
  pressed: [],
  lastPressed: null,
};

/** Resolução da comparação: ignora ruído de eixo abaixo de ~0,5 %. */
const AXIS_STEP = 200;
const BUTTON_STEP = 50;

/**
 * Assinatura quantizada de um controle. É o que decide se vale re-renderizar:
 * um stick parado "vibra" na casa de 1e-4 e não deve gerar 60 renders por segundo.
 */
const signatureOf = (pad: Gamepad): string => {
  const b = pad.buttons.map((x) => Math.round((x?.value ?? 0) * BUTTON_STEP) + (x?.pressed ? 1000 : 0));
  const a = pad.axes.map((x) => Math.round((Number.isFinite(x) ? x : 0) * AXIS_STEP));
  return `${pad.index}|${b.join(",")}|${a.join(",")}`;
};

const toDevice = (pad: Gamepad): LiveDevice => ({
  index: pad.index,
  id: pad.id,
  family: detectGamepadFamily(pad.id),
  info: parseGamepadId(pad.id),
});

export const connectedPads = (): Gamepad[] => {
  if (typeof navigator === "undefined" || typeof navigator.getGamepads !== "function") return [];
  // `getGamepads()` devolve `null` nos slots vazios.
  return Array.from(navigator.getGamepads()).filter((p): p is Gamepad => Boolean(p?.connected));
};

/**
 * Estado ao vivo do(s) controle(s) pela Web Gamepad API.
 *
 * Só lê enquanto `enabled`, então a aba que o usa não custa nada quando fechada.
 * IMPORTANTE: a Gamepad API só reporta com a janela do launcher em foco. Isto
 * serve para ver/ajustar o controle aqui, NÃO para aplicar perfis dentro de um
 * jogo (aí o launcher está em segundo plano e a leitura teria de ser nativa).
 */
export function useLiveGamepad(enabled: boolean, pinnedIndex: number | null = null) {
  const [snapshot, setSnapshot] = useState<LiveGamepadSnapshot>(EMPTY);

  const lastSig = useRef<Map<number, string>>(new Map());
  const lastActive = useRef<number | null>(null);
  const lastPressedRef = useRef<PressedButton | null>(null);
  const lastFrameSig = useRef("");
  const pinnedRef = useRef<number | null>(null);
  const activeRef = useRef<number | null>(null);

  useEffect(() => {
    pinnedRef.current = pinnedIndex;
  }, [pinnedIndex]);

  useEffect(() => {
    if (!enabled) {
      lastFrameSig.current = "";
      return undefined;
    }
    let raf = 0;
    let alive = true;

    const tick = () => {
      if (!alive) return;
      const pads = connectedPads();

      // Quem mexeu desde o último quadro vira o ativo: é o "mexeu e reconheceu".
      for (const pad of pads) {
        const sig = signatureOf(pad);
        const previous = lastSig.current.get(pad.index);
        if (previous !== undefined && previous !== sig) lastActive.current = pad.index;
        lastSig.current.set(pad.index, sig);
      }
      for (const known of [...lastSig.current.keys()]) {
        if (!pads.some((p) => p.index === known)) lastSig.current.delete(known);
      }

      const wanted = pinnedRef.current ?? lastActive.current;
      const active =
        pads.find((p) => p.index === wanted) ?? pads[0] ?? null;
      activeRef.current = active?.index ?? null;

      const buttons: ButtonSample[] = active
        ? active.buttons.map((b) => ({ pressed: Boolean(b?.pressed), value: b?.value ?? 0 }))
        : [];
      const axes = active ? Array.from(active.axes) : [];
      const family = active ? detectGamepadFamily(active.id) : "generic";
      const pressed = pressedButtons(buttons, family);
      if (pressed.length > 0) lastPressedRef.current = pressed[pressed.length - 1];

      const frameSig =
        pads.map((p) => `${p.index}:${p.id}`).join(";") +
        `#${active?.index ?? "-"}#${active ? signatureOf(active) : ""}`;

      if (frameSig !== lastFrameSig.current) {
        lastFrameSig.current = frameSig;
        setSnapshot({
          devices: pads.map(toDevice),
          activeIndex: active?.index ?? null,
          buttons,
          axes,
          pressed,
          lastPressed: lastPressedRef.current,
        });
      }
      raf = window.requestAnimationFrame(tick);
    };

    raf = window.requestAnimationFrame(tick);
    return () => {
      alive = false;
      window.cancelAnimationFrame(raf);
    };
  }, [enabled]);

  /**
   * O `Gamepad` real do controle ativo, lido na hora. A vibração precisa do
   * atuador dele e os testes de stick leem os eixos a cada quadro; nenhum dos
   * dois pode depender do snapshot, que só muda quando algo muda.
   */
  const getPad = useCallback((): Gamepad | null => {
    const pads = connectedPads();
    return pads.find((p) => p.index === activeRef.current) ?? pads[0] ?? null;
  }, []);

  return { snapshot: enabled ? snapshot : EMPTY, getPad };
}
