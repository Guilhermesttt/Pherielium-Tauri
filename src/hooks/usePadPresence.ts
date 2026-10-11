import { useCallback, useEffect, useState } from "react";
import { connectedPads } from "./useLiveGamepad";

/**
 * Há controle conectado, e como pegar o `Gamepad` dele na hora.
 *
 * É a versão LEVE do `useLiveGamepad`: só muda quando um controle entra ou sai,
 * nunca quando um stick se mexe. As ferramentas de teste (vibração, drift,
 * circularidade) só precisam disto; o estado por quadro mora no card ao vivo,
 * isolado, para não re-renderizar a aba inteira a cada movimento.
 */
export function usePadPresence(pinnedIndex: number | null) {
  const [count, setCount] = useState(() => connectedPads().length);

  useEffect(() => {
    const refresh = () => setCount((prev) => {
      const next = connectedPads().length;
      return prev === next ? prev : next; // mesmo valor: não re-renderiza
    });
    window.addEventListener("gamepadconnected", refresh);
    window.addEventListener("gamepaddisconnected", refresh);
    // O Chromium só anuncia o controle depois do primeiro aperto, e há
    // desconexões que não disparam evento: uma leitura lenta cobre o resto.
    const poll = window.setInterval(refresh, 1000);
    return () => {
      window.removeEventListener("gamepadconnected", refresh);
      window.removeEventListener("gamepaddisconnected", refresh);
      window.clearInterval(poll);
    };
  }, []);

  /** O controle fixado na lista, ou o primeiro conectado. */
  const getPad = useCallback((): Gamepad | null => {
    const pads = connectedPads();
    return pads.find((p) => p.index === pinnedIndex) ?? pads[0] ?? null;
  }, [pinnedIndex]);

  return { connected: count > 0, getPad };
}
