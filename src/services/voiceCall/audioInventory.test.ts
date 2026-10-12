import { describe, expect, it } from "vitest";
import { describeElement, findDoublePlayback, formatInventory, type ElementInfo } from "./audioInventory";

const el = (over: Partial<ElementInfo>): ElementInfo => ({
  tag: "audio",
  origin: "livekit",
  label: "x",
  volume: 1,
  muted: false,
  paused: false,
  audioTrackIds: ["t1"],
  videoTrackCount: 0,
  ...over,
});

describe("findDoublePlayback", () => {
  it("flags a track audible in two elements (the stage <video> plus the LiveKit <audio>)", () => {
    const doubles = findDoublePlayback([
      el({ origin: "livekit", tag: "audio", label: "screen abcd", volume: 0.2, audioTrackIds: ["screen-audio"] }),
      el({ origin: "dom", tag: "video", label: "stage", volume: 1, muted: false, audioTrackIds: ["screen-audio"], videoTrackCount: 1 }),
    ]);
    expect(doubles).toHaveLength(1);
    expect(doubles[0].trackId).toBe("screen-audio");
    expect(doubles[0].elements).toHaveLength(2);
  });

  it("ignores muted, paused and zero-volume elements", () => {
    expect(
      findDoublePlayback([
        el({ audioTrackIds: ["a"] }),
        el({ origin: "dom", tag: "video", muted: true, audioTrackIds: ["a"] }),
        el({ origin: "dom", tag: "video", paused: true, audioTrackIds: ["a"] }),
        el({ origin: "dom", tag: "video", volume: 0, audioTrackIds: ["a"] }),
      ]),
    ).toEqual([]);
  });

  it("does not flag different tracks", () => {
    expect(findDoublePlayback([el({ audioTrackIds: ["a"] }), el({ audioTrackIds: ["b"] })])).toEqual([]);
  });
});

describe("describeElement", () => {
  it("reads tracks from srcObject and rounds the volume", () => {
    const info = describeElement(
      {
        tagName: "VIDEO",
        volume: 0.33333,
        muted: false,
        paused: false,
        srcObject: { getAudioTracks: () => [{ id: "t9" }], getVideoTracks: () => [{}] },
      },
      "dom",
      "stage",
    );
    expect(info).toMatchObject({ tag: "video", volume: 0.333, audioTrackIds: ["t9"], videoTrackCount: 1 });
  });

  it("tolerates elements without a stream", () => {
    expect(describeElement({ tagName: "AUDIO", volume: 1, muted: true, paused: true }, "livekit", "x").audioTrackIds).toEqual([]);
  });
});

describe("formatInventory", () => {
  it("prints counts, the double playback warning and short ids", () => {
    const text = formatInventory(
      {
        elements: [
          el({ label: "screen abcd", volume: 0.2, audioTrackIds: ["screen-audio-123456"] }),
          el({ origin: "dom", tag: "video", label: "stage", audioTrackIds: ["screen-audio-123456"], videoTrackCount: 1 }),
        ],
        publications: [
          { scope: "remote", identity: "abcd", source: "microphone", kind: "audio", trackSid: "TR_aaaaaaaaaaaa", subscribed: true, muted: false },
          { scope: "remote", identity: "abcd", source: "screen_share_audio", kind: "audio", trackSid: "TR_bbbbbbbbbbbb", subscribed: true, muted: false },
          { scope: "local", identity: "me00", source: "microphone", kind: "audio", trackSid: "TR_cccccccccccc", subscribed: true, muted: false },
        ],
        roomOptions: { webAudioMix: "unset", adaptiveStream: "true" },
        storedVolumes: { "screen:abcdef123": 20 },
      },
      "1.0.3-rc.1",
    );
    expect(text).toContain("publicações de áudio recebidas: 2");
    expect(text).toContain("source=screen_share_audio");
    expect(text).toContain("ATENÇÃO trilha screen-a em 2 elementos");
    expect(text).toContain("screen:abcd=20");
    expect(text).not.toContain("abcdef123");
  });

  it("says when nothing plays twice", () => {
    const text = formatInventory(
      { elements: [], publications: [], roomOptions: { webAudioMix: "unset", adaptiveStream: "true" }, storedVolumes: {} },
      "x",
    );
    expect(text).toContain("(nenhuma)");
  });
});
