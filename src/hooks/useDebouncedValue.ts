import { useEffect, useState } from "react";

/** Só adota o valor depois que ele ficar estável por `delayMs` (passar rápido por vários itens não dispara trabalho pesado). */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    if (Object.is(value, debounced)) return;
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs, debounced]);
  return debounced;
}
