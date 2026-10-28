import { useCallback, useEffect, useRef, useState } from "react";
import { buildReveal, newIds, revealDurationMs, type Reveal, type RevealKind } from "../services/gameReveal";

/**
 * Marca as capas que acabaram de chegar à lista mostrada, para a Home animá-las.
 *
 * - `scope` identifica a lista (aba, filtro): ao mudar, a lista nova é só a base, sem animação.
 * - `ready` só fica true depois da primeira carga, para a biblioteca inteira não "chegar" ao abrir o app.
 * - `markNext` diz de onde vem a próxima novidade ("add" = a pessoa adicionou, "sync" = sincronização).
 *   Quem não avisa cai em "sync".
 */
export function useGameReveal(ids: readonly string[], scope: string, ready: boolean) {
  const known = useRef<{ scope: string; ids: Set<string> } | null>(null);
  const nextKind = useRef<RevealKind>("sync");
  const [reveal, setReveal] = useState<Record<string, Reveal>>({});
  const clearTimer = useRef<number>(0);

  const markNext = useCallback((kind: RevealKind) => {
    nextKind.current = kind;
  }, []);

  useEffect(() => {
    if (!ready) return;
    const current = known.current;
    if (!current || current.scope !== scope) {
      known.current = { scope, ids: new Set(ids) };
      return;
    }
    const added = newIds(current.ids, ids);
    known.current = { scope, ids: new Set(ids) };
    if (added.length === 0) return;
    const kind = nextKind.current;
    nextKind.current = "sync";
    setReveal(buildReveal(added, kind));
    // o relógio é do hook, não do efeito: a lista muda de identidade a cada render e não pode cortar a animação
    window.clearTimeout(clearTimer.current);
    clearTimer.current = window.setTimeout(() => setReveal({}), revealDurationMs(added.length, kind));
  }, [ids, scope, ready]);

  useEffect(() => () => window.clearTimeout(clearTimer.current), []);

  return { reveal, markNext };
}
