import { listen, type UnlistenFn } from "@tauri-apps/api/event";

/**
 * Envolve `listen()` e devolve uma função de cleanup SÍNCRONA e segura.
 *
 * O cleanup pode rodar ANTES de `listen()` resolver (React StrictMode em dev, ou um
 * efeito re-registrado várias vezes por segundo durante uma chamada). Se o unlisten
 * ainda não existe, marca como cancelado e desfaz assim que a promise resolve — senão
 * o listener vaza e cada evento passa a disparar o callback 2+ vezes (foi o que fazia
 * "mutar" no notch ligar e desligar o microfone e tocar o som empilhado).
 */
export function makeListen<T>(event: string, cb: (payload: T) => void): () => void {
  let unlisten: UnlistenFn | null = null;
  let cancelled = false;
  void listen<T>(event, (e) => {
    if (!cancelled) cb(e.payload);
  }).then((u) => {
    if (cancelled) u();
    else unlisten = u;
  });
  return () => {
    cancelled = true;
    unlisten?.();
    unlisten = null;
  };
}
