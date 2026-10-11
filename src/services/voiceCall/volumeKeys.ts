/**
 * Maps call-window feed ids (e.g. "remote-screen:uid") to the keys used in the
 * peer-volume map and decides which state a volume slider touches.
 *
 * Pure on purpose (no DOM, no React) so it can be unit-tested in node.
 */

export interface SliderEffects {
  /** Keys written into the peer-volume map. */
  peerKeys: string[];
  /** Whether the slider also moves the global remote volume. */
  changesGlobalRemoteVolume: boolean;
}

/** Key used for the per-peer volume entry of a feed. */
export function peerKeyForFeed(feedId: string): string {
  if (feedId.startsWith("remote-screen:")) return `screen:${feedId.slice("remote-screen:".length)}`;
  if (feedId === "remote-screen") return "remote-screen";
  if (feedId.startsWith("remote-user:")) return feedId.slice("remote-user:".length);
  return feedId;
}

/** What a volume slider (or mute toggle) on `feedId` writes. */
export function sliderEffects(feedId: string, friendUid?: string | null): SliderEffects {
  const peerKeys = [peerKeyForFeed(feedId), feedId];
  if (feedId === "remote-user" && friendUid) peerKeys.push(friendUid);
  return {
    peerKeys: Array.from(new Set(peerKeys)),
    changesGlobalRemoteVolume: feedId === "remote-user" || !feedId.includes(":"),
  };
}
