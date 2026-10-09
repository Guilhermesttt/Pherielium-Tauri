import { describe, expect, it } from "vitest";
import {
  TOUR_STEPS,
  coachPlacement,
  loadTourState,
  restartTour,
  saveTourState,
  stepIndexFrom,
  tourForceKey,
  tourKey,
} from "./tourSteps";

const mem = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    m,
  };
};

describe("tour: passos", () => {
  it("tem os 8 passos pedidos, ids únicos e o último sem alvo", () => {
    expect(TOUR_STEPS).toHaveLength(8);
    expect(new Set(TOUR_STEPS.map((s) => s.id)).size).toBe(8);
    expect(TOUR_STEPS[TOUR_STEPS.length - 1].selector).toBeNull();
    expect(TOUR_STEPS.find((s) => s.id === "platform-filter")?.advanceOn).toBe("alt-scroll");
  });

  it("pula passos cujo alvo não existe", () => {
    const present = (sel: string) => !sel.includes("Sincronizar");
    expect(stepIndexFrom(1, 1, TOUR_STEPS, present)).toBe(2); // pula "sync"
    expect(stepIndexFrom(1, -1, TOUR_STEPS, present)).toBe(0);
  });

  it("o último passo (sem alvo) sempre vale; fora do fim devolve null", () => {
    expect(stepIndexFrom(7, 1, TOUR_STEPS, () => false)).toBe(7);
    expect(stepIndexFrom(8, 1, TOUR_STEPS, () => true)).toBeNull();
    expect(stepIndexFrom(-1, -1, TOUR_STEPS, () => true)).toBeNull();
  });
});

describe("tour: persistência", () => {
  it("começa do zero sem nada salvo e com dado corrompido", () => {
    const s = mem();
    expect(loadTourState("u", s)).toEqual({ step: 0, done: false });
    s.setItem(tourKey("u"), "{lixo");
    expect(loadTourState("u", s)).toEqual({ step: 0, done: false });
  });

  it("guarda e retoma o passo, limitando ao total", () => {
    const s = mem();
    saveTourState("u", { step: 3, done: false }, s);
    expect(loadTourState("u", s)).toEqual({ step: 3, done: false });
    s.setItem(tourKey("u"), JSON.stringify({ step: 99, done: true }));
    expect(loadTourState("u", s)).toEqual({ step: 7, done: true });
  });

  it("refazer zera o progresso e liga o modo forçado", () => {
    const s = mem();
    saveTourState("u", { step: 7, done: true }, s);
    restartTour("u", s);
    expect(loadTourState("u", s)).toEqual({ step: 0, done: false });
    expect(s.getItem(tourForceKey("u"))).toBe("1");
  });
});

describe("tour: posição do balão", () => {
  const vp = { width: 1200, height: 800 };
  const coach = { width: 340, height: 170 };

  it("prefere embaixo do alvo e centraliza nele", () => {
    const p = coachPlacement({ x: 500, y: 60, width: 40, height: 40 }, vp, coach);
    expect(p.side).toBe("bottom");
    expect(p.y).toBeGreaterThan(100);
    expect(p.x + coach.width / 2).toBeCloseTo(520, 0);
  });

  it("vai para cima quando embaixo não cabe", () => {
    const p = coachPlacement({ x: 500, y: 740, width: 40, height: 40 }, vp, coach);
    expect(p.side).toBe("top");
  });

  it("nunca sai da janela", () => {
    const p = coachPlacement({ x: 1190, y: 10, width: 10, height: 10 }, vp, coach);
    expect(p.x + coach.width).toBeLessThanOrEqual(vp.width);
    expect(p.x).toBeGreaterThanOrEqual(0);
  });

  it("sem alvo, centraliza", () => {
    const p = coachPlacement(null, vp, coach);
    expect(p).toMatchObject({ side: "center", x: 430, y: 315 });
  });
});
