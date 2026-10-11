import { describe, expect, it } from "vitest";
import {
  PHERIE_VOICES,
  VOICE_GLOBAL_GAP_MS,
  VOICE_MIN_INTERVAL_MS,
  resolvePherieVolume,
  shouldPlayVoice,
  voiceForMoodChange,
  voiceLength,
  type PherieVoiceId,
} from "./pherieVoice";

const IDS = Object.keys(PHERIE_VOICES) as PherieVoiceId[];

describe("catálogo de vozes da Pherie", () => {
  it("toda voz tem notas válidas: frequências audíveis, durações positivas, ganho 0..1", () => {
    for (const id of IDS) {
      expect(PHERIE_VOICES[id].length, id).toBeGreaterThan(0);
      for (const note of PHERIE_VOICES[id]) {
        expect(note.from, id).toBeGreaterThanOrEqual(150);
        expect(note.from, id).toBeLessThanOrEqual(4000);
        expect(note.to, id).toBeGreaterThanOrEqual(150);
        expect(note.to, id).toBeLessThanOrEqual(4000);
        expect(note.dur, id).toBeGreaterThan(0);
        expect(note.at, id).toBeGreaterThanOrEqual(0);
        expect(note.gain, id).toBeGreaterThan(0);
        expect(note.gain, id).toBeLessThanOrEqual(1);
      }
    }
  });

  it("vozes são curtinhas (nada passa de ~1,1 s) e o antirrepique cobre todas", () => {
    for (const id of IDS) {
      expect(voiceLength(id), id).toBeLessThanOrEqual(1100);
      expect(VOICE_MIN_INTERVAL_MS[id], id).toBeGreaterThan(0);
    }
  });
});

describe("voiceForMoodChange", () => {
  it("humores com voz: susto, irritação, confusão, alegria, tristeza, sono", () => {
    expect(voiceForMoodChange("idle", "surprised")).toBe("gasp");
    expect(voiceForMoodChange("surprised", "annoyed")).toBe("huff");
    expect(voiceForMoodChange("idle", "confused")).toBe("confused");
    expect(voiceForMoodChange("idle", "happy")).toBe("happy");
    expect(voiceForMoodChange("idle", "sad")).toBe("sad");
    expect(voiceForMoodChange("idle", "drowsy")).toBe("yawn");
    expect(voiceForMoodChange("drowsy", "sleeping")).toBe("sleep");
  });

  it("acordar tem voz própria, em vez da do humor novo", () => {
    expect(voiceForMoodChange("sleeping", "attentive")).toBe("wake");
    expect(voiceForMoodChange("drowsy", "happy")).toBe("wake");
  });

  it("humores de contexto (música, jogo, chamada) e repetição ficam em silêncio", () => {
    for (const mood of ["music", "gaming", "calling", "muted", "idle", "attentive"] as const) {
      expect(voiceForMoodChange("happy", mood), mood).toBeNull();
    }
    expect(voiceForMoodChange("happy", "happy")).toBeNull();
  });
});

describe("antirrepique e volume", () => {
  it("o mesmo som respeita o intervalo", () => {
    expect(shouldPlayVoice("gasp", 1000, undefined, undefined)).toBe(true);
    expect(shouldPlayVoice("gasp", 1100, 1000, undefined)).toBe(false);
    expect(shouldPlayVoice("gasp", 1000 + VOICE_MIN_INTERVAL_MS.gasp, 1000, undefined)).toBe(true);
  });

  it("vozes diferentes não falam por cima uma da outra (vão global)", () => {
    expect(shouldPlayVoice("happy", 1000 + VOICE_GLOBAL_GAP_MS - 10, undefined, 1000)).toBe(false);
    expect(shouldPlayVoice("happy", 1000 + VOICE_GLOBAL_GAP_MS, undefined, 1000)).toBe(true);
  });

  it("volume = efeitos × mestre; nunca NaN nem acima de 1", () => {
    expect(resolvePherieVolume(0)).toBe(0);
    expect(resolvePherieVolume(1)).toBeLessThanOrEqual(1);
    expect(resolvePherieVolume(undefined)).toBeGreaterThan(0);
    expect(resolvePherieVolume(Number.NaN)).toBeGreaterThan(0);
    expect(resolvePherieVolume(50)).toBeLessThanOrEqual(1);
    expect(resolvePherieVolume(-3)).toBe(0);
  });
});

describe("playPherieVoice (com AudioContext falso)", () => {
  it("agenda uma nota por oscilador, liga ao destino e para cada um; vibrato cria o LFO", async () => {
    const started: number[] = [];
    const stopped: number[] = [];
    const makeParam = () => ({
      value: 0,
      setValueAtTime: () => undefined,
      exponentialRampToValueAtTime: () => undefined,
    });
    const makeNode = () => {
      const node: Record<string, unknown> = {
        frequency: makeParam(),
        gain: makeParam(),
        type: "sine",
        connect: (next: unknown) => next,
        start: (t: number) => started.push(t),
        stop: (t: number) => stopped.push(t),
      };
      return node;
    };
    class FakeContext {
      state = "running";
      currentTime = 10;
      destination = {};
      createOscillator = makeNode;
      createGain = makeNode;
      resume = () => Promise.resolve();
    }
    (globalThis as unknown as { window: unknown }).window = { AudioContext: FakeContext };

    const { playPherieVoice: play, PHERIE_VOICES: voices } = await import("./pherieVoice");
    // volume 0 não toca nada
    play("scared", 0);
    expect(started.length).toBe(0);

    play("scared", 1);
    const notes = voices.scared;
    const lfos = notes.filter((note) => note.vibrato).length;
    expect(started.length).toBe(notes.length + lfos);
    expect(stopped.length).toBe(started.length);
    expect(started.every((t) => t >= 10)).toBe(true);
    delete (globalThis as { window?: unknown }).window;
  });
});
