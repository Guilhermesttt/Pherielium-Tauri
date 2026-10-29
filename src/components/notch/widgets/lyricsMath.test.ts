import { describe, expect, it } from "vitest";
import { activeLineIndex, type LyricLine } from "./lyricsMath";

const LINES: LyricLine[] = [
  { timeMs: 1000, text: "a" },
  { timeMs: 5000, text: "b" },
  { timeMs: 9000, text: "c" },
  { timeMs: 12000, text: "d" },
];

describe("activeLineIndex", () => {
  it("é -1 antes da primeira linha", () => {
    expect(activeLineIndex(LINES, 0, 0)).toBe(-1);
  });

  it("acha a última linha que já começou", () => {
    expect(activeLineIndex(LINES, 1000, 0)).toBe(0);
    expect(activeLineIndex(LINES, 8999, 0)).toBe(1);
    expect(activeLineIndex(LINES, 9000, 0)).toBe(2);
    expect(activeLineIndex(LINES, 999_999, 0)).toBe(3);
  });

  it("o adiantamento troca a linha um pouco antes", () => {
    expect(activeLineIndex(LINES, 8800, 250)).toBe(2);
    expect(activeLineIndex(LINES, 8800, 0)).toBe(1);
  });

  it("não quebra sem linhas", () => {
    expect(activeLineIndex([], 5000)).toBe(-1);
  });
});
