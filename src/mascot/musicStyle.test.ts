import { describe, expect, it } from "vitest";
import { EMPTY_AUDIO, type AudioReactive } from "./headbang";
import { BeatClock, FALLBACK_DEFAULT_INTERVAL_MS, MIN_DWELL_MS, MusicAnalyzer, aggressionScore, styleFromScore } from "./musicStyle";

const audio = (over: Partial<AudioReactive>): AudioReactive => ({ ...EMPTY_AUDIO, lastAt: 1, ...over });

/** Toca `seconds` de um "tipo" de música a 20 quadros/s; devolve o estilo final. */
function play(a: MusicAnalyzer, seconds: number, make: (t: number) => Partial<AudioReactive>, startMs = 0, bpm = 0) {
  let style = a.style;
  const beatEvery = bpm > 0 ? 60000 / bpm : Infinity;
  let nextBeat = startMs;
  for (let t = 0; t < seconds * 1000; t += 50) {
    const now = startMs + t;
    let beatAt = 0;
    if (now >= nextBeat) {
      beatAt = now;
      nextBeat += beatEvery;
    }
    style = a.push(audio({ ...make(t), beatAt: beatAt || a["lastBeatAt"] }), 0.05, now);
  }
  return style;
}

describe("aggressionScore", () => {
  it("rock/metal (energia alta, muito médio/agudo, batida rápida) pontua alto", () => {
    expect(aggressionScore({ energy: 0.16, brightness: 0.75, highShare: 0.3, beatRate: 2.8 })).toBeGreaterThan(0.8);
  });

  it("música calma (pouca energia, só grave, batida lenta) pontua baixo", () => {
    expect(aggressionScore({ energy: 0.06, brightness: 0.37, highShare: 0.04, beatRate: 1 })).toBeLessThan(0.1);
  });

  it("fica entre 0 e 1 mesmo com valores absurdos", () => {
    expect(aggressionScore({ energy: 9, brightness: 9, highShare: 9, beatRate: 99 })).toBeLessThanOrEqual(1);
    expect(aggressionScore({ energy: 1, brightness: -1, highShare: -1, beatRate: -1 })).toBeGreaterThanOrEqual(0);
  });

  it("não depende do volume: o mesmo rock baixinho ou alto dá a mesma nota", () => {
    const quiet = aggressionScore({ energy: 0.03, brightness: 0.75, highShare: 0.3, beatRate: 2.8 });
    const loud = aggressionScore({ energy: 0.4, brightness: 0.75, highShare: 0.3, beatRate: 2.8 });
    expect(quiet).toBeCloseTo(loud, 5);
  });

  it("silêncio não pontua", () => {
    expect(aggressionScore({ energy: 0.001, brightness: 0.9, highShare: 0.5, beatRate: 4 })).toBe(0);
  });
});

describe("styleFromScore (histerese)", () => {
  it("entrar em headbang exige mais do que continuar nele", () => {
    expect(styleFromScore(0.5, "groove")).toBe("groove");
    expect(styleFromScore(0.5, "headbang")).toBe("headbang");
  });

  it("calma só volta quando o som realmente abaixa", () => {
    expect(styleFromScore(0.3, "calm")).toBe("calm");
    expect(styleFromScore(0.3, "groove")).toBe("groove");
    expect(styleFromScore(0.2, "groove")).toBe("calm");
  });
});

describe("MusicAnalyzer", () => {
  it("música agressiva vira headbang", () => {
    const a = new MusicAnalyzer();
    const style = play(a, 12, () => ({ rms: 0.16, low: 0.08, mid: 0.12, high: 0.08 }), 0, 170);
    expect(style).toBe("headbang");
  });

  it("música calma fica calma", () => {
    const a = new MusicAnalyzer();
    const style = play(a, 12, () => ({ rms: 0.05, low: 0.06, mid: 0.03, high: 0.004 }), 0, 62);
    expect(style).toBe("calm");
  });

  it("música média (pop/eletrônica) fica no balanço normal", () => {
    const a = new MusicAnalyzer();
    const style = play(a, 12, () => ({ rms: 0.12, low: 0.1, mid: 0.08, high: 0.03 }), 0, 118);
    expect(style).toBe("groove");
  });

  it("não troca de estilo antes do tempo mínimo (sem nervosismo)", () => {
    const a = new MusicAnalyzer();
    play(a, 12, () => ({ rms: 0.05, low: 0.06, mid: 0.03, high: 0.004 }), 0, 62);
    expect(a.style).toBe("calm");
    const t0 = 12_000;
    // pico de agressão por menos que o mínimo: ainda calma
    const during = play(a, (MIN_DWELL_MS - 800) / 1000, () => ({ rms: 0.16, low: 0.08, mid: 0.12, high: 0.08 }), t0, 180);
    expect(during).not.toBe("headbang");
  });

  it("muda de calma para headbang quando a música endurece", () => {
    const a = new MusicAnalyzer();
    play(a, 12, () => ({ rms: 0.05, low: 0.06, mid: 0.03, high: 0.004 }), 0, 62);
    const style = play(a, 14, () => ({ rms: 0.6, low: 0.3, mid: 0.6, high: 0.5 }), 12_000, 180);
    expect(style).toBe("headbang");
  });

  it("reset volta ao balanço normal", () => {
    const a = new MusicAnalyzer();
    play(a, 12, () => ({ rms: 0.16, low: 0.08, mid: 0.12, high: 0.08 }), 0, 180);
    a.reset();
    expect(a.style).toBe("groove");
  });
});

describe("BeatClock", () => {
  it("segue as batidas reais", () => {
    const c = new BeatClock();
    expect(c.tick(1000, true, 1000)).toBe(true);
    expect(c.tick(1100, true, 1000)).toBe(false);
    expect(c.tick(1500, true, 1500)).toBe(true);
  });

  it("sem batida real, pulsa sozinho no ritmo padrão (nunca fica parado)", () => {
    const c = new BeatClock();
    c.tick(0, true, 0);
    let pulses = 0;
    for (let t = 0; t < 5000; t += 16) if (c.tick(t, true, 0)) pulses++;
    expect(pulses).toBeGreaterThanOrEqual(Math.floor(5000 / (FALLBACK_DEFAULT_INTERVAL_MS * 1.7)));
  });

  it("estima o ritmo dos batimentos reais e o mantém quando eles somem", () => {
    const c = new BeatClock();
    for (let i = 0; i < 6; i++) c.tick(i * 400, true, i * 400 + 1);
    expect(c.interval).toBeGreaterThan(380);
    expect(c.interval).toBeLessThan(420);
  });

  it("sem áudio ao vivo não bate", () => {
    const c = new BeatClock();
    for (let t = 0; t < 3000; t += 16) expect(c.tick(t, false, 0)).toBe(false);
  });

  it("reset esquece o ritmo", () => {
    const c = new BeatClock();
    for (let i = 0; i < 6; i++) c.tick(i * 400, true, i * 400 + 1);
    c.reset();
    expect(c.interval).toBe(FALLBACK_DEFAULT_INTERVAL_MS);
  });
});
