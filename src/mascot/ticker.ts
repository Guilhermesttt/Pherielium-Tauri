/**
 * Relógio de animação compartilhado: um único `requestAnimationFrame` serve todas
 * as instâncias do mascote (barra do notch + painel + prévia das configs). O loop
 * só existe enquanto há assinantes e não roda com a aba/janela oculta (rAF já
 * suspende; o `dt` é limitado para não dar salto ao voltar).
 */
type Listener = (dt: number, now: number) => void;

const listeners = new Set<Listener>();
let raf = 0;
let last = 0;

const MAX_DT = 0.064;

function frame(ms: number) {
  raf = requestAnimationFrame(frame);
  const dt = last ? Math.min((ms - last) / 1000, MAX_DT) : 0;
  last = ms;
  for (const listener of listeners) listener(dt, ms);
}

export function subscribeTicker(listener: Listener): () => void {
  listeners.add(listener);
  if (!raf) {
    last = 0;
    raf = requestAnimationFrame(frame);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  };
}
