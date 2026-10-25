import { soundThemes, soundTypeGain, type SoundEffectType } from "../../hooks/useSoundEffects";

/**
 * Sons de interação do notch. Cada ação usa o som do TEMA SONORO escolhido (o mesmo pacote da
 * interface: PS5, Xbox, PS2...), pelo "tipo de efeito" equivalente. Mutar/silenciar/desligar NÃO
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
  /** qual efeito do tema sonoro esta ação usa */
  type: SoundEffectType;
  /** ganho relativo ao volume dos efeitos (0..1) — equilibra sons de timbre/volume diferentes */
  gain: number;
  /** intervalo mínimo entre duas reproduções do mesmo som (ms) */
  minIntervalMs: number;
}

export const NOTCH_SOUNDS: Record<NotchSoundId, NotchSoundDef> = {
  expand: { type: "detailOpen", gain: 0.7, minIntervalMs: 220 },
  collapse: { type: "back", gain: 0.55, minIntervalMs: 220 },
  reveal: { type: "hover", gain: 0.6, minIntervalMs: 400 },
  mediaPlay: { type: "switchOn", gain: 0.8, minIntervalMs: 120 },
  mediaPause: { type: "switchOff", gain: 0.8, minIntervalMs: 120 },
  mediaSkip: { type: "navigate", gain: 0.75, minIntervalMs: 120 },
  mascotPoke: { type: "select", gain: 0.9, minIntervalMs: 80 },
  mascotDizzy: { type: "search", gain: 0.85, minIntervalMs: 800 },
  panelOpen: { type: "showModal", gain: 0.75, minIntervalMs: 300 },
  headphonesSnap: { type: "edit", gain: 0.9, minIntervalMs: 500 },
  hubFold: { type: "play", gain: 0.7, minIntervalMs: 800 },
};

/** Nomes antigos de tema que ainda podem chegar do overlay/armazenamento. */
function normalizeTheme(theme: string | undefined): string {
  if (!theme) return "default";
  if (theme === "playstation") return "ps2";
  if (theme === "phelierium" || theme === "checkpoint") return "default";
  return theme;
}

/** Arquivo do som no tema escolhido; se o tema não tem esse efeito (ou não existe), usa o padrão. */
export function resolveNotchSoundSrc(id: NotchSoundId, theme?: string): string | undefined {
  const { type } = NOTCH_SOUNDS[id];
  const packs = soundThemes as Record<string, Partial<Record<SoundEffectType, string>>>;
  return packs[normalizeTheme(theme)]?.[type] ?? packs.default?.[type];
}

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

/** Toca o som do notch no tema sonoro `theme`. `effectsVolume` em 0..1 (o mesmo que o launcher manda ao overlay). */
export function playNotchSound(id: NotchSoundId, effectsVolume?: number, theme?: string): void {
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  if (!shouldPlayNotchSound(id, now, lastPlayed.get(id))) return;
  lastPlayed.set(id, now);
  const volume = resolveNotchVolume(effectsVolume, id) * soundTypeGain(theme, NOTCH_SOUNDS[id].type);
  const src = resolveNotchSoundSrc(id, theme);
  if (volume <= 0 || !src) return;
  try {
    const audio = new Audio(src);
    audio.volume = volume;
    void audio.play().catch(() => undefined);
  } catch {
    /* sem áudio disponível: silencioso */
  }
}
