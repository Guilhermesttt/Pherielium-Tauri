import { describe, expect, it } from "vitest";
import { focusCapturesKeys, isPointerAtEdge, shouldOpenEdgeDrawer } from "./edgeDrawer";

describe("isPointerAtEdge", () => {
  it("esquerda e direita", () => {
    expect(isPointerAtEdge("left", 5, 1440, 12)).toBe(true);
    expect(isPointerAtEdge("left", 40, 1440, 12)).toBe(false);
    expect(isPointerAtEdge("right", 1435, 1440, 12)).toBe(true);
    expect(isPointerAtEdge("right", 1000, 1440, 12)).toBe(false);
  });
});

describe("shouldOpenEdgeDrawer", () => {
  const base = { side: "right" as const, clientX: 1438, viewportWidth: 1440, edgePx: 12 };

  it("abre ao encostar na borda quando livre", () => {
    expect(shouldOpenEdgeDrawer({ ...base, locked: false })).toBe(true);
  });

  it("com a tela do jogo aberta nunca abre, mesmo na borda (o bug: abria por trás)", () => {
    expect(shouldOpenEdgeDrawer({ ...base, locked: true })).toBe(false);
    expect(shouldOpenEdgeDrawer({ ...base, side: "left", clientX: 2, locked: true })).toBe(false);
  });
});

describe("focusCapturesKeys", () => {
  const inside = { closest: (selector: string) => (selector === "[data-captures-keys]" ? {} : null) };
  const outside = { closest: () => null };

  it("foco dentro da gaveta: os atalhos da Home não agem", () => {
    expect(focusCapturesKeys(inside as unknown as Element)).toBe(true);
  });

  it("foco fora, ou sem foco: os atalhos da Home seguem valendo", () => {
    expect(focusCapturesKeys(outside as unknown as Element)).toBe(false);
    expect(focusCapturesKeys(null)).toBe(false);
  });
});
