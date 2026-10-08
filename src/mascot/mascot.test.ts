import { describe, expect, it } from "vitest";
import { MASCOT_MOODS } from "./moods";
import { MOOD_SPECS } from "./pherieStates";
import {
  SPEECH_THRESHOLD,
  mouthShape,
  smoothLevel,
  talkingMouth,
} from "./mouth";
import { shouldPublishLevel } from "../services/voiceCall/voiceLevelBridge";

describe("moodMap — 24 humores da Pherie", () => {
  it("todo humor das configs tem especificação", () => {
    for (const { id } of MASCOT_MOODS) {
      expect(MOOD_SPECS[id], `humor ${id}`).toBeDefined();
    }
    expect(Object.keys(MOOD_SPECS).sort()).toEqual(MASCOT_MOODS.map((m) => m.id).sort());
  });
});

describe("boca da Pherie", () => {
  it("fala acima do limiar substitui a boca do humor", () => {
    expect(mouthShape("smile", 0).d).not.toBe(talkingMouth(0.8).d);
    expect(mouthShape("smile", SPEECH_THRESHOLD - 0.01).fill).toBe(false);
    expect(mouthShape("smile", 0.8).fill).toBe(true);
  });

  it("a abertura cresce com o volume e fica limitada a 0..1", () => {
    const ry = (l: number) => Number(/a [\d.]+ ([\d.]+)/.exec(talkingMouth(l).d)![1]);
    expect(ry(0.9)).toBeGreaterThan(ry(0.2));
    expect(ry(5)).toBeCloseTo(ry(1), 6);
    expect(ry(-1)).toBeCloseTo(ry(0), 6);
  });

  it("sobe rápido e desce devagar (attack/release)", () => {
    const up = smoothLevel(0, 1, 0.05);
    const down = 1 - smoothLevel(1, 0, 0.05);
    expect(up).toBeGreaterThan(down * 2);
  });
});

describe("publicação do volume do microfone", () => {
  it("zero após voz passa na hora (a boca fecha sem esperar o throttle)", () => {
    expect(shouldPublishLevel({ level: 0, lastLevel: 0.6, elapsedMs: 1 })).toBe(true);
  });

  it("respeita o throttle de 40ms e ignora variações mínimas", () => {
    expect(shouldPublishLevel({ level: 0.5, lastLevel: 0.2, elapsedMs: 10 })).toBe(false);
    expect(shouldPublishLevel({ level: 0.5, lastLevel: 0.2, elapsedMs: 50 })).toBe(true);
    expect(shouldPublishLevel({ level: 0.51, lastLevel: 0.5, elapsedMs: 60 })).toBe(false);
  });

  it("mantém um batimento enquanto há voz e fica quieto no silêncio", () => {
    expect(shouldPublishLevel({ level: 0.5, lastLevel: 0.5, elapsedMs: 300 })).toBe(true);
    expect(shouldPublishLevel({ level: 0, lastLevel: 0, elapsedMs: 5000 })).toBe(false);
  });
});
