/**
 * LiveKit Krisp noise filter — attaches to the published LocalAudioTrack.
 * Requires LiveKit Cloud for full support; fails soft when unavailable.
 */

import type { LocalAudioTrack, TrackProcessor } from "livekit-client";

export type KrispProcessorHandle = {
  setEnabled: (enabled: boolean) => Promise<void>;
  isEnabled?: () => boolean;
  name?: string;
};

let activeProcessor: KrispProcessorHandle | null = null;
let attachedTrack: LocalAudioTrack | null = null;

export function isKrispActive(): boolean {
  return Boolean(activeProcessor);
}

export async function detachKrispFromTrack(track?: LocalAudioTrack | null): Promise<void> {
  const target = track ?? attachedTrack;
  if (!target) {
    activeProcessor = null;
    attachedTrack = null;
    return;
  }
  try {
    if (typeof target.stopProcessor === "function") {
      await target.stopProcessor();
    }
  } catch (err) {
    console.warn("[krisp] stopProcessor warning:", err);
  }
  activeProcessor = null;
  attachedTrack = null;
}

/**
 * Attach Krisp to a LiveKit LocalAudioTrack (mic). Idempotent.
 * Returns true when Krisp is running.
 */
export async function attachKrispToTrack(
  track: LocalAudioTrack,
  enabled = true,
): Promise<boolean> {
  try {
    const mod = await import("@livekit/krisp-noise-filter");
    const supported =
      typeof mod.isKrispNoiseFilterSupported === "function"
        ? mod.isKrispNoiseFilterSupported()
        : true;

    if (!supported) {
      console.warn("[krisp] Noise filter not supported in this browser");
      return false;
    }

    // Re-use existing processor on same track
    if (attachedTrack === track && activeProcessor) {
      await activeProcessor.setEnabled(enabled);
      return enabled;
    }

    // Switch tracks — clean previous
    if (attachedTrack && attachedTrack !== track) {
      await detachKrispFromTrack(attachedTrack);
    }

    const existing = typeof track.getProcessor === "function" ? track.getProcessor() : null;
    if (existing && (existing as { name?: string }).name === "livekit-noise-filter") {
      activeProcessor = existing as unknown as KrispProcessorHandle;
      attachedTrack = track;
      await activeProcessor.setEnabled(enabled);
      return enabled;
    }

    const processor = mod.KrispNoiseFilter({
      quality: "high",
      useBVC: true,
    }) as KrispProcessorHandle & TrackProcessor<any, any>;
    await track.setProcessor(processor as TrackProcessor<any, any>);
    await processor.setEnabled(enabled);
    activeProcessor = processor;
    attachedTrack = track;
    console.info("[krisp] Noise filter attached to microphone track");
    return enabled;
  } catch (err) {
    console.warn("[krisp] Failed to attach Krisp filter:", err);
    activeProcessor = null;
    attachedTrack = null;
    return false;
  }
}

export async function setKrispEnabled(enabled: boolean): Promise<void> {
  if (!activeProcessor) return;
  try {
    await activeProcessor.setEnabled(enabled);
  } catch (err) {
    console.warn("[krisp] setEnabled failed:", err);
  }
}
