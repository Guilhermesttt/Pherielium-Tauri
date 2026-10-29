import { describe, expect, it } from "vitest";
import { registerPoke, resolveHubMood, shakeMetrics, type HubMoodInput } from "./hubPherie";

const calm: HubMoodInput = {
  dizzy: false,
  eventMood: null,
  transient: null,
  inCall: false,
  muted: false,
  gaming: false,
  musicPlaying: false,
  baseMood: null,
  hovered: false,
  ambient: null,
};

describe("resolveHubMood", () => {
  it("parada e sem nada acontecendo fica ociosa; o cursor em cima a deixa atenta", () => {
    expect(resolveHubMood(calm)).toBe("idle");
    expect(resolveHubMood({ ...calm, hovered: true })).toBe("attentive");
    expect(resolveHubMood({ ...calm, hovered: true, ambient: "drowsy" })).toBe("drowsy");
  });

  it("respeita a ordem: tontura > aviso > reação > chamada > jogo > música", () => {
    const all = { ...calm, eventMood: "excited", transient: "surprised", inCall: true, gaming: true, musicPlaying: true } as const;
    expect(resolveHubMood({ ...all, dizzy: true })).toBe("dizzy");
    expect(resolveHubMood(all)).toBe("excited");
    expect(resolveHubMood({ ...all, eventMood: null })).toBe("surprised");
    expect(resolveHubMood({ ...all, eventMood: null, transient: null })).toBe("calling");
    expect(resolveHubMood({ ...all, eventMood: null, transient: null, inCall: false })).toBe("gaming");
    expect(resolveHubMood({ ...calm, musicPlaying: true })).toBe("music");
  });

  it("mutada na chamada, e o humor escolhido nas configurações vale quando nada ocupa ela", () => {
    expect(resolveHubMood({ ...calm, inCall: true, muted: true })).toBe("muted");
    expect(resolveHubMood({ ...calm, baseMood: "happy" })).toBe("happy");
    expect(resolveHubMood({ ...calm, baseMood: "happy", gaming: true })).toBe("gaming");
  });
});

describe("shakeMetrics", () => {
  const zigzag = (n: number, step = 40, dt = 40) =>
    Array.from({ length: n }, (_, i) => ({ x: 200 + (i % 2 === 0 ? 0 : step), y: 50, t: 1000 + i * dt }));

  it("vai-e-volta rápido conta inversões e velocidade", () => {
    const samples = zigzag(10);
    const m = shakeMetrics(samples, samples[samples.length - 1].t);
    expect(m.reversals).toBeGreaterThanOrEqual(4);
    expect(m.speed).toBeGreaterThanOrEqual(700);
  });

  it("mover em linha reta não tem inversão", () => {
    const line = Array.from({ length: 10 }, (_, i) => ({ x: i * 30, y: 0, t: 1000 + i * 30 }));
    expect(shakeMetrics(line, 1270).reversals).toBe(0);
  });

  it("tremida pequena da mão não conta e amostras velhas são ignoradas", () => {
    const tremor = Array.from({ length: 10 }, (_, i) => ({ x: 100 + (i % 2) * 2, y: 0, t: 1000 + i * 30 }));
    expect(shakeMetrics(tremor, 1270).reversals).toBe(0);
    expect(shakeMetrics(zigzag(10), 99_999)).toEqual({ speed: 0, reversals: 0 });
    expect(shakeMetrics([], 0)).toEqual({ speed: 0, reversals: 0 });
  });
});

describe("registerPoke", () => {
  it("o terceiro clique seguido deixa tonta e zera a contagem", () => {
    let state = registerPoke([], 1000);
    expect(state).toEqual({ clicks: [1000], dizzy: false });
    state = registerPoke(state.clicks, 1300);
    expect(state.dizzy).toBe(false);
    state = registerPoke(state.clicks, 1600);
    expect(state).toEqual({ clicks: [], dizzy: true });
  });

  it("cliques espaçados não acumulam", () => {
    const first = registerPoke([], 1000);
    expect(registerPoke(first.clicks, 2500)).toEqual({ clicks: [2500], dizzy: false });
  });
});
