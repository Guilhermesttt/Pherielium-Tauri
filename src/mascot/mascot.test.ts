import { describe, expect, it } from "vitest";
import { MASCOT_MOODS } from "./moods";
import { MOOD_SPECS, PHERIE_EXPRESSIONS, resolveExpression } from "./pherieStates";
import { STATE_BY_ID } from "./engine/states";
import { BotEngine } from "./engine/engine";
import {
  SPEECH_THRESHOLD,
  matrixTranslation,
  mouthPlacement,
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

  it("estado e expressão de cada humor existem no engine", () => {
    for (const [id, spec] of Object.entries(MOOD_SPECS)) {
      expect(STATE_BY_ID.get(spec.state), `estado de ${id}`).toBeDefined();
      if (spec.expression) {
        expect(resolveExpression(spec.expression), `expressão de ${id}`).not.toBeNull();
      }
    }
  });

  it("humores com rosto usam o estado idle (os outros estados do bloub não têm rosto)", () => {
    for (const [id, spec] of Object.entries(MOOD_SPECS)) {
      if (["wink"].includes(id)) continue; // wink do bloub mantém o rosto
      expect(spec.state, id).toBe("idle");
    }
  });

  it("o engine renderiza dois olhos para cada humor", () => {
    for (const [id, spec] of Object.entries(MOOD_SPECS)) {
      const engine = new BotEngine(100, spec.state, null, resolveExpression(spec.expression));
      const frame = engine.sample(2);
      expect(frame.eyes.length, id).toBe(2);
      expect(frame.bodyPath.length, id).toBeGreaterThan(20);
    }
  });

  it("expressões próprias têm olhos e olhar finitos", () => {
    for (const [id, e] of Object.entries(PHERIE_EXPRESSIONS)) {
      expect(Number.isFinite(e.gaze.yaw + e.gaze.pitch + e.gaze.roll), id).toBe(true);
      expect(e.eyes).toHaveLength(2);
    }
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

  it("ancora a boca abaixo dos olhos, girada com a cabeça", () => {
    const flat = mouthPlacement({ x: -25, y: 0 }, { x: 25, y: 0 });
    expect(flat).not.toBeNull();
    expect(flat!.y).toBeGreaterThan(0); // abaixo da linha dos olhos
    expect(flat!.rotation).toBeCloseTo(0);
    expect(flat!.scale).toBeGreaterThan(30);
    const tilted = mouthPlacement({ x: -25, y: -10 }, { x: 25, y: 10 });
    expect(tilted!.rotation).toBeGreaterThan(5);
    // ordem dos olhos não importa
    expect(mouthPlacement({ x: 25, y: 0 }, { x: -25, y: 0 })!.x).toBeCloseTo(flat!.x);
    // olhos coincidentes = rosto escondido
    expect(mouthPlacement({ x: 1, y: 1 }, { x: 2, y: 1 })).toBeNull();
  });

  it("lê a translação da matriz do engine", () => {
    expect(matrixTranslation("matrix(1,0,0,1,12.5,-3.25)")).toEqual({ x: 12.5, y: -3.25 });
    expect(matrixTranslation("nada")).toBeNull();
    expect(matrixTranslation("matrix(1,0,0,1,NaN,2)")).toBeNull();
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
