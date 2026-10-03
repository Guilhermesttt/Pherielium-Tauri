import { describe, expect, it } from "vitest";
import { resolveSessionStartedAt } from "./sessionStartedAt";

describe("resolveSessionStartedAt", () => {
  it("uses confirmedAt when process started before launch click", () => {
    const launchedAt = 1_000_000;
    const confirmedAt = 1_000_500;
    expect(resolveSessionStartedAt(launchedAt, 999_000, confirmedAt)).toBe(confirmedAt);
  });

  it("uses processStartTimeMs when it is after launch click", () => {
    const launchedAt = 1_000_000;
    const processStart = 1_000_200;
    expect(resolveSessionStartedAt(launchedAt, processStart, 1_000_500)).toBe(processStart);
  });

  it("falls back to confirmedAt when process time is missing", () => {
    const launchedAt = 1_000_000;
    const confirmedAt = 1_000_300;
    expect(resolveSessionStartedAt(launchedAt, null, confirmedAt)).toBe(confirmedAt);
  });
});
