/**
 * Passagem da Pherie entre o hub e a notch. Quando a notch precisa dela (aviso, chamada, controle,
 * conquista), ela surge lá e some do hub; quando a notch a dispensa, ela volta para o hub.
 *
 * O hub e o overlay são janelas diferentes: a notch avisa por evento do Tauri (e por CustomEvent na
 * mesma janela, em dev). Enquanto a notch a segura, manda um sinal de vida a cada poucos segundos; se
 * os sinais param (o overlay fechou ou travou), o hub a pega de volta sozinho.
 */
export const PHERIE_NOTCH_WINDOW_EVENT = "pherielium:pherie-notch-presence";
export const PHERIE_NOTCH_TAURI_EVENT = "overlay:pherie-notch-presence";
/** A notch repete "estou com ela" nesse intervalo. */
export const PRESENCE_HEARTBEAT_MS = 3000;
/** Sem sinal por este tempo, considera que a notch já não está com ela. */
export const PRESENCE_STALE_MS = 9000;
/** Depois que sai da notch, espera um instante antes de reaparecer no hub (a saída termina primeiro). */
export const HUB_RETURN_DELAY_MS = 450;

export interface PherieNotchPresence {
  active: boolean;
  /** quando a notch mandou o último sinal (ms) */
  at: number;
}

/** A Pherie está na notch? Só vale enquanto os sinais de vida continuam chegando. */
export function notchHoldsPherie(presence: PherieNotchPresence | null, now: number): boolean {
  return Boolean(presence && presence.active && now - presence.at <= PRESENCE_STALE_MS);
}

/** Lê o que veio num evento (CustomEvent ou Tauri); qualquer coisa fora do formato é ignorada. */
export function parsePresence(raw: unknown, now: number): PherieNotchPresence | null {
  if (!raw || typeof raw !== "object") return null;
  const active = (raw as { active?: unknown }).active;
  if (typeof active !== "boolean") return null;
  return { active, at: now };
}

const isTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** Avisa o hub se a Pherie está (ou deixou de estar) na notch. */
export function announcePherieInNotch(active: boolean): void {
  try {
    window.dispatchEvent(new CustomEvent(PHERIE_NOTCH_WINDOW_EVENT, { detail: { active } }));
  } catch {
    /* sem janela: ignora */
  }
  if (isTauri()) {
    void import("@tauri-apps/api/event")
      .then(({ emit }) => emit(PHERIE_NOTCH_TAURI_EVENT, { active }))
      .catch(() => undefined);
  }
}
