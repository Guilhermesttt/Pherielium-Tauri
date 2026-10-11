import { describe, expect, it } from "vitest";
import { peerKeyForFeed, sliderEffects } from "./volumeKeys";

/**
 * Characterization tests: they pin the behavior that the inline logic in
 * VoiceCallWindow had BEFORE it was extracted into volumeKeys.ts (commit 3d15192),
 * including the known coupling bug on "remote-screen". They prove the extraction
 * was behavior-preserving; the fix commit updates the affected rows deliberately.
 */
describe("peerKeyForFeed (current behavior)", () => {
  it.each([
    ["remote-user", "remote-user"],
    ["remote-user:abc", "abc"],
    ["remote-screen", "remote-screen"],
    ["remote-screen:abc", "screen:abc"],
    ["echo-bot", "echo-bot"],
  ])("%s -> %s", (feedId, expected) => {
    expect(peerKeyForFeed(feedId)).toBe(expected);
  });
});

describe("sliderEffects (current behavior)", () => {
  it.each([
    ["remote-user", ["remote-user", "friend-uid"], true],
    ["remote-user:abc", ["abc", "remote-user:abc"], false],
    ["remote-screen", ["remote-screen"], true], // BUG(known): screen slider also moves the global (voice) volume
    ["remote-screen:abc", ["screen:abc", "remote-screen:abc"], false],
    ["echo-bot", ["echo-bot"], true],
  ])("%s", (feedId, peerKeys, global) => {
    expect(sliderEffects(feedId, "friend-uid")).toEqual({
      peerKeys,
      changesGlobalRemoteVolume: global,
    });
  });

  it("does not add the friend key without a friendUid", () => {
    expect(sliderEffects("remote-user", null).peerKeys).toEqual(["remote-user"]);
  });
});

describe("mute keys (current behavior)", () => {
  // The mute handler writes peerKeyForFeed(feedId) and feedId, never the friend key
  // and never the global volume.
  it.each([
    ["remote-user:abc", ["abc", "remote-user:abc"]],
    ["remote-screen:abc", ["screen:abc", "remote-screen:abc"]],
    ["remote-screen", ["remote-screen"]],
  ])("%s", (feedId, expected) => {
    const written = Array.from(new Set([peerKeyForFeed(feedId), feedId]));
    expect(written).toEqual(expected);
  });
});
