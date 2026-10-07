import expandSound from "../../sounds/PS5_Plus/deck_ui_side_menu_fly_in.wav";
import collapseSound from "../../sounds/PS5_Plus/deck_ui_side_menu_fly_out.wav";
import revealSound from "../../sounds/PS5_Plus/deck_ui_bumper_end.wav";
import mediaPlaySound from "../../sounds/PS5_Plus/deck_ui_switch_toggle_on.wav";
import mediaPauseSound from "../../sounds/PS5_Plus/deck_ui_switch_toggle_off.wav";
import mediaSkipSound from "../../sounds/PS5_Plus/deck_ui_tab_transition_01.wav";
import mascotPokeSound from "../../sounds/Phelierium Default/ui_click.wav";
import mascotDizzySound from "../../sounds/PS5_Plus/deck_ui_misc_10.wav";
import panelOpenSound from "../../sounds/PS5_Plus/deck_ui_show_modal.wav";
import headphonesSnapSound from "../../sounds/PS5_Plus/deck_ui_bumper_end_02.wav";
import hubFoldSound from "../../sounds/PS5_Plus/deck_ui_launch_game.wav";

/**
 * Sons de interação do notch. Cada ação tem um som próprio (abrir/fechar/aparecer,
 * play/pause/pular, cutucar a Pherie, abrir o painel). Mutar/silenciar/desligar NÃO
 * estão aqui: já tocam no hook de voz (useVoiceCall) e tocar de novo dobraria o som.
 */
export type NotchSoundId =
  | "expand"
  | "collapse"
  | "reveal"
  | "mediaPlay"
  | "mediaPause"
  | "mediaSkip"
  | "mascotPoke"
  | "mascotDizzy"
  | "panelOpen"
  | "headphonesSnap"
  | "hubFold";

interface NotchSoundDef {
  src: string;
  /** ganho relativo ao volume dos efeitos (0..1) — equilibra sons de timbre/volume diferentes */
  gain: number;
  /** intervalo mínimo entre duas reproduções do mesmo som (ms) */
  minIntervalMs: number;
}

export const NOTCH_SOUNDS: Record<NotchSoundId, NotchSoundDef> = {
  expand: { src: expandSound, gain: 0.7, minIntervalMs: 220 },
  collapse: { src: collapseSound, gain: 0.55, minIntervalMs: 220 },
  reveal: { src: revealSound, gain: 0.6, minIntervalMs: 400 },
  mediaPlay: { src: mediaPlaySound, gain: 0.8, minIntervalMs: 120 },
  mediaPause: { src: mediaPauseSound, gain: 0.8, minIntervalMs: 120 },
  mediaSkip: { src: mediaSkipSound, gain: 0.75, minIntervalMs: 120 },
  mascotPoke: { src: mascotPokeSound, gain: 0.9, minIntervalMs: 80 },
  mascotDizzy: { src: mascotDizzySound, gain: 0.85, minIntervalMs: 800 },
  panelOpen: { src: panelOpenSound, gain: 0.75, minIntervalMs: 300 },
  headphonesSnap: { src: headphonesSnapSound, gain: 0.9, minIntervalMs: 500 },
  hubFold: { src: hubFoldSound, gain: 0.7, minIntervalMs: 800 },
};

/** Volume final 0..1 (volume dos efeitos × ganho do som); nunca estoura nem fica NaN. */
export function resolveNotchVolume(effectsVolume: number | undefined, id: NotchSoundId): number {
  const base = typeof effectsVolume === "number" && Number.isFinite(effectsVolume) ? effectsVolume : 0.3;
  return Math.min(1, Math.max(0, base * NOTCH_SOUNDS[id].gain));
}

/** Antirrepique: evita empilhar o mesmo som (hover/spam de clique). Puro para teste. */
export function shouldPlayNotchSound(id: NotchSoundId, nowMs: number, lastAtMs: number | undefined): boolean {
  return lastAtMs === undefined || nowMs - lastAtMs >= NOTCH_SOUNDS[id].minIntervalMs;
}

const lastPlayed = new Map<NotchSoundId, number>();

/** Toca o som do notch. `effectsVolume` em 0..1 (o mesmo que o launcher manda ao overlay). */
export function playNotchSound(id: NotchSoundId, effectsVolume?: number): void {
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  if (!shouldPlayNotchSound(id, now, lastPlayed.get(id))) return;
  lastPlayed.set(id, now);
  const volume = resolveNotchVolume(effectsVolume, id);
  if (volume <= 0) return;
  try {
    const audio = new Audio(NOTCH_SOUNDS[id].src);
    audio.volume = volume;
    void audio.play().catch(() => undefined);
  } catch {
    /* sem áudio disponível: silencioso */
  }
}
