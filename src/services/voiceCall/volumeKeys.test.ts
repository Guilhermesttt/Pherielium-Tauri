import { describe, expect, it } from "vitest";
import {
  effectivePercent,
  sliderEffects,
  storedPercent,
  targetForFeed,
  toElementVolume,
  volumeKey,
} from "./volumeKeys";

describe("screen volume must not touch voice (and vice versa)", () => {
  it("screen feed without peer id does not move the global remote volume", () => {
    // Was BUG(known): "remote-screen" used to call onChangeRemoteVolume, the voice fallback.
    expect(sliderEffects("remote-screen").changesGlobalRemoteVolume).toBe(false);
  });

  it("screen and voice of the same user get different keys", () => {
    const voice = sliderEffects("remote-user:abc").key;
    const screen = sliderEffects("remote-screen:abc").key;
    expect(voice).toBe("voice:abc");
    expect(screen).toBe("screen:abc");
  });

  it("changing the screen volume leaves the voice volume untouched", () => {
    const volumes = { [volumeKey({ kind: "voice", id: "abc" })]: 80 };
    const withScreen = { ...volumes, [sliderEffects("remote-screen:abc").key]: 10 };
    const input = { volumes: withScreen, muted: {}, voiceFallbackPercent: 100, deafened: false };
    expect(effectivePercent(targetForFeed("remote-user:abc"), input)).toBe(80);
    expect(effectivePercent(targetForFeed("remote-screen:abc"), input)).toBe(10);
  });

  it("changing the voice volume leaves the screen volume untouched", () => {
    const input = {
      volumes: { "voice:abc": 30, "screen:abc": 90 },
      muted: {},
      voiceFallbackPercent: 100,
      deafened: false,
    };
    expect(effectivePercent(targetForFeed("remote-screen:abc"), input)).toBe(90);
  });
});

describe("no cross-kind fallback", () => {
  it("screen ignores the voice default and the global voice fallback", () => {
    const volumes = { "voice:": 20, "voice:abc": 20 };
    expect(storedPercent(volumes, { kind: "screen", id: "abc" }, 100)).toBe(100);
    expect(
      effectivePercent({ kind: "screen", id: "abc" }, { volumes, muted: {}, voiceFallbackPercent: 20, deafened: false }),
    ).toBe(100);
  });

  it("voice falls back to its own kind default, then the global volume", () => {
    expect(storedPercent({ "voice:": 40 }, { kind: "voice", id: "abc" }, 70)).toBe(40);
    expect(storedPercent({}, { kind: "voice", id: "abc" }, 70)).toBe(70);
  });
});

describe("independent mute", () => {
  const base = { volumes: { "voice:abc": 80, "screen:abc": 60 }, voiceFallbackPercent: 100, deafened: false };

  it("muting the screen keeps the voice audible", () => {
    const input = { ...base, muted: { "screen:abc": true } };
    expect(effectivePercent({ kind: "screen", id: "abc" }, input)).toBe(0);
    expect(effectivePercent({ kind: "voice", id: "abc" }, input)).toBe(80);
  });

  it("muting the voice keeps the screen audible, and the stored volume survives", () => {
    const input = { ...base, muted: { "voice:abc": true } };
    expect(effectivePercent({ kind: "voice", id: "abc" }, input)).toBe(0);
    expect(effectivePercent({ kind: "screen", id: "abc" }, input)).toBe(60);
    expect(storedPercent(input.volumes, { kind: "voice", id: "abc" }, 100)).toBe(80);
  });

  it("deafen silences both", () => {
    const input = { ...base, muted: {}, deafened: true };
    expect(effectivePercent({ kind: "voice", id: "abc" }, input)).toBe(0);
    expect(effectivePercent({ kind: "screen", id: "abc" }, input)).toBe(0);
  });
});

describe("toElementVolume", () => {
  it.each([
    [0, 0],
    [50, 0.5],
    [100, 1],
    [200, 1], // HTMLMediaElement.volume cannot exceed 1.0
    [-5, 0],
    [Number.NaN, 1],
  ])("%s%% -> %s", (percent, expected) => {
    expect(toElementVolume(percent)).toBe(expected);
  });
});
