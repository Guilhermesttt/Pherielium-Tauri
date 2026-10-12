import { describe, expect, it } from "vitest";
import { shouldPublishToGlobalPresenceBus } from "./presenceBusPolicy";

describe("shouldPublishToGlobalPresenceBus", () => {
  it("is off by default and when storage is unavailable", () => {
    expect(shouldPublishToGlobalPresenceBus({ getItem: () => null })).toBe(false);
    expect(shouldPublishToGlobalPresenceBus(null)).toBe(false);
  });

  it("can be turned back on with the flag", () => {
    expect(shouldPublishToGlobalPresenceBus({ getItem: (k) => (k === "pherielium_presence_global_bus" ? "1" : null) })).toBe(true);
  });
});
