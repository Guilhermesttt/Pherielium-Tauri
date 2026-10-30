import { useEffect } from "react";

/**
 * A emulação de controle liga sozinha quando o jogo abre; se não conseguir (nenhum controle compatível,
 * HidHide ausente...), o Rust avisa por este evento e o jogo segue sem ela.
 */
export function usePadEngineErrors(notify: (message: string, type: "warning") => void): void {
  useEffect(() => {
    if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return;
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    void import("@tauri-apps/api/event").then(({ listen }) =>
      listen<string>("pad-engine:error", (event) => notify(`Emulação de controle não ligou: ${event.payload}`, "warning")).then((fn) => {
        if (cancelled) fn();
        else unlisten = fn;
      }),
    );
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [notify]);
}
