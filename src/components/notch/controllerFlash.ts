/**
 * Aviso de controle conectado/desconectado que o notch encena (a Pherie pega o
 * controle / o controle some). O hub e o overlay são janelas diferentes no Tauri:
 * o aviso viaja por evento do Tauri; na mesma janela (dev no navegador) por
 * CustomEvent. Sem dependência de React, para ser testável.
 */
export type ControllerFlashKind = "connected" | "disconnected";

export interface ControllerFlash {
  kind: ControllerFlashKind;
  /** "BLUETOOTH", "USB"... quando conhecido */
  link?: string | null;
  /** 0..100 quando o controle informa */
  battery?: number | null;
  /** timestamp: reinicia a animação se o mesmo tipo chegar duas vezes */
  at: number;
}

export const CONTROLLER_FLASH_WINDOW_EVENT = "pherielium:controller-flash";
export const CONTROLLER_FLASH_TAURI_EVENT = "overlay:controller-flash";
export const CONTROLLER_FLASH_MS = 3400;

const isTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export function parseControllerFlash(raw: unknown): ControllerFlash | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  if (value.kind !== "connected" && value.kind !== "disconnected") return null;
  const battery = typeof value.battery === "number" && Number.isFinite(value.battery)
    ? Math.max(0, Math.min(100, Math.round(value.battery)))
    : null;
  return {
    kind: value.kind,
    link: typeof value.link === "string" && value.link ? value.link : null,
    battery,
    at: typeof value.at === "number" ? value.at : Date.now(),
  };
}

/** Texto do notch para cada situação. */
export function controllerFlashCopy(flash: ControllerFlash): { title: string; subtitle: string } {
  if (flash.kind === "disconnected") {
    return { title: "Controle desconectado", subtitle: "Sem sinal" };
  }
  const parts = [flash.link, flash.battery != null ? `${flash.battery}%` : null].filter(Boolean);
  return { title: "Controle conectado", subtitle: parts.join(" • ") || "Pronto para jogar" };
}

/** Largura da barra compacta enquanto o aviso está aberto. */
export const CONTROLLER_FLASH_WIDTH = 304;

/** Chamado pelo hub: avisa o notch (nesta janela e, no Tauri, nas demais). */
export function announceControllerFlash(input: Omit<ControllerFlash, "at">): void {
  const payload: ControllerFlash = { ...input, at: Date.now() };
  try {
    window.dispatchEvent(new CustomEvent(CONTROLLER_FLASH_WINDOW_EVENT, { detail: payload }));
  } catch { /* sem bridge: ignora */ }
  if (isTauri()) {
    void import("@tauri-apps/api/event")
      .then(({ emit }) => emit(CONTROLLER_FLASH_TAURI_EVENT, payload))
      .catch(() => undefined);
  }
}
