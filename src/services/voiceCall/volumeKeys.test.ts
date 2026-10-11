import { describe, expect, it } from "vitest";
import { sliderEffects } from "./volumeKeys";

describe("sliderEffects: screen volume must not touch voice", () => {
  // BUG(known): "remote-screen" has no ":" so it hits onChangeRemoteVolume, which is
  // also the fallback volume for every voice track. it.fails keeps CI green until the
  // fix commit turns this into a plain it().
  it.fails("screen feed without peer id does not move the global remote volume", () => {
    expect(sliderEffects("remote-screen").changesGlobalRemoteVolume).toBe(false);
  });

  it("screen feeds never write keys that the voice lookup reads", () => {
    for (const feed of ["remote-screen", "remote-screen:abc"]) {
      const keys = sliderEffects(feed).peerKeys;
      expect(keys).not.toContain("abc");
      expect(keys).not.toContain("remote-user");
      expect(keys.some((k) => k.startsWith("remote-user"))).toBe(false);
    }
  });

  it("voice feeds never write screen keys", () => {
    for (const feed of ["remote-user", "remote-user:abc"]) {
      const keys = sliderEffects(feed, "friend").peerKeys;
      expect(keys.some((k) => k.includes("screen"))).toBe(false);
    }
  });
});
