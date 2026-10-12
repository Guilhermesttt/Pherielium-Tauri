import { describe, expect, it } from "vitest";
import { isFlagOn, readFlag, readModeFlag, type FlagStorage } from "./featureFlags";

const store = (values: Record<string, string>): FlagStorage => ({
  getItem: (key) => (key in values ? values[key] : null),
});

describe("featureFlags", () => {
  it("reads with the pherielium_ prefix", () => {
    expect(readFlag("x", store({ pherielium_x: "1" }))).toBe("1");
    expect(readFlag("x", store({ x: "1" }))).toBeNull();
  });

  it("uses the default when absent, unreadable or unknown", () => {
    expect(isFlagOn("x", true, store({}))).toBe(true);
    expect(isFlagOn("x", false, store({}))).toBe(false);
    expect(isFlagOn("x", true, store({ pherielium_x: "maybe" }))).toBe(true);
    expect(isFlagOn("x", false, null)).toBe(false);
    const throwing: FlagStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
    };
    expect(isFlagOn("x", true, throwing)).toBe(true);
  });

  it.each([
    ["1", true],
    ["true", true],
    ["ON", true],
    ["0", false],
    ["false", false],
    ["Off", false],
  ])("parses %s", (raw, expected) => {
    expect(isFlagOn("x", !expected, store({ pherielium_x: raw }))).toBe(expected);
  });

  it("validates mode flags against the allowed list", () => {
    const modes = ["off", "log", "enforce"] as const;
    expect(readModeFlag("g", modes, "log", store({}))).toBe("log");
    expect(readModeFlag("g", modes, "log", store({ pherielium_g: "ENFORCE" }))).toBe("enforce");
    expect(readModeFlag("g", modes, "log", store({ pherielium_g: "nonsense" }))).toBe("log");
  });
});
