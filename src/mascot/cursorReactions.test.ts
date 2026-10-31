import { describe, expect, it } from "vitest";
import {
  CURIOUS_TOP_BAND_PX,
  distanceToRect,
  isCursorAtTop,
  isMouseShake,
} from "./cursorReactions";

const notch = { left: 700, right: 900, top: 0, bottom: 40 };

describe("distanceToRect", () => {
  it("é 0 dentro do retângulo e cresce para fora", () => {
    expect(distanceToRect(800, 20, notch, 1600)).toBe(0);
    expect(distanceToRect(950, 20, notch, 1600)).toBe(50);
    expect(distanceToRect(800, 100, notch, 1600)).toBe(60);
    expect(distanceToRect(930, 80, notch, 1600)).toBe(50); // diagonal 30,40 -> 50
  });

  it("sem notch visível usa o topo central da tela", () => {
    expect(distanceToRect(800, 10, null, 1600)).toBe(0);
    expect(distanceToRect(100, 10, null, 1600)).toBeGreaterThan(600);
  });
});

describe("isMouseShake", () => {
  it("precisa de inversões E velocidade E estar perto do notch", () => {
    expect(isMouseShake({ speed: 1200, reversals: 5 }, 100)).toBe(true);
    expect(isMouseShake({ speed: 1200, reversals: 3 }, 100)).toBe(false); // poucas inversões
    expect(isMouseShake({ speed: 300, reversals: 6 }, 100)).toBe(false); // devagar
    expect(isMouseShake({ speed: 1200, reversals: 6 }, 400)).toBe(false); // longe do notch
  });
});

describe("isCursorAtTop", () => {
  it("só vale na faixa do topo e na altura do notch", () => {
    expect(isCursorAtTop({ x: 800, y: 10 }, notch, 1600)).toBe(true);
    expect(isCursorAtTop({ x: 800, y: CURIOUS_TOP_BAND_PX + 10 }, notch, 1600)).toBe(false);
    expect(isCursorAtTop({ x: 100, y: 10 }, notch, 1600)).toBe(false);
  });
});
