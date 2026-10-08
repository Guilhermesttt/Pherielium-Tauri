import type { AudioReactive } from "./headbang";

/**
 * Estilo de dança da Pherie a partir do áudio que o PC toca. Não adivinha o gênero pelo nome:
 * mede o que o som faz. Música agressiva (rock, metal) tem muita energia, muito conteúdo em
 * médios e agudos (guitarras distorcidas, pratos) e batidas rápidas; música calma tem pouca
 * energia, graves dominando e poucas batidas.
 */
export type DanceStyle = "calm" | "groove" | "headbang";

export interface MusicFeatures {
  /** nível médio recente 0..1 (só usado para saber se há som; depende do volume do sistema) */
  energy: number;
  /** quanto do som está em médios+agudos, 0..1 (0 = só grave) */
  brightness: number;
  /** quanto do som está só nos agudos (pratos, guitarra distorcida), 0..1 */
  highShare: number;
  /** batidas por segundo na janela recente */
  beatRate: number;
}

/** Janela da taxa de batidas. */
const BEAT_WINDOW_MS = 6000;
/** Constante de tempo (s) da média móvel do nível e das proporções. */
const SMOOTH_S = 2.5;
/** Tempo mínimo (ms) em um estilo antes de trocar, para a Pherie não ficar nervosa. */
export const MIN_DWELL_MS = 2000;
/** Abaixo disso é silêncio: não classifica. */
export const SILENCE_RMS = 0.008;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * 0..1: quão agressiva é a música. Usa só proporções do espectro e o ritmo, que não mudam com o
 * volume do sistema (o nível absoluto do áudio capturado varia muito de PC para PC).
 * Rock/metal: muito médio/agudo (guitarras distorcidas, pratos) e batida rápida.
 */
export function aggressionScore(f: MusicFeatures): number {
  if (f.energy < SILENCE_RMS) return 0;
  const brightness = clamp01((f.brightness - 0.45) / 0.35);
  const highs = clamp01((f.highShare - 0.06) / 0.2);
  const tempo = clamp01((f.beatRate - 1.3) / 1.8); // ~78 bpm = calma, ~190 bpm = rápida
  return clamp01(brightness * 0.4 + highs * 0.4 + tempo * 0.2);
}

/** Histerese: entrar num estilo é mais difícil do que continuar nele. */
export function styleFromScore(score: number, current: DanceStyle): DanceStyle {
  if (current === "headbang") return score < 0.42 ? (score < 0.22 ? "calm" : "groove") : "headbang";
  if (current === "calm") return score > 0.34 ? (score > 0.55 ? "headbang" : "groove") : "calm";
  if (score >= 0.55) return "headbang";
  if (score <= 0.24) return "calm";
  return "groove";
}

/** Acompanha o áudio quadro a quadro e decide o estilo (um por instância do mascote). */
export class MusicAnalyzer {
  private energy = 0;
  private brightness = 0.4;
  private highShare = 0.1;
  private beats: number[] = [];
  private lastBeatAt = 0;
  private lastSwitchAt = -Infinity;
  private seeded = false;
  style: DanceStyle = "groove";

  get features(): MusicFeatures {
    return { energy: this.energy, brightness: this.brightness, highShare: this.highShare, beatRate: this.beatRate(this.lastNow) };
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
    const hasBands = total > 0.004;
    const bright = hasBands ? (audio.mid + audio.high) / total : this.brightness;
    const highs = hasBands ? audio.high / total : this.highShare;
    if (!this.seeded) {
      this.energy = audio.rms;
      this.brightness = bright;
      this.highShare = highs;
      this.seeded = true;
    } else {
      this.energy += (audio.rms - this.energy) * k;
      this.brightness += (bright - this.brightness) * k;
      this.highShare += (highs - this.highShare) * k;
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
    this.highShare = 0.1;
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
