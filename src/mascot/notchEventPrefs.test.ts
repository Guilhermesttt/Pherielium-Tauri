import { describe, expect, it } from "vitest";
import {
  isNotchEventMuted,
  sanitizeMutedEvents,
  scaledNotchEventDuration,
} from "./notchEventPrefs";

describe("isNotchEventMuted", () => {
  it("only mutes informative kinds the user chose", () => {
    expect(isNotchEventMuted("friend-online", ["friend-online"])).toBe(true);
    expect(isNotchEventMuted("friend-online", [])).toBe(false);
    expect(isNotchEventMuted("capture-saved", ["friend-online"])).toBe(false);
  });

  it("never mutes messages, friend requests or achievements, even if they sneak into the list", () => {
    for (const kind of ["message", "friend-request", "friend-accepted", "achievement"]) {
      expect(isNotchEventMuted(kind, [kind, "friend-online"])).toBe(false);
    }
  });
});

describe("scaledNotchEventDuration", () => {
  it.each([
    [4000, 1, 4000],
    [4000, 2, 8000],
    [4000, 0.5, 2000],
    [4000, 9, 8000], // acima do máximo
    [4000, 0, 2000], // abaixo do mínimo
    [4000, Number.NaN, 4000],
  ])("%s ms x %s -> %s ms", (base, scale, expected) => {
    expect(scaledNotchEventDuration(base, scale)).toBe(expected);
  });
});

describe("sanitizeMutedEvents", () => {
  it("keeps valid kinds once, in canonical order, and drops the rest", () => {
    expect(sanitizeMutedEvents(["welcome", "message", "friend-online", "welcome", 7], [])).toEqual(["friend-online", "welcome"]);
  });

  it("falls back when the value is not a list", () => {
    expect(sanitizeMutedEvents("x", ["level-up"])).toEqual(["level-up"]);
    expect(sanitizeMutedEvents(undefined, [])).toEqual([]);
  });
});
