/** Congela o vídeo de fundo: `detail.hold` true pede, false solta (pedidos se somam). */
export const VIDEO_HOLD_EVENT = "pherielium:video-hold";
/** Entrada do usuário que não passa por evento do DOM (botões do controle). */
export const INPUT_ACTIVITY_EVENT = "pherielium:input-activity";

/** Pede para congelar o vídeo de fundo; devolve a função que solta (idempotente). */
export function holdBackgroundVideo(): () => void {
  window.dispatchEvent(new CustomEvent(VIDEO_HOLD_EVENT, { detail: { hold: true } }));
  let released = false;
  return () => {
    if (released) return;
    released = true;
    window.dispatchEvent(new CustomEvent(VIDEO_HOLD_EVENT, { detail: { hold: false } }));
  };
}

// ── Auto-desligar o vídeo em máquina que não dá conta ────────────────────────
// O vídeo de fundo é só ambiente (~10% de opacidade efetiva). Se, ENQUANTO a
// pessoa mexe (carrossel, rolagem), a Home não sustenta uns ~33 fps, o vídeo sai
// de cena pelo resto da sessão: troca imperceptível por fluidez.

/** Mediana de quadro acima disso (ms) = abaixo de ~33 fps. */
export const FRAME_BUDGET_MS = 30;
/** Quadros por janela de medição. */
export const FRAME_SAMPLE_SIZE = 30;
/** Janelas ruins seguidas antes de desligar (evita decidir por um tranco só). */
export const DEGRADE_STRIKES = 2;
/** Depois de abrir o app a carga inicial é pesada de propósito: não mede. */
export const MEASURE_GRACE_MS = 6000;

/** A mediana dos intervalos entre quadros estoura o orçamento? */
export function frameWindowIsSlow(deltas: ReadonlyArray<number>, budgetMs = FRAME_BUDGET_MS): boolean {
  if (deltas.length === 0) return false;
  const sorted = [...deltas].sort((a, b) => a - b);
  return sorted[sorted.length >> 1] > budgetMs;
}

let degraded = false;
const degradeListeners = new Set<() => void>();

export const isBackgroundVideoDegraded = () => degraded;

export function degradeBackgroundVideo(): void {
  if (degraded) return;
  degraded = true;
  degradeListeners.forEach((listener) => listener());
}

export function subscribeVideoDegraded(listener: () => void): () => void {
  degradeListeners.add(listener);
  return () => degradeListeners.delete(listener);
}
