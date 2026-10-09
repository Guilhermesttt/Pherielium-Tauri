import { useEffect, useState } from "react";

/**
 * Estado do controle para a aba "Controle" do notch: conectado?, marca (Xbox, PlayStation ou
 * genérico), conexão e bateria. O hub (onde fica o `GamepadContext`) anuncia o estado; o notch (que
 * pode viver na janela do overlay) guarda o último. Sem React na parte pura, para testar.
 */
export type ControllerBrand = "xbox" | "playstation" | "generic";
export type ControllerLink = "usb" | "bluetooth" | "unknown";

export interface ControllerState {
  connected: boolean;
  brand: ControllerBrand;
  link: ControllerLink;
  /** nome legível vindo do id do navegador (sem o ruído do "STANDARD GAMEPAD") */
  name: string;
  battery: number | null;
  charging: boolean;
  approximate: boolean;
}

export const NO_CONTROLLER: ControllerState = {
  connected: false,
  brand: "generic",
  link: "unknown",
  name: "",
  battery: null,
  charging: false,
  approximate: false,
};

export const CONTROLLER_STATE_WINDOW_EVENT = "pherielium:controller-state";
export const CONTROLLER_STATE_TAURI_EVENT = "overlay:controller-state";

/** Marca pelo id do Gamepad API ("Xbox 360 Controller (XInput…)", "Wireless Controller (… Vendor: 054c …)"). */
export function detectControllerBrand(id: string | null | undefined): ControllerBrand {
  const s = (id ?? "").toLowerCase();
  if (!s) return "generic";
  if (/(dualsense|dualshock|playstation|\bps[3-5]\b|vendor:\s*054c|054c-)/.test(s)) return "playstation";
  // "Wireless Controller" puro é o nome que o Chrome dá ao DualShock/DualSense
  if (/^wireless controller\b/.test(s)) return "playstation";
  if (/(xbox|xinput|microsoft|vendor:\s*045e|045e-)/.test(s)) return "xbox";
  return "generic";
}

export const BRAND_LABEL: Record<ControllerBrand, string> = {
  xbox: "Xbox",
  playstation: "PlayStation",
  generic: "Genérico",
};

/** Tira o ruído do id: "Xbox 360 Controller (XInput STANDARD GAMEPAD)" → "Xbox 360 Controller". */
export function cleanControllerName(id: string | null | undefined): string {
  return (id ?? "")
    .replace(/\(.*?\)/g, "")
    .replace(/\b(standard gamepad|vendor:\s*\w+|product:\s*\w+)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

const bool = (v: unknown) => v === true;

export function parseControllerState(raw: unknown): ControllerState | null {
  if (!raw || typeof raw !== "object") return null;
  const v = raw as Record<string, unknown>;
  if (typeof v.connected !== "boolean") return null;
  const brand = v.brand === "xbox" || v.brand === "playstation" || v.brand === "generic" ? v.brand : "generic";
  const link = v.link === "usb" || v.link === "bluetooth" ? v.link : "unknown";
  const battery = typeof v.battery === "number" && Number.isFinite(v.battery) ? Math.max(0, Math.min(100, Math.round(v.battery))) : null;
  return {
    connected: v.connected,
    brand,
    link,
    name: typeof v.name === "string" ? v.name.trim().slice(0, 60) : "",
    battery,
    charging: bool(v.charging),
    approximate: bool(v.approximate),
  };
}

const sameState = (a: ControllerState, b: ControllerState) =>
  a.connected === b.connected &&
  a.brand === b.brand &&
  a.link === b.link &&
  a.name === b.name &&
  a.battery === b.battery &&
  a.charging === b.charging &&
  a.approximate === b.approximate;

let lastAnnounced: ControllerState | null = null;

/** Chamado pelo hub quando o controle muda (conexão, bateria, tipo). Ignora repetições. */
export function announceControllerState(state: ControllerState): void {
  if (lastAnnounced && sameState(lastAnnounced, state)) return;
  lastAnnounced = state;
  try {
    window.dispatchEvent(new CustomEvent(CONTROLLER_STATE_WINDOW_EVENT, { detail: state }));
  } catch {
    /* sem janela */
  }
  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    void import("@tauri-apps/api/event")
      .then(({ emit }) => emit(CONTROLLER_STATE_TAURI_EVENT, state))
      .catch(() => undefined);
  }
}

/** Último estado do controle (ou "nenhum"). Escuta a janela e, no Tauri, o evento do hub. */
export function useControllerState(): ControllerState {
  const [state, setState] = useState<ControllerState>(lastAnnounced ?? NO_CONTROLLER);

  useEffect(() => {
    const apply = (raw: unknown) => {
      const next = parseControllerState(raw);
      if (next) setState((prev) => (sameState(prev, next) ? prev : next));
    };
    const onWindow = (e: Event) => apply((e as CustomEvent).detail);
    window.addEventListener(CONTROLLER_STATE_WINDOW_EVENT, onWindow);
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    if ("__TAURI_INTERNALS__" in window) {
      void import("@tauri-apps/api/event").then(({ listen }) =>
        listen<unknown>(CONTROLLER_STATE_TAURI_EVENT, (event) => apply(event.payload)).then((fn) => {
          if (cancelled) fn();
          else unlisten = fn;
        }),
      );
    }
    return () => {
      cancelled = true;
      window.removeEventListener(CONTROLLER_STATE_WINDOW_EVENT, onWindow);
      unlisten?.();
    };
  }, []);

  return state;
}
