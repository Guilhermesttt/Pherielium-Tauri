import { describe, expect, it } from "vitest";
import { parsePresenceUpdatedAt, shouldAcceptPresence } from "./presenceOrdering";

describe("shouldAcceptPresence", () => {
  it("keeps online when a stale offline snapshot arrives", () => {
    expect(shouldAcceptPresence(100, 200)).toBe(false);
  });

  it("accepts offline when the snapshot is newer than the current state", () => {
    expect(shouldAcceptPresence(300, 200)).toBe(true);
  });

  it("accepts the first valid event when there is no current timestamp", () => {
    expect(shouldAcceptPresence(200, 0)).toBe(true);
  });

  it("rejects events with missing or invalid timestamps", () => {
    expect(shouldAcceptPresence(0, 200)).toBe(false);
    expect(shouldAcceptPresence(Number.NaN, 200)).toBe(false);
    expect(shouldAcceptPresence(-1, 200)).toBe(false);
  });

  it("accepts equal timestamps so reconnections can refresh state", () => {
    expect(shouldAcceptPresence(200, 200)).toBe(true);
  });
});

describe("parsePresenceUpdatedAt", () => {
  it("parses numeric epoch milliseconds", () => {
    expect(parsePresenceUpdatedAt(1_700_000_000_000)).toBe(1_700_000_000_000);
  });

  it("parses ISO strings", () => {
    const iso = "2026-01-15T12:00:00.000Z";
    expect(parsePresenceUpdatedAt(iso)).toBe(Date.parse(iso));
  });

  it("returns 0 for missing values", () => {
    expect(parsePresenceUpdatedAt(undefined)).toBe(0);
    expect(parsePresenceUpdatedAt(null)).toBe(0);
    expect(parsePresenceUpdatedAt("")).toBe(0);
  });
});
