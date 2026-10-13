import { describe, expect, it, vi } from "vitest";
import {
  buildDisplayMediaRequest,
  captureNativeScreenShare,
  resolveScreenShareBitrate,
  screenShareDegradationPreference,
  describeCaptureSurface,
  planScreenShareAudio,
  isDisplayMediaCancelledError,
  screenShareAudioBarrierConstraints,
  screenShareProfile,
  type ScreenShareSupportedConstraints,
} from "./screenShare";

const chromiumAudioIsolation: ScreenShareSupportedConstraints = {
  restrictOwnAudio: true,
};

describe("screenShareProfile", () => {
  it("maps the four requested quality presets", () => {
    expect(screenShareProfile({ resolution: "720p", fps: 30 })).toMatchObject({
      width: 1280,
      height: 720,
      fps: 30,
    });
    expect(screenShareProfile({ resolution: "720p", fps: 60 })).toMatchObject({
      width: 1280,
      height: 720,
      fps: 60,
    });
    expect(screenShareProfile({ resolution: "1080p", fps: 30 })).toMatchObject({
      width: 1920,
      height: 1080,
      fps: 30,
    });
    expect(screenShareProfile({ resolution: "1080p", fps: 60 })).toMatchObject({
      width: 1920,
      height: 1080,
      fps: 60,
    });
  });
});

describe("screenShareAudioBarrierConstraints", () => {
  it("excludes this app's audio without silencing local playback", () => {
    expect(
      screenShareAudioBarrierConstraints(chromiumAudioIsolation),
    ).toEqual({
      restrictOwnAudio: true,
    });
    expect(
      screenShareAudioBarrierConstraints({
        restrictOwnAudio: true,
        suppressLocalAudioPlayback: true,
      } as ScreenShareSupportedConstraints),
    ).not.toHaveProperty("suppressLocalAudioPlayback");
  });

  it("omits unsupported isolation flags", () => {
    expect(screenShareAudioBarrierConstraints({})).toEqual({});
  });
});

describe("buildDisplayMediaRequest", () => {
  it("combines video quality and audio barrier in one request", () => {
    const request = buildDisplayMediaRequest({
      width: 1920,
      height: 1080,
      fps: 60,
      withAudio: true,
      supportedConstraints: chromiumAudioIsolation,
    });

    expect(request.video).toMatchObject({
      width: { ideal: 1920, max: 1920 },
      frameRate: { ideal: 60, max: 60 },
    });
    expect(request.audio).toEqual({
      restrictOwnAudio: true,
    });
    expect(request.audio).not.toHaveProperty("suppressLocalAudioPlayback");
    expect(request.systemAudio).toBe("exclude");
    expect(request.windowAudio).toBe("window");
  });

  it("requests video-only when audio is disabled", () => {
    expect(buildDisplayMediaRequest({
      width: 1280,
      height: 720,
      fps: 30,
      withAudio: false,
    })).toEqual({
      video: {
        width: { ideal: 1280, max: 1280 },
        height: { ideal: 720, max: 720 },
        frameRate: { ideal: 30, max: 30 },
      },
      audio: false,
    });
  });
});

describe("planScreenShareAudio", () => {
  it.each([
    // [quer áudio, áudio nativo subiu, avisar]
    [true, true, false],
    [true, false, true],
    [false, true, false],
    [false, false, false],
  ])("includeAudio=%s nativeAudioStarted=%s -> warn=%s, never browser audio", (includeAudio, nativeAudioStarted, warn) => {
    expect(planScreenShareAudio({ includeAudio, nativeAudioStarted })).toEqual({ requestBrowserAudio: false, warnNoAudio: warn });
  });
});

