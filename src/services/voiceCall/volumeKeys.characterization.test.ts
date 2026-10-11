import { describe, expect, it } from "vitest";
import { sliderEffects } from "./volumeKeys";

/**
 * Feed id -> key written -> moves the global (voice) volume?
 *
 * Before the fix (commit 3d15192 / a67b139) the rows were:
 *   remote-user        -> remote-user, <friendUid>        -> yes
 *   remote-user:abc    -> abc, remote-user:abc            -> no
 *   remote-screen      -> remote-screen                   -> yes   BUG(known)
 *   remote-screen:abc  -> screen:abc, remote-screen:abc   -> no
 *   echo-bot           -> echo-bot                        -> yes
 * After the fix every feed writes exactly one namespaced key; only the voice
 * feeds that had no ":" keep moving the global voice volume.
 */
describe("sliderEffects (after fix)", () => {
  it.each([
    ["remote-user", "voice:friend-uid", true],
    ["remote-user:abc", "voice:abc", false],
    ["remote-screen", "screen:friend-uid", false],
    ["remote-screen:abc", "screen:abc", false],
    ["echo-bot", "voice:echo-bot", true],
  ])("%s -> %s (global: %s)", (feedId, key, global) => {
    const effects = sliderEffects(feedId, "friend-uid");
    expect(effects.key).toBe(key);
    expect(effects.changesGlobalRemoteVolume).toBe(global);
  });

  it("legacy single-peer feeds use the kind default when the friend is unknown", () => {
    expect(sliderEffects("remote-user", null).key).toBe("voice:");
    expect(sliderEffects("remote-screen", null).key).toBe("screen:");
  });
});
