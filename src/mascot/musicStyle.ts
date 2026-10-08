import type { AudioReactive } from "./headbang";

/**
 * Estilo de dança da Pherie a partir do áudio que o PC toca. Não adivinha o gênero pelo nome:
 * mede o que o som faz. Música agressiva (rock, metal) tem muita energia, muito conteúdo em
 * médios e agudos (guitarras distorcidas, pratos) e batidas rápidas; música calma tem pouca
 * energia, graves dominando e poucas batidas.
 */
export type DanceStyle = "calm" | "groove" | "headbang";

export interface MusicFeatures {
  /** nível médio recente 0..1 */
  energy: number;
  /** quanto do som está em médios+agudos, 0..1 (0 = só grave) */
  brightness: number;
  /** batidas por segundo na janela recente */
  beatRate: number;
}

/** Janela da taxa de batidas. */
const BEAT_WINDOW_MS = 6000;
/** Constante de tempo (s) da média móvel do nível e do brilho. */
const SMOOTH_S = 2.5;
/** Tempo mínimo (ms) em um estilo antes de trocar, para a Pherie não ficar nervosa. */
export const MIN_DWELL_MS = 2500;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** 0..1: quão agressiva é a música. Pesos: energia manda, brilho e ritmo reforçam. */
export function aggressionScore(f: MusicFeatures): number {
  const energy = clamp01(f.energy / 0.45); // rms de música alta costuma passar de ~0.4
  const brightness = clamp01((f.brightness - 0.25) / 0.5);
  const tempo = clamp01((f.beatRate - 1.2) / 2.3); // ~72 bpm = calma, ~170 bpm = rápida
  return clamp01(energy * 0.5 + brightness * 0.3 + tempo * 0.2);
}

/** Histerese: entrar num estilo é mais difícil do que continuar nele. */
export function styleFromScore(score: number, current: DanceStyle): DanceStyle {
  if (current === "headbang") return score < 0.5 ? (score < 0.28 ? "calm" : "groove") : "headbang";
  if (current === "calm") return score > 0.4 ? (score > 0.62 ? "headbang" : "groove") : "calm";
  if (score >= 0.62) return "headbang";
  if (score <= 0.3) return "calm";
  return "groove";
}

/** Acompanha o áudio quadro a quadro e decide o estilo (um por instância do mascote). */
export class MusicAnalyzer {
  private energy = 0;
  private brightness = 0.4;
  private beats: number[] = [];
  private lastBeatAt = 0;
  private lastSwitchAt = -Infinity;
  private seeded = false;
  style: DanceStyle = "groove";

  get features(): MusicFeatures {
    return { energy: this.energy, brightness: this.brightness, beatRate: this.beatRate(this.lastNow) };
  }
  private lastNow = 0;

  private beatRate(now: number): number {
    const from = now - BEAT_WINDOW_MS;
    this.beats = this.beats.filter((t) => t >= from);
    // com menos de 6 s de dados, usa o intervalo observado para não subestimar
    const span = this.beats.length > 1 ? Math.max(1000, now - this.beats[0]) : BEAT_WINDOW_MS;
    return this.beats.length / (Math.min(span, BEAT_WINDOW_MS) / 1000);
  }

  /** `dt` em segundos, `now` em ms (mesmo relógio de `audio.beatAt`). */
  push(audio: AudioReactive, dt: number, now: number): DanceStyle {
    this.lastNow = now;
    const k = 1 - Math.exp(-Math.max(0, dt) / SMOOTH_S);
    const total = audio.low + audio.mid + audio.high;
    const bright = total > 0.02 ? (audio.mid + audio.high) / total : this.brightness;
    if (!this.seeded) {
      this.energy = audio.rms;
      this.brightness = bright;
      this.seeded = true;
    } else {
      this.energy += (audio.rms - this.energy) * k;
      this.brightness += (bright - this.brightness) * k;
    }
    if (audio.beatAt > 0 && audio.beatAt !== this.lastBeatAt) {
      this.lastBeatAt = audio.beatAt;
      this.beats.push(audio.beatAt);
    }

    const next = styleFromScore(aggressionScore(this.features), this.style);
    if (next !== this.style && now - this.lastSwitchAt >= MIN_DWELL_MS) {
      this.style = next;
      this.lastSwitchAt = now;
    }
    return this.style;
  }

  reset() {
    this.energy = 0;
    this.brightness = 0.4;
    this.beats = [];
    this.lastBeatAt = 0;
    this.seeded = false;
    this.style = "groove";
    this.lastSwitchAt = -Infinity;
  }
}

/** Quanto o corpo e a cabeça se mexem em cada estilo (multiplicador do headbang). */
export const DANCE_INTENSITY: Record<DanceStyle, number> = {
  calm: 0.3,
  groove: 1,
  headbang: 2,
};
