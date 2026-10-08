import { describe, expect, it } from "vitest";
import {
  EqualizerNormalizer,
  AUDIO_STALE_MS,
  EMPTY_AUDIO,
  equalizerHeights,
  headbangPose,
  headbangTransform,
  isAudioLive,
  nextBeatEnvelope,
} from "./headbang";

describe("nextBeatEnvelope", () => {
  it("sobe a 1 na batida e decai para 0 sem ficar negativo", () => {
    let env = nextBeatEnvelope(0, 0.033, true);
    expect(env).toBe(1);
    const trail: number[] = [];
    for (let i = 0; i < 90; i++) {
      env = nextBeatEnvelope(env, 0.033, false);
      trail.push(env);
    }
    for (let i = 1; i < trail.length; i++) expect(trail[i]).toBeLessThanOrEqual(trail[i - 1]);
    expect(trail[trail.length - 1]).toBe(0);
    expect(trail[2]).toBeGreaterThan(0.4); // ainda "batendo" ~100 ms depois
  });

  it("tolera dt negativo ou zero", () => {
    expect(nextBeatEnvelope(0.5, 0, false)).toBe(0.5);
    expect(nextBeatEnvelope(0.5, -1, false)).toBe(0.5);
  });
});

describe("headbangPose", () => {
  it("a batida afunda e inclina a cabeça, alternando o lado", () => {
    const a = headbangPose(1, 0, 0);
    const b = headbangPose(1, 1, 0);
    expect(a.y).toBeGreaterThan(5);
    expect(a.rotate).toBeGreaterThan(0);
    expect(b.rotate).toBe(-a.rotate);
  });

  it("parado (sem batida nem nível) não gera transform", () => {
    expect(headbangTransform(headbangPose(0, 3, 0))).toBe("");
  });

  it("o nível geral pulsa a escala de leve, e limita valores absurdos", () => {
    expect(headbangPose(0, 0, 1).scale).toBeCloseTo(1.05, 5);
    expect(headbangPose(0, 0, 9).scale).toBeCloseTo(1.05, 5);
    expect(headbangPose(5, 0, 0).y).toBe(9);
    expect(headbangTransform(headbangPose(1, 0, 0.5))).toMatch(/^translateY\(.+\) rotate\(.+\) scale\(.+\)$/);
  });
});

describe("isAudioLive", () => {
  it("vale só com quadros recentes", () => {
    expect(isAudioLive(EMPTY_AUDIO, 1000)).toBe(false);
    expect(isAudioLive({ ...EMPTY_AUDIO, lastAt: 900 }, 1000)).toBe(true);
    expect(isAudioLive({ ...EMPTY_AUDIO, lastAt: 1000 - AUDIO_STALE_MS - 1 }, 1000)).toBe(false);
  });
});

describe("equalizerHeights", () => {
  it("silêncio = barras no chão; graves fortes levantam a primeira barra", () => {
    expect(equalizerHeights({ low: 0, mid: 0, high: 0, rms: 0 })).toEqual([0, 0, 0, 0]);
    const bass = equalizerHeights({ low: 0.3, mid: 0.02, high: 0.01, rms: 0.2 });
    expect(bass[0]).toBeGreaterThan(bass[3]);
    for (const h of bass) expect(h).toBeGreaterThanOrEqual(0), expect(h).toBeLessThanOrEqual(1);
  });
});

describe("EqualizerNormalizer", () => {
  it("com volume no máximo as barras ainda variam", () => {
    const n = new EqualizerNormalizer();
    let min = 1;
    let max = 0;
    for (let i = 0; i < 200; i++) {
      const loud = 0.8 + (i % 10 === 0 ? 0.2 : 0);
      const quiet = 0.4;
      const v = i % 20 < 10 ? loud : quiet;
      const h = n.heights({ low: v, mid: v, high: v, rms: v }, 0.016)[0];
      if (i > 100) {
        min = Math.min(min, h);
        max = Math.max(max, h);
      }
    }
    expect(max - min).toBeGreaterThan(0.3);
  });
});
