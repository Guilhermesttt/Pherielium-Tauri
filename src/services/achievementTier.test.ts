import { describe, expect, it } from "vitest";
import { isCacheFresh, tierFromGlobalPercent } from "./achievementTier";

describe("tierFromGlobalPercent", () => {
  it.each([
    [0.5, "platinum"],
    [5, "platinum"],
    [5.1, "gold"],
    [20, "gold"],
    [35, "silver"],
    [50, "silver"],
    [80, "bronze"],
  ] as const)("%s%% -> %s", (percent, tier) => {
    expect(tierFromGlobalPercent(percent)).toBe(tier);
  });

  it.each([[0], [-1], [Number.NaN], [undefined], [null], ["5"]])(
    "unknown percent %s is bronze, never platinum (regression: a missing percentage showed as platinum)",
    (percent) => {
      expect(tierFromGlobalPercent(percent)).toBe("bronze");
    },
  );
});

describe("isCacheFresh", () => {
  it("compares the age with the limit", () => {
    expect(isCacheFresh(0, 59_999, 60_000)).toBe(true);
    expect(isCacheFresh(0, 60_000, 60_000)).toBe(false);
  });
});
