import { useEffect, useRef } from "react";
import { VOICE_LEVEL_EVENT, type VoiceLevelPayload } from "../services/voiceCall/voiceLevelBridge";

const STALE_MS = 320;

export const hasTauriRuntime = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/**
 * Volume do microfone local (0..1) vindo do launcher via `overlay:voice-level`.
 * Fica numa ref — o mascote lê a cada frame, então nada re-renderiza por volume.
 * Se os eventos param (chamada acabou, janela principal oculta/travada), o valor
 * volta a 0 em ~300 ms em vez de deixar a boca aberta.
 */
export function useVoiceLevelRef(enabled: boolean): { current: number } {
  const ref = useRef(0);
  useEffect(() => {
    ref.current = 0;
    if (!enabled || !hasTauriRuntime()) return;
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    let lastAt = 0;

    void import("@tauri-apps/api/event").then(({ listen }) => {
      void listen<VoiceLevelPayload>(VOICE_LEVEL_EVENT, (event) => {
        ref.current = Math.min(1, Math.max(0, event.payload.level));
        lastAt = performance.now();
      }).then((fn) => {
        if (cancelled) fn();
        else unlisten = fn;
      });
    });

    const decay = window.setInterval(() => {
      if (ref.current > 0 && performance.now() - lastAt > STALE_MS) ref.current = 0;
    }, 120);

    return () => {
      cancelled = true;
      window.clearInterval(decay);
      unlisten?.();
      ref.current = 0;
    };
  }, [enabled]);
  return ref;
}
