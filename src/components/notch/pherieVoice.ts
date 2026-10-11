import type { MascotMood } from "../../mascot/moods";

/**
 * A "voz" da Pherie: gorjeios e piadinhas sintetizados na hora (Web Audio), sem
 * arquivo de áudio. Cada reação tem o seu: um "ah!" quando ela se assusta, um
 * "hmm?" quando fica confusa, um bocejo quando dá sono, um trilo quando alegra.
 *
 * As notas ficam como DADOS (`PHERIE_VOICES`), então o catálogo é testável sem
 * áudio; só `playPherieVoice` toca de verdade.
 */
export type PherieVoiceId =
  | "poke"
  | "gasp"
  | "huff"
  | "confused"
  | "happy"
  | "sad"
  | "scared"
  | "curious"
  | "shy"
  | "bored"
  | "yawn"
  | "sleep"
  | "wake"
  | "wink"
  | "peek";

export interface VoiceNote {
  /** ms desde o início da voz */
  at: number;
  /** duração em ms */
  dur: number;
  /** frequência inicial e final (Hz): o glissando é o que dá o jeitinho de bicho */
  from: number;
  to: number;
  wave: OscillatorType;
  /** 0..1, relativo ao volume da voz */
  gain: number;
  /** vibrato (Hz) opcional, para o bocejo e o susto tremerem */
  vibrato?: number;
}

const n = (
  at: number,
  dur: number,
  from: number,
  to: number,
  wave: OscillatorType = "sine",
  gain = 1,
  vibrato?: number,
): VoiceNote => ({ at, dur, from, to, wave, gain, vibrato });

export const PHERIE_VOICES: Record<PherieVoiceId, ReadonlyArray<VoiceNote>> = {
  poke: [n(0, 70, 880, 1320), n(0, 70, 1760, 2640, "triangle", 0.25)],
  gasp: [n(0, 120, 520, 900), n(110, 90, 900, 1100, "sine", 0.8)],
  huff: [n(0, 90, 320, 260, "triangle", 0.9), n(115, 100, 300, 230, "triangle", 0.9)],
  confused: [n(0, 110, 600, 520), n(150, 170, 520, 780)],
  happy: [n(0, 90, 660, 700), n(80, 90, 830, 880), n(160, 90, 990, 1040), n(240, 150, 1320, 1400)],
  sad: [n(0, 190, 700, 520), n(180, 280, 520, 380, "sine", 0.8)],
  scared: [n(0, 60, 1400, 1900, "sine", 1, 38), n(85, 60, 1500, 2000, "sine", 0.9, 38)],
  curious: [n(0, 150, 500, 760), n(160, 90, 760, 700, "sine", 0.7)],
  shy: [n(0, 120, 880, 820, "sine", 0.5), n(150, 90, 990, 930, "sine", 0.4)],
  bored: [n(0, 300, 420, 300, "triangle", 0.5)],
  yawn: [n(0, 520, 600, 300, "sine", 0.5, 6)],
  sleep: [n(0, 450, 380, 260, "sine", 0.4, 4), n(520, 450, 330, 230, "sine", 0.3, 4)],
  wake: [n(0, 100, 500, 1000), n(100, 70, 1000, 1200, "sine", 0.8)],
  wink: [n(0, 45, 1500, 1500, "sine", 0.7), n(60, 70, 2000, 2200, "sine", 0.7)],
  // "pi-pi-piii!": ela aparece na borda da tela chamando atenção
  peek: [n(0, 70, 700, 1000), n(120, 70, 820, 1180), n(240, 170, 940, 1500)],
};

/** Humor que ganha uma voz. Os outros (música, jogo, chamada...) ficam em silêncio. */
const MOOD_VOICE: Partial<Record<MascotMood, PherieVoiceId>> = {
  surprised: "gasp",
  annoyed: "huff",
  confused: "confused",
  happy: "happy",
  sad: "sad",
  scared: "scared",
  curious: "curious",
  shy: "shy",
  bored: "bored",
  drowsy: "yawn",
  sleeping: "sleep",
  wink: "wink",
};

const SLEEPY: ReadonlySet<MascotMood> = new Set(["drowsy", "sleeping"]);

/**
 * Qual voz acompanha a troca de humor `prev → next` (ou `null` para ficar quieta).
 * Acordar (sair do sono para qualquer outra coisa) tem a sua própria.
 */
