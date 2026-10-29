import type { MascotMood } from "./moods";

/** Humor da Pherie no hub, na mesma ordem de prioridade que ela tinha na notch. Função pura. */
export interface HubMoodInput {
  dizzy: boolean;
  /** aviso em cena (conquista, amigo, mensagem...): o humor do evento */
  eventMood: MascotMood | null;
  /** reação curta (cutucada, fim de jogo/chamada...) */
  transient: MascotMood | null;
  inCall: boolean;
  muted: boolean;
  gaming: boolean;
  musicPlaying: boolean;
  /** humor escolhido manualmente nas configurações ("Expressões da Pherie") */
  baseMood: MascotMood | null;
  hovered: boolean;
  /** entediada → sonolenta → dormindo, pelo tempo parada */
  ambient: MascotMood | null;
}

export function resolveHubMood(i: HubMoodInput): MascotMood {
  if (i.dizzy) return "dizzy";
  if (i.eventMood) return i.eventMood;
  if (i.transient) return i.transient;
  if (i.inCall) return i.muted ? "muted" : "calling";
  if (i.gaming) return "gaming";
  if (i.musicPlaying) return "music";
  if (i.baseMood) return i.baseMood;
  if (i.hovered && !i.ambient) return "attentive";
  return i.ambient ?? "idle";
}

/** Janela em que as inversões de direção contam para "chacoalhar o mouse" (ms). */
const SHAKE_WINDOW_MS = 600;
/** Movimento mínimo (px) para uma inversão de direção valer; tremida da mão não conta. */
const MIN_REVERSAL_STEP_PX = 6;
const SPEED_WINDOW_MS = 150;

export interface MoveSample {
  x: number;
  y: number;
  t: number;
}

export interface ShakeMetrics {
  speed: number;
  reversals: number;
}

/**
 * Velocidade (px/s) e inversões de direção em X do mouse nos últimos instantes. No overlay isso vem
 * do thread de cursor do Rust; no hub o navegador só entrega `mousemove`, então calculamos aqui.
 */
export function shakeMetrics(samples: readonly MoveSample[], now: number): ShakeMetrics {
  const recent = samples.filter((s) => now - s.t <= SHAKE_WINDOW_MS);
  let reversals = 0;
  let lastSign = 0;
  for (let i = 1; i < recent.length; i++) {
    const dx = recent[i].x - recent[i - 1].x;
    if (Math.abs(dx) < MIN_REVERSAL_STEP_PX) continue;
    const sign = Math.sign(dx);
    if (lastSign !== 0 && sign !== lastSign) reversals += 1;
    lastSign = sign;
  }
  const fast = recent.filter((s) => now - s.t <= SPEED_WINDOW_MS);
  let speed = 0;
  if (fast.length >= 2) {
    let distance = 0;
    for (let i = 1; i < fast.length; i++) distance += Math.hypot(fast[i].x - fast[i - 1].x, fast[i].y - fast[i - 1].y);
    const span = (fast[fast.length - 1].t - fast[0].t) / 1000;
    speed = span > 0 ? distance / span : 0;
  }
  return { speed, reversals };
}

/** Cliques seguidos na Pherie: a partir do 3º em 0,8 s ela fica tonta. */
export const POKE_WINDOW_MS = 800;
export const POKES_TO_DIZZY = 3;

export function registerPoke(previous: readonly number[], now: number): { clicks: number[]; dizzy: boolean } {
  const recent = [...previous.filter((t) => now - t < POKE_WINDOW_MS), now];
  if (recent.length >= POKES_TO_DIZZY) return { clicks: [], dizzy: true };
  return { clicks: recent, dizzy: false };
}
