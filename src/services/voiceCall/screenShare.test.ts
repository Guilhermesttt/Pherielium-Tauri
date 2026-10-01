import { describe, expect, it, vi } from "vitest";
import {
  buildDisplayMediaRequest,
  captureNativeScreenShare,
  isDisplayMediaCancelledError,
  screenShareAudioBarrierConstraints,
  screenShareProfile,
} from "./screenShare";

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
  it("enables DSP and isolation flags when supported", () => {
    expect(
      screenShareAudioBarrierConstraints({
        restrictOwnAudio: true,
        suppressLocalAudioPlayback: true,
      }),
    ).toEqual({
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      restrictOwnAudio: true,
      suppressLocalAudioPlayback: true,
    });
  });

  it("omits unsupported isolation flags", () => {
    expect(screenShareAudioBarrierConstraints({})).toEqual({
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    });
  });
});

describe("buildDisplayMediaRequest", () => {
  it("combines video quality and audio barrier in one request", () => {
    const request = buildDisplayMediaRequest({
      width: 1920,
      height: 1080,
      fps: 60,
      withAudio: true,
      supportedConstraints: {
        restrictOwnAudio: true,
        suppressLocalAudioPlayback: true,
      },
    });

    expect(request.video).toMatchObject({
      width: { ideal: 1920, max: 1920 },
      frameRate: { ideal: 60, max: 60 },
    });
    expect(request.audio).toMatchObject({
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      restrictOwnAudio: true,
      suppressLocalAudioPlayback: true,
    });
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

describe("captureNativeScreenShare", () => {
  it("uses exactly one getDisplayMedia call for 1080p60 with audio", async () => {
    const getDisplayMedia = vi.fn().mockResolvedValue({
      getVideoTracks: () => [{ kind: "video", getSettings: () => ({ displaySurface: "window" }) }],
      getAudioTracks: () => [{ kind: "audio" }],
      removeTrack: vi.fn(),
    });

    const result = await captureNativeScreenShare({
      width: 1920,
      height: 1080,
      fps: 60,
      withAudio: true,
      getDisplayMedia,
      supportedConstraints: {
        restrictOwnAudio: true,
        suppressLocalAudioPlayback: true,
      },
    });

    expect(getDisplayMedia).toHaveBeenCalledTimes(1);
    expect(result.hasSystemAudio).toBe(true);
    expect(getDisplayMedia.mock.calls[0]?.[0]?.video).toMatchObject({
      width: { ideal: 1920, max: 1920 },
      frameRate: { ideal: 60, max: 60 },
    });
    expect(getDisplayMedia.mock.calls[0]?.[0]?.audio).toMatchObject({
      echoCancellation: true,
      restrictOwnAudio: true,
      suppressLocalAudioPlayback: true,
    });
    expect(getDisplayMedia.mock.calls[0]?.[0]?.systemAudio).toBe("exclude");
    expect(getDisplayMedia.mock.calls[0]?.[0]?.windowAudio).toBe("window");
  });

  it("does not publish when the native picker is cancelled", async () => {
    const getDisplayMedia = vi.fn().mockRejectedValue(Object.assign(new Error("denied"), { name: "NotAllowedError" }));

    await expect(captureNativeScreenShare({
      width: 1280,
      height: 720,
      fps: 30,
      withAudio: true,
      getDisplayMedia,
    })).rejects.toMatchObject({ name: "NotAllowedError" });

    expect(getDisplayMedia).toHaveBeenCalledTimes(1);
  });

  it("returns video-only when the user shares screen without audio", async () => {
    const getDisplayMedia = vi.fn().mockResolvedValue({
      getVideoTracks: () => [{ kind: "video", getSettings: () => ({ displaySurface: "window" }) }],
      getAudioTracks: () => [],
      removeTrack: vi.fn(),
    });

    const result = await captureNativeScreenShare({
      width: 1280,
      height: 720,
      fps: 30,
      withAudio: true,
      getDisplayMedia,
    });

    expect(getDisplayMedia).toHaveBeenCalledTimes(1);
    expect(result.hasSystemAudio).toBe(false);
  });

  it("flags monitor capture for launcher audio isolation", async () => {
    const getDisplayMedia = vi.fn().mockResolvedValue({
      getVideoTracks: () => [{ kind: "video", getSettings: () => ({ displaySurface: "monitor" }) }],
      getAudioTracks: () => [{ kind: "audio" }],
    });

    const result = await captureNativeScreenShare({
      width: 1280,
      height: 720,
      fps: 30,
      withAudio: true,
      getDisplayMedia,
    });

    expect(result.hasSystemAudio).toBe(true);
    expect(result.isMonitorShare).toBe(true);
  });
});

describe("isDisplayMediaCancelledError", () => {
  it("detects NotAllowedError and AbortError", () => {
    expect(isDisplayMediaCancelledError(Object.assign(new Error("x"), { name: "NotAllowedError" }))).toBe(true);
    expect(isDisplayMediaCancelledError(Object.assign(new Error("x"), { name: "AbortError" }))).toBe(true);
    expect(isDisplayMediaCancelledError(new Error("fail"))).toBe(false);
  });
});