export function voiceForMoodChange(prev: MascotMood | null, next: MascotMood): PherieVoiceId | null {
  if (prev === next) return null;
  if (prev && SLEEPY.has(prev) && !SLEEPY.has(next)) return "wake";
  return MOOD_VOICE[next] ?? null;
}

/** Antirrepique: o mesmo som não empilha, e duas vozes não falam uma por cima da outra. */
export const VOICE_MIN_INTERVAL_MS: Record<PherieVoiceId, number> = {
  poke: 60,
  gasp: 500,
  huff: 500,
  confused: 700,
  happy: 700,
  sad: 900,
  scared: 500,
  curious: 900,
  shy: 900,
  bored: 2500,
  yawn: 4000,
  sleep: 6000,
  wake: 1500,
  wink: 1200,
  peek: 8000,
};
export const VOICE_GLOBAL_GAP_MS = 220;

/** Fim da voz (ms): última nota a terminar. */
export function voiceLength(id: PherieVoiceId): number {
  return Math.max(...PHERIE_VOICES[id].map((note) => note.at + note.dur));
}

/** Volume final 0..1: volume dos efeitos × ganho de mestre (o sintetizador é alto). */
export const PHERIE_VOICE_MASTER = 0.45;
export function resolvePherieVolume(effectsVolume: number | undefined): number {
  const base = typeof effectsVolume === "number" && Number.isFinite(effectsVolume) ? effectsVolume : 0.3;
  return Math.min(1, Math.max(0, base * PHERIE_VOICE_MASTER));
}

export function shouldPlayVoice(
  id: PherieVoiceId,
  nowMs: number,
  lastSameMs: number | undefined,
  lastAnyMs: number | undefined,
): boolean {
  if (lastAnyMs !== undefined && nowMs - lastAnyMs < VOICE_GLOBAL_GAP_MS) return false;
  return lastSameMs === undefined || nowMs - lastSameMs >= VOICE_MIN_INTERVAL_MS[id];
}

const lastByVoice = new Map<PherieVoiceId, number>();
let lastAny: number | undefined;
let ctx: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx && ctx.state !== "closed") return ctx;
  const Ctor =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
  } catch {
    ctx = null;
  }
  return ctx;
}

/** Toca a voz. `pitch` (1 = normal) sobe/desce o tom: a cutucada fica mais aguda a cada clique. */
export function playPherieVoice(id: PherieVoiceId, effectsVolume?: number, pitch = 1): void {
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  if (!shouldPlayVoice(id, now, lastByVoice.get(id), lastAny)) return;
  const volume = resolvePherieVolume(effectsVolume);
  if (volume <= 0) return;
  const audio = audioContext();
  if (!audio) return;
  lastByVoice.set(id, now);
  lastAny = now;
  try {
    if (audio.state === "suspended") void audio.resume().catch(() => undefined);
    const t0 = audio.currentTime + 0.005;
    const safePitch = Math.min(2, Math.max(0.5, Number.isFinite(pitch) ? pitch : 1));
    for (const note of PHERIE_VOICES[id]) {
      const start = t0 + note.at / 1000;
      const end = start + note.dur / 1000;
      const osc = audio.createOscillator();
      const amp = audio.createGain();
      osc.type = note.wave;
      osc.frequency.setValueAtTime(note.from * safePitch, start);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, note.to * safePitch), end);
      // ataque curto e queda suave: sem estalo no começo nem no fim
      const peak = Math.max(0.0001, volume * note.gain);
      amp.gain.setValueAtTime(0.0001, start);
      amp.gain.exponentialRampToValueAtTime(peak, start + 0.012);
      amp.gain.exponentialRampToValueAtTime(0.0001, end);
      osc.connect(amp).connect(audio.destination);
      if (note.vibrato) {
        const lfo = audio.createOscillator();
        const depth = audio.createGain();
        lfo.frequency.value = note.vibrato;
        depth.gain.value = note.from * safePitch * 0.04;
        lfo.connect(depth).connect(osc.frequency);
        lfo.start(start);
        lfo.stop(end + 0.02);
      }
      osc.start(start);
      osc.stop(end + 0.02);
    }
  } catch {
    /* sem áudio disponível: silencioso */
  }
}
