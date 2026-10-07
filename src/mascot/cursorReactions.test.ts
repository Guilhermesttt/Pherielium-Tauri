import { describe, expect, it } from "vitest";
import {
  CURIOUS_TOP_BAND_PX,
  distanceToRect,
  dragPositionToCss,
  isCursorAtTop,
  isDragNearNotch,
  isMouseShake,
  summarizeImport,
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

describe("isDragNearNotch", () => {
  it("só arma a dropzone com o botão pressionado perto do notch", () => {
    expect(isDragNearNotch({ x: 800, y: 20, dragging: true }, notch, 1600)).toBe(true);
    expect(isDragNearNotch({ x: 800, y: 20, dragging: false }, notch, 1600)).toBe(false);
    expect(isDragNearNotch({ x: 800, y: 400, dragging: true }, notch, 1600)).toBe(false);
    expect(isDragNearNotch({ x: 200, y: 20, dragging: true }, notch, 1600)).toBe(false);
  });
});

describe("summarizeImport", () => {
  it("descreve o resultado em português", () => {
    expect(summarizeImport(1, 0)).toBe("1 imagem salva nas capturas");
    expect(summarizeImport(3, 0)).toBe("3 imagens salvas nas capturas");
    expect(summarizeImport(2, 1)).toBe("2 imagens salvas nas capturas (1 ignorada)");
    expect(summarizeImport(2, 4)).toBe("2 imagens salvas nas capturas (4 ignoradas)");
    expect(summarizeImport(0, 2)).toContain("Só imagens");
    expect(summarizeImport(0, 0)).toBe("Nada para salvar");
  });
});

describe("dragPositionToCss", () => {
  it("divide a posição física pela escala (e tolera escala inválida)", () => {
    expect(dragPositionToCss({ x: 300, y: 150 }, 1.5)).toEqual({ x: 200, y: 100 });
    expect(dragPositionToCss({ x: 300, y: 150 }, 0)).toEqual({ x: 300, y: 150 });
  });
});
