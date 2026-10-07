import { useEffect, useRef } from "react";
import { EMPTY_AUDIO, type AudioReactive } from "./headbang";
import { hasTauriRuntime } from "./useVoiceLevel";

export const AUDIO_LEVEL_EVENT = "overlay:audio-level";

interface AudioLevelPayload {
  rms?: number;
  low?: number;
  mid?: number;
  high?: number;
  beat?: boolean;
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

/**
 * Áudio que o PC toca (nível, bandas e batida) vindo do Rust por `overlay:audio-level`.
 * Liga o medidor SÓ enquanto `enabled` (há mídia tocando) e o desliga no cleanup: nenhuma
 * thread de áudio roda sem necessidade. Fica numa ref (o mascote lê a cada frame).
 */
export function useAudioReactiveRef(enabled: boolean): { current: AudioReactive } {
  const ref = useRef<AudioReactive>({ ...EMPTY_AUDIO });

  useEffect(() => {
    ref.current = { ...EMPTY_AUDIO };
    if (!enabled || !hasTauriRuntime()) return;

    let cancelled = false;
    let unlisten: (() => void) | undefined;

    void import("@tauri-apps/api/event").then(({ listen }) => {
      void listen<AudioLevelPayload>(AUDIO_LEVEL_EVENT, (event) => {
        const p = event.payload ?? {};
        const now = performance.now();
        ref.current = {
          rms: num(p.rms),
          low: num(p.low),
          mid: num(p.mid),
          high: num(p.high),
          beatAt: p.beat ? now : ref.current.beatAt,
          lastAt: now,
        };
      }).then((fn) => {
        if (cancelled) fn();
        else unlisten = fn;
      });
    });
    void import("@tauri-apps/api/core").then(({ invoke }) => {
      if (!cancelled) void invoke("overlay_audio_level_start").catch(() => undefined);
    });

    return () => {
      cancelled = true;
      unlisten?.();
      void import("@tauri-apps/api/core").then(({ invoke }) => invoke("overlay_audio_level_stop")).catch(() => undefined);
      ref.current = { ...EMPTY_AUDIO };
    };
  }, [enabled]);

  return ref;
}
