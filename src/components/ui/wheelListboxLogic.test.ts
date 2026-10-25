import { describe, expect, it } from "vitest";
import { columnOffset, moveFocus, rowVisual } from "./wheelListboxLogic";

describe("rowVisual", () => {
  it("a linha em foco é nítida e inteira", () => {
    expect(rowVisual(0)).toEqual({ opacity: 1, blur: 0, scale: 1, x: 0 });
  });

  it("quanto mais longe, mais apagada, menor e desfocada", () => {
    const near = rowVisual(1);
    const far = rowVisual(3);
    expect(far.opacity).toBeLessThan(near.opacity);
    expect(far.blur).toBeGreaterThan(near.blur);
    expect(far.scale).toBeLessThan(near.scale);
  });

  it("é simétrica para cima e para baixo e nunca some de vez", () => {
    expect(rowVisual(-2)).toEqual(rowVisual(2));
    expect(rowVisual(40).opacity).toBeGreaterThan(0);
    expect(rowVisual(40).blur).toBeLessThanOrEqual(5);
  });
});

describe("moveFocus", () => {
  it("anda e para nas pontas", () => {
    expect(moveFocus(2, 1, 5)).toBe(3);
    expect(moveFocus(4, 1, 5)).toBe(4);
    expect(moveFocus(0, -1, 5)).toBe(0);
    expect(moveFocus(1, 10, 5)).toBe(4);
  });

  it("lista vazia fica no zero", () => {
    expect(moveFocus(0, 1, 0)).toBe(0);
  });
});

describe("columnOffset", () => {
  it("centraliza a linha em foco na janela", () => {
    // janela de 200 com linhas de 40: a linha 0 começa em 80 (centro 100)
    expect(columnOffset(0, 40, 200)).toBe(80);
    expect(columnOffset(3, 40, 200)).toBe(-40);
  });
});