describe("captureNativeScreenShare", () => {
  const fakeStream = (surface: string, audioTracks: Array<{ kind: string; stop: () => void }>) => {
    const audio = [...audioTracks];
    return {
      getVideoTracks: () => [{ kind: "video", getSettings: () => ({ displaySurface: surface }) }],
      getAudioTracks: () => audio,
      removeTrack: vi.fn((t: unknown) => audio.splice(audio.indexOf(t as never), 1)),
    };
  };

  it("uses exactly one getDisplayMedia call and never asks the browser for audio", async () => {
    const getDisplayMedia = vi.fn().mockResolvedValue(fakeStream("window", []));
    await captureNativeScreenShare({ width: 1920, height: 1080, fps: 60, getDisplayMedia });

    expect(getDisplayMedia).toHaveBeenCalledTimes(1);
    const request = getDisplayMedia.mock.calls[0]?.[0];
    expect(request.audio).toBe(false);
    expect(request.systemAudio).toBeUndefined();
    expect(request.video).toMatchObject({ width: { ideal: 1920, max: 1920 }, frameRate: { ideal: 60, max: 60 } });
  });

  it("discards an audio track the browser delivers anyway", async () => {
    const stop = vi.fn();
    const stream = fakeStream("monitor", [{ kind: "audio", stop }]);
    const getDisplayMedia = vi.fn().mockResolvedValue(stream);
    const result = await captureNativeScreenShare({ width: 1280, height: 720, fps: 30, getDisplayMedia });

    expect(stop).toHaveBeenCalledTimes(1);
    expect(result.stream.getAudioTracks()).toHaveLength(0);
    expect(result.isMonitorShare).toBe(true);
  });

  it("does not publish when the native picker is cancelled", async () => {
    const getDisplayMedia = vi.fn().mockRejectedValue(Object.assign(new Error("denied"), { name: "NotAllowedError" }));
    await expect(captureNativeScreenShare({ width: 1280, height: 720, fps: 30, getDisplayMedia })).rejects.toMatchObject({
      name: "NotAllowedError",
    });
    expect(getDisplayMedia).toHaveBeenCalledTimes(1);
  });
});

describe("describeCaptureSurface", () => {
  it("reports the surface the browser gave, and flags a missing field", () => {
    expect(describeCaptureSurface({ displaySurface: "window", cursor: "always", width: 1920, height: 1080, frameRate: 60 })).toBe(
      "displaySurface=window cursor=always 1920x1080@60",
    );
    expect(describeCaptureSurface({})).toBe("displaySurface=(ausente) cursor=(ausente) ?x?@?");
  });
});

describe("isDisplayMediaCancelledError", () => {
  it("detects NotAllowedError and AbortError", () => {
    expect(isDisplayMediaCancelledError(Object.assign(new Error("x"), { name: "NotAllowedError" }))).toBe(true);
    expect(isDisplayMediaCancelledError(Object.assign(new Error("x"), { name: "AbortError" }))).toBe(true);
    expect(isDisplayMediaCancelledError(new Error("fail"))).toBe(false);
  });
});

describe("bitrate selection", () => {
  it.each([
    ["720p", 30, undefined, 4_500_000],
    ["720p", 60, "auto", 6_500_000],
    ["1080p", 30, "auto", 8_000_000],
    ["1080p", 60, undefined, 12_000_000],
    ["1080p", 60, 16, 16_000_000],
    ["720p", 30, 6, 6_000_000],
    ["1080p", 60, 1, 2_000_000], // abaixo do mínimo
    ["1080p", 60, 99, 30_000_000], // acima do máximo
    ["1080p", 60, Number.NaN, 12_000_000], // inválido volta à tabela
  ] as const)("%s %sfps choice=%s -> %s bps", (resolution, fps, choice, expected) => {
    expect(resolveScreenShareBitrate(resolution, fps, choice as number | "auto" | undefined)).toBe(expected);
  });

  it("the profile carries the chosen bitrate", () => {
    expect(screenShareProfile({ resolution: "1080p", fps: 60, bitrateMbps: 20 }).bitrate).toBe(20_000_000);
    expect(screenShareProfile({ resolution: "720p", fps: 30 }).bitrate).toBe(4_500_000);
  });

  it("keeps the chosen frame rate for both 30 and 60 (regression: 30 fps used 'balanced')", () => {
    expect(screenShareDegradationPreference()).toBe("maintain-framerate");
  });
});
