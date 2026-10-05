import type { LocalParticipant, LocalTrackPublication } from "livekit-client";
import { Track } from "livekit-client";

export interface ScreenShareOptions {
  /** @deprecated Ignored — only the native getDisplayMedia picker is used. */
  sourceId?: string;
  resolution?: "720p" | "1080p" | "source";
  fps?: 30 | 60;
  withAudio?: boolean;
  /** @deprecated Spectral filtering was removed; isolation uses display-media constraints. */
  callAudioBarrier?: boolean;
}

export const SCREEN_SHARE_BITRATE: Record<"720p" | "1080p", Record<30 | 60, number>> = {
  "720p": {
    30: 4_500_000,
    60: 6_500_000,
  },
  "1080p": {
    30: 8_000_000,
    60: 12_000_000,
  },
};

/** Non-standard Chromium display-media options (Chrome 105+ / 141+). */
export interface DisplayMediaCaptureOptions extends DisplayMediaStreamOptions {
  systemAudio?: "include" | "exclude";
  windowAudio?: "exclude" | "system" | "window";
}

/** Extended audio constraints for display capture isolation. */
export interface ScreenShareAudioTrackConstraints extends MediaTrackConstraints {
  restrictOwnAudio?: boolean;
}

export const screenShareProfile = (options: ScreenShareOptions) => {
  const fps: 30 | 60 = options.fps === 30 ? 30 : 60;
  const resolution: "720p" | "1080p" = options.resolution === "720p" ? "720p" : "1080p";
  const width = resolution === "720p" ? 1280 : 1920;
  const height = resolution === "720p" ? 720 : 1080;
  const bitrate = SCREEN_SHARE_BITRATE[resolution][fps];
  return { fps, resolution, width, height, bitrate };
};

export const screenShareVideoConstraints = (
  width: number,
  height: number,
  fps: number,
): MediaTrackConstraints => ({
  width: { ideal: width, max: width },
  height: { ideal: height, max: height },
  frameRate: { ideal: fps, max: fps },
});

/** Chromium-only constraint flags not yet in lib.dom MediaTrackSupportedConstraints. */
export interface ScreenShareSupportedConstraints extends MediaTrackSupportedConstraints {
  restrictOwnAudio?: boolean;
}

const readSupportedConstraints = (): ScreenShareSupportedConstraints => {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getSupportedConstraints) {
    return {};
  }
  return navigator.mediaDevices.getSupportedConstraints() as ScreenShareSupportedConstraints;
};

/**
 * Capture constraints for screen-share audio.
 * restrictOwnAudio keeps this app's own output out of the capture when Chromium
 * supports it. suppressLocalAudioPlayback is intentionally omitted: it silences
 * local speakers for whatever is being captured.
 */
export const screenShareAudioBarrierConstraints = (
  supported: ScreenShareSupportedConstraints = readSupportedConstraints(),
): ScreenShareAudioTrackConstraints => {
  const audio: ScreenShareAudioTrackConstraints = {};

  if (supported.restrictOwnAudio) {
    audio.restrictOwnAudio = true;
  }

  return audio;
};

/**
 * Builds a single getDisplayMedia request with video quality presets and the
 * audio isolation barrier applied together.
 */
export const buildDisplayMediaRequest = (options: {
  width: number;
  height: number;
  fps: number;
  withAudio: boolean;
  supportedConstraints?: ScreenShareSupportedConstraints;
}): DisplayMediaCaptureOptions => {
  const video = screenShareVideoConstraints(options.width, options.height, options.fps);

  if (!options.withAudio) {
    return { video, audio: false };
  }

  return {
    video,
    audio: screenShareAudioBarrierConstraints(options.supportedConstraints),
    // Monitor-wide mix includes this app. Window audio is captured instead.
    // Process-level loopback (exclude Pherielium) replaces this in a later phase.
    systemAudio: "exclude",
    windowAudio: "window",
  };
};

export function isDisplayMediaCancelledError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = String((error as { name?: string }).name || "");
  return name === "NotAllowedError" || name === "AbortError";
}

export type NativeScreenCaptureResult = {
  stream: MediaStream;
  hasSystemAudio: boolean;
  /** Full desktop / monitor surface, as reported by the capture track. */
  isMonitorShare: boolean;
};

/**
 * Opens exactly one native getDisplayMedia picker.
 * Cancellation must not trigger a second picker or publish partial tracks.
 */
export async function captureNativeScreenShare(options: {
  width: number;
  height: number;
  fps: number;
  withAudio: boolean;
  getDisplayMedia?: typeof navigator.mediaDevices.getDisplayMedia;
  supportedConstraints?: ScreenShareSupportedConstraints;
}): Promise<NativeScreenCaptureResult> {
  const getDisplayMedia =
    options.getDisplayMedia ?? navigator.mediaDevices.getDisplayMedia.bind(navigator.mediaDevices);
  const request = buildDisplayMediaRequest({
    width: options.width,
    height: options.height,
    fps: options.fps,
    withAudio: options.withAudio,
    supportedConstraints: options.supportedConstraints,
  });

  const stream = await getDisplayMedia(request);
  const videoTrack = stream.getVideoTracks()[0];
  if (!videoTrack) {
    return { stream, hasSystemAudio: false, isMonitorShare: false };
  }

  const isMonitorShare = videoTrack.getSettings().displaySurface === "monitor";
  const hasSystemAudio = options.withAudio && stream.getAudioTracks().length > 0;

  return {
    stream,
    hasSystemAudio,
    isMonitorShare,
  };
}

export type ScreenSharePublishResult = {
  videoPublication: LocalTrackPublication;
  audioPublication?: LocalTrackPublication;
};

/**
 * Publishes the native capture stream to LiveKit as screen + optional screen audio.
 */
export async function publishScreenShareTracks(
  localParticipant: LocalParticipant,
  stream: MediaStream,
  options: {
    fps: number;
    bitrate: number;
  },
): Promise<ScreenSharePublishResult> {
  const videoTrack = stream.getVideoTracks()[0];
  if (!videoTrack) {
    throw new Error("Screen capture returned no video track");
  }

  const videoPublication = await localParticipant.publishTrack(videoTrack, {
    name: "screen",
    source: Track.Source.ScreenShare,
    simulcast: false,
    degradationPreference: options.fps >= 60 ? "maintain-framerate" : "balanced",
    videoCodec: "h264",
    videoEncoding: {
      maxBitrate: options.bitrate,
      maxFramerate: options.fps,
      priority: "high",
    },
  });

  const screenAudioTrack = stream.getAudioTracks()[0];
  let audioPublication: LocalTrackPublication | undefined;
  if (screenAudioTrack) {
    audioPublication = await localParticipant.publishTrack(screenAudioTrack, {
      name: "screen-audio",
      source: Track.Source.ScreenShareAudio,
    });
  }

  return { videoPublication, audioPublication };
}

export function releaseScreenCaptureStream(stream: MediaStream | null | undefined): void {
  stream?.getTracks().forEach((track) => {
    try {
      track.stop();
    } catch {
      // ignore
    }
  });
}
