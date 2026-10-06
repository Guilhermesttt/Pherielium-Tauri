import { describe, it, expect } from "vitest";
import { getSfSymbolUrl, getSfSymbolFillVariant } from "./sfSymbolsMap";
import type { SfSymbolName } from "./types";

describe("Apple SF Symbols System", () => {
  it("resolves asset URLs for core symbols", () => {
    const coreSymbols: SfSymbolName[] = [
      "gamecontroller",
      "gamecontroller.fill",
      "star",
      "star.fill",
      "person.2",
      "person.2.fill",
      "dot.radiowaves.left.and.right",
      "hammer",
      "hammer.fill",
      "desktopcomputer",
      "person.crop.circle",
      "person.crop.circle.fill",
      "rosette",
      "gear",
      "folder",
      "folder.fill",
      "car",
      "shield",
      "globe",
      "scope",
      "flame",
      "map",
      "bolt",
    ];

    for (const name of coreSymbols) {
      const url = getSfSymbolUrl(name);
      expect(url).toBeDefined();
      expect(typeof url).toBe("string");
      expect(url!.length).toBeGreaterThan(0);
    }
  });

  it("identifies fill variants for outline symbols", () => {
    expect(getSfSymbolFillVariant("gamecontroller")).toBe("gamecontroller.fill");
    expect(getSfSymbolFillVariant("star")).toBe("star.fill");
    expect(getSfSymbolFillVariant("person.2")).toBe("person.2.fill");
    expect(getSfSymbolFillVariant("hammer")).toBe("hammer.fill");
    expect(getSfSymbolFillVariant("folder")).toBe("folder.fill");
    expect(getSfSymbolFillVariant("star.fill")).toBe("star.fill");
  });

  it("handles symbols without a fill variant gracefully", () => {
    expect(getSfSymbolFillVariant("gear")).toBeUndefined();
    expect(getSfSymbolFillVariant("scope")).toBeUndefined();
    expect(getSfSymbolFillVariant("desktopcomputer")).toBeUndefined();
  });
});
