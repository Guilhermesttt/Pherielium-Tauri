import type { LocalParticipant, LocalTrackPublication } from "livekit-client";
import { Track } from "livekit-client";

export interface ScreenShareOptions {
  /** @deprecated Ignored — only the native getDisplayMedia picker is used. */
  sourceId?: string;
  resolution?: "720p" | "1080p" | "source";
  fps?: 30 | 60;
  /** Bitrate de vídeo escolhido pelo usuário, em Mbps; ausente ou "auto" usa a tabela por resolução e fps. */
  bitrateMbps?: number | "auto";
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

/** Opções do seletor de bitrate (Mbps). "auto" usa `SCREEN_SHARE_BITRATE`. */
export const BITRATE_CHOICES_MBPS = ["auto", 4, 6, 8, 12, 16, 20] as const;
export const MIN_SCREEN_SHARE_BITRATE_MBPS = 2;
export const MAX_SCREEN_SHARE_BITRATE_MBPS = 30;

/** Bitrate em bits/s: a escolha do usuário (limitada a 2 a 30 Mbps) ou a tabela quando é "auto"/inválida. */
export const resolveScreenShareBitrate = (
  resolution: "720p" | "1080p",
  fps: 30 | 60,
  choice?: number | "auto",
): number => {
  if (typeof choice === "number" && Number.isFinite(choice)) {
    const mbps = Math.min(MAX_SCREEN_SHARE_BITRATE_MBPS, Math.max(MIN_SCREEN_SHARE_BITRATE_MBPS, choice));
    return Math.round(mbps * 1_000_000);
  }
  return SCREEN_SHARE_BITRATE[resolution][fps];
};

/**
 * O fps escolhido é o que o usuário quer: o encoder reduz resolução e não quadros quando falta banda ou CPU.
 * Antes, em 30 fps era "balanced", que deixava o fps cair.
 */
export const screenShareDegradationPreference = (): "maintain-framerate" => "maintain-framerate";

export const screenShareProfile = (options: ScreenShareOptions) => {
  const fps: 30 | 60 = options.fps === 30 ? 30 : 60;
  const resolution: "720p" | "1080p" = options.resolution === "720p" ? "720p" : "1080p";
  const width = resolution === "720p" ? 1280 : 1920;
  const height = resolution === "720p" ? 720 : 1080;
  const bitrate = resolveScreenShareBitrate(resolution, fps, options.bitrateMbps);
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
  /** Full desktop / monitor surface, as reported by the capture track. */
  isMonitorShare: boolean;
};

/**
 * Política de áudio da transmissão. O áudio do PC vem SEMPRE da captura nativa (loopback excluindo o Pherielium);
 * o navegador nunca é fonte de áudio, porque seu "áudio do sistema" inclui a voz da chamada e voltaria como eco.
 * `warnNoAudio` é verdadeiro quando o usuário queria áudio e a captura nativa não subiu: o app avisa UMA vez.
 */
export function planScreenShareAudio(input: { includeAudio: boolean; nativeAudioStarted: boolean }): {
  requestBrowserAudio: false;
  warnNoAudio: boolean;
} {
  return { requestBrowserAudio: false, warnNoAudio: input.includeAudio && !input.nativeAudioStarted };
}

/** Remove (e para) qualquer trilha de áudio que o navegador tenha entregue mesmo sem pedir. Devolve quantas descartou. */
export function discardBrowserAudioTracks(stream: MediaStream): number {
  const tracks = stream.getAudioTracks();
  for (const track of tracks) {
    stream.removeTrack(track);
    track.stop();
  }
  return tracks.length;
}

/**
 * Diagnóstico (flag pherielium_stream_debug): o que o WebView2 informa sobre a superfície escolhida.
 * Serve para medir se `displaySurface` é confiável antes de decidir o áudio por superfície (docs/backend-audit/10-*.md).
 */
export function describeCaptureSurface(settings: MediaTrackSettings & { displaySurface?: string; cursor?: string }): string {
  const surface = settings.displaySurface ?? "(ausente)";
  const cursor = settings.cursor ?? "(ausente)";
  return `displaySurface=${surface} cursor=${cursor} ${settings.width ?? "?"}x${settings.height ?? "?"}@${settings.frameRate ?? "?"}`;
}

/**
 * Opens exactly one native getDisplayMedia picker (video only; see `planScreenShareAudio`).
 * Cancellation must not trigger a second picker or publish partial tracks.
 */
export async function captureNativeScreenShare(options: {
  width: number;
  height: number;
  fps: number;
  getDisplayMedia?: typeof navigator.mediaDevices.getDisplayMedia;
}): Promise<NativeScreenCaptureResult> {
  const getDisplayMedia =
    options.getDisplayMedia ?? navigator.mediaDevices.getDisplayMedia.bind(navigator.mediaDevices);
  const request = buildDisplayMediaRequest({
    width: options.width,
    height: options.height,
    fps: options.fps,
    withAudio: false,
  });

  const stream = await getDisplayMedia(request);
  discardBrowserAudioTracks(stream);
  const videoTrack = stream.getVideoTracks()[0];
  const isMonitorShare = videoTrack?.getSettings().displaySurface === "monitor";
  return { stream, isMonitorShare };
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
    degradationPreference: screenShareDegradationPreference(),
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
