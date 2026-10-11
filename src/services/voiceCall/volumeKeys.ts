/**
 * Per-viewer volume model for the call window: which stored volume belongs to which
 * audio track, and how it resolves to the value applied on an <audio> element.
 *
 * Voice and screen-share audio are two independent "kinds". They never share a key
 * and never fall back to each other, so moving one slider cannot change the other.
 *
 * Pure on purpose (no DOM, no React) so it runs under vitest's node environment.
 * Persistence lives in volumeStore.ts; wiring lives in useVoiceCall / VoiceCallWindow.
 */

export type VolumeKind = "voice" | "screen";

export interface VolumeTarget {
  kind: VolumeKind;
  /**
   * Stable user id (LiveKit identity === Supabase uid). Empty string is the
   * "default for this kind" entry used by the legacy single-peer feeds.
   */
  id: string;
}

/** Highest slider value per kind. Screen audio is capped until real boost exists. */
export const MAX_VOLUME_PERCENT: Record<VolumeKind, number> = { voice: 200, screen: 100 };

/** Screen audio starts at full volume; it deliberately ignores the voice default. */
export const DEFAULT_SCREEN_VOLUME_PERCENT = 100;

/** Key of a target inside the volume / muted maps. */
export function volumeKey(target: VolumeTarget): string {
  return `${target.kind}:${target.id}`;
}

/** Maps a call-window feed id ("remote-screen:uid", "remote-user", ...) to its target. */
export function targetForFeed(feedId: string, friendUid?: string | null): VolumeTarget {
  const friend = friendUid ?? "";
  if (feedId === "remote-screen") return { kind: "screen", id: friend };
  if (feedId.startsWith("remote-screen:")) return { kind: "screen", id: feedId.slice("remote-screen:".length) };
  if (feedId === "remote-user") return { kind: "voice", id: friend };
  if (feedId.startsWith("remote-user:")) return { kind: "voice", id: feedId.slice("remote-user:".length) };
  return { kind: "voice", id: feedId };
}

export interface SliderEffects {
  target: VolumeTarget;
  key: string;
  /** Voice-only: the legacy 1:1 voice feed also moves the global remote volume. */
  changesGlobalRemoteVolume: boolean;
}

/** What a volume slider (or mute toggle) on `feedId` writes. */
export function sliderEffects(feedId: string, friendUid?: string | null): SliderEffects {
  const target = targetForFeed(feedId, friendUid);
  return {
    target,
    key: volumeKey(target),
    changesGlobalRemoteVolume: target.kind === "voice" && !feedId.includes(":"),
  };
}

export type VolumeMap = Record<string, number>;
export type MutedMap = Record<string, boolean>;

/**
 * Stored percent for a target: its own entry, else the default entry of the SAME kind,
 * else `fallbackPercent`. Never reads another kind.
 */
export function storedPercent(volumes: VolumeMap, target: VolumeTarget, fallbackPercent: number): number {
  return (
    volumes[volumeKey(target)] ??
    volumes[volumeKey({ kind: target.kind, id: "" })] ??
    fallbackPercent
  );
}

export function isTargetMuted(muted: MutedMap, target: VolumeTarget): boolean {
  return muted[volumeKey(target)] ?? muted[volumeKey({ kind: target.kind, id: "" })] ?? false;
}

export interface ResolveInput {
  volumes: VolumeMap;
  muted: MutedMap;
  /** Volume used for voice targets with no stored entry (the global remote volume). */
  voiceFallbackPercent: number;
  deafened: boolean;
}

/** Percent that should actually play: 0 when deafened or muted. */
export function effectivePercent(target: VolumeTarget, input: ResolveInput): number {
  if (input.deafened || isTargetMuted(input.muted, target)) return 0;
  const fallback = target.kind === "voice" ? input.voiceFallbackPercent : DEFAULT_SCREEN_VOLUME_PERCENT;
  return storedPercent(input.volumes, target, fallback);
}

/**
 * Value for HTMLMediaElement.volume. The element cannot exceed 1.0, so the clamp is
 * applied here at use time and the stored percent stays as the user left it.
 */
export function toElementVolume(percent: number): number {
  if (!Number.isFinite(percent)) return 1;
  return Math.max(0, Math.min(1, percent / 100));
}
