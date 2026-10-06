/**
 * Ponte do volume do microfone local para o overlay (boca do mascote).
 *
 * Vai por um evento dedicado (`overlay:voice-level`), NÃO por `overlay_update_panel`:
 * aquele caminho faz debounce de 350 ms e reenvia o estado inteiro do painel
 * (amigos, chat, conquistas), o que dava ~0,8 s de atraso e ainda causava
 * relayout da janela do overlay a cada flip de "falando".
 */
export const VOICE_LEVEL_EVENT = "overlay:voice-level";

export interface VoiceLevelPayload {
  /** volume normalizado 0..1 (já suavizável no receptor) */
  level: number;
  speaking: boolean;
}

type EmitTo = typeof import("@tauri-apps/api/event").emitTo;

const isTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

let emitToFn: EmitTo | null = null;
let loading = false;
let lastSentAt = 0;
let lastLevel = -1;

const MIN_INTERVAL_MS = 40;
const HEARTBEAT_MS = 250;
const MIN_DELTA = 0.03;

/** Decide se vale enviar (função pura, testável). */
export function shouldPublishLevel(params: {
  level: number;
  lastLevel: number;
  elapsedMs: number;
}): boolean {
  const { level, lastLevel: prev, elapsedMs } = params;
  // transição para silêncio sempre passa (a boca precisa fechar), sem esperar o throttle
  if (level === 0 && prev !== 0) return true;
  if (elapsedMs < MIN_INTERVAL_MS) return false;
  if (Math.abs(level - prev) >= MIN_DELTA) return true;
  // batimento: mantém o receptor "fresco" enquanto há voz (ele zera após silêncio de ~300 ms)
  return level > 0 && elapsedMs >= HEARTBEAT_MS;
}

export function publishVoiceLevel(level: number, speaking: boolean): void {
  if (!isTauri()) return;
  const rounded = Math.round(Math.min(1, Math.max(0, level)) * 100) / 100;
  const now = performance.now();
  if (!shouldPublishLevel({ level: rounded, lastLevel, elapsedMs: now - lastSentAt })) return;

  if (!emitToFn) {
    if (!loading) {
      loading = true;
      void import("@tauri-apps/api/event")
        .then((mod) => {
          emitToFn = mod.emitTo;
        })
        .catch(() => {
          loading = false;
        });
    }
    return;
  }
  lastSentAt = now;
  lastLevel = rounded;
  void emitToFn("overlay", VOICE_LEVEL_EVENT, { level: rounded, speaking } satisfies VoiceLevelPayload).catch(
    () => undefined,
  );
}
