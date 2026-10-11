import { describe, expect, it } from "vitest";
import {
  percentile,
  readReceiverSample,
  readSenderSample,
  summarizeReceiver,
  summarizeSender,
  type SenderSample,
} from "./streamDiagnostics";

type Rec = Record<string, unknown>;
const report = (records: Rec[]) => ({ forEach: (cb: (r: Rec) => void) => records.forEach(cb) });

const outbound = (over: Rec = {}): Rec => ({
  id: "out1",
  type: "outbound-rtp",
  kind: "video",
  mediaSourceId: "src1",
  bytesSent: 0,
  framesEncoded: 0,
  totalEncodeTime: 0,
  framesPerSecond: 60,
  frameWidth: 1920,
  frameHeight: 1080,
  qualityLimitationReason: "none",
  encoderImplementation: "OpenH264",
  ...over,
});
const source = (over: Rec = {}): Rec => ({ id: "src1", type: "media-source", kind: "video", frames: 0, framesPerSecond: 60, ...over });

describe("readSenderSample", () => {
  it("returns null without an outbound video stream", () => {
    expect(readSenderSample(report([]), null, null, 0, true)).toBeNull();
  });

  it("computes bitrate, encode time and dropped source frames from deltas", () => {
    const first = readSenderSample(report([outbound(), source()]), null, 60, 0, true);
    expect(first).not.toBeNull();
    const second = readSenderSample(
      report([
        outbound({ bytesSent: 250_000, framesEncoded: 50, totalEncodeTime: 0.5 }),
        source({ frames: 60 }),
      ]),
      first!.next,
      60,
      1000,
      true,
    );
    expect(second!.sample.bitrateKbps).toBeCloseTo(2000);
    expect(second!.sample.encodeMsPerFrame).toBeCloseTo(10);
    expect(second!.sample.sourceFramesDelta).toBe(60);
    expect(second!.sample.droppedFramesDelta).toBe(10);
  });

  it("picks the largest stream when simulcast layers exist", () => {
    const read = readSenderSample(
      report([outbound({ id: "low", frameWidth: 640 }), outbound({ id: "high", frameWidth: 1920, frameHeight: 1080 }), source()]),
      null,
      null,
      0,
      true,
    );
    expect(read!.sample.width).toBe(1920);
  });
});

describe("summarizeSender", () => {
  const sample = (over: Partial<SenderSample>): SenderSample => ({
    fps: 60,
    sourceFps: 60,
    trackFps: 60,
    sourceFramesDelta: 60,
    droppedFramesDelta: 0,
    limitationReason: "none",
    encoder: "OpenH264",
    powerEfficientEncoder: false,
    bitrateKbps: 6000,
    width: 1920,
    height: 1080,
    encodeMsPerFrame: 5,
    visible: true,
    ...over,
  });

  it("reports average, p5 floor, drop %, dominant limitation and cpu share", () => {
    const samples = [
      ...Array.from({ length: 18 }, () => sample({})),
      sample({ fps: 20, droppedFramesDelta: 30, limitationReason: "cpu" }),
      sample({ fps: 30, droppedFramesDelta: 30, limitationReason: "cpu" }),
    ];
    const summary = summarizeSender(samples);
    expect(summary.fpsFloorP5).toBe(20);
    expect(summary.fpsAvg).toBe(56.5);
    expect(summary.droppedPercent).toBe(5);
    expect(summary.limitationMostFrequent).toBe("none");
    expect(summary.cpuLimitedPercent).toBe(10);
    expect(summary.resolution).toBe("1920x1080");
    expect(summary.encoder).toBe("OpenH264");
  });

  it("tracks background share and tolerates empty input", () => {
    expect(summarizeSender([sample({ visible: false }), sample({})]).backgroundPercent).toBe(50);
    expect(summarizeSender([]).fpsAvg).toBeNull();
  });
});

describe("receiver", () => {
  const inbound = (over: Rec = {}): Rec => ({
    type: "inbound-rtp",
    kind: "video",
    framesDecoded: 0,
    framesDropped: 0,
    totalDecodeTime: 0,
    framesPerSecond: 30,
    jitter: 0.004,
    freezeCount: 0,
    totalFreezesDuration: 0,
    ...over,
  });

  it("derives deltas and summarizes", () => {
    const a = readReceiverSample(report([inbound()]), null)!;
    const b = readReceiverSample(
      report([inbound({ framesDecoded: 55, framesDropped: 5, totalDecodeTime: 0.11, freezeCount: 1, totalFreezesDuration: 0.4 })]),
      a.next,
    )!;
    expect(b.sample.decodeMsPerFrame).toBeCloseTo(2);
    expect(b.sample.jitterMs).toBeCloseTo(4);
    const summary = summarizeReceiver([b.sample]);
    expect(summary.droppedPercent).toBeCloseTo(8.3, 1);
    expect(summary.freezeCount).toBe(1);
  });
});

describe("percentile", () => {
  it("uses nearest rank", () => {
    expect(percentile([10, 20, 30, 40, 50], 5)).toBe(10);
    expect(percentile([], 5)).toBeNull();
  });
});
