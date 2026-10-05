import { describe, expect, it } from "vitest";
import { summarizeRtcStats } from "./mediaStats";

describe("summarizeRtcStats", () => {
  it("reads rtt, loss, bitrate and fps from a stats report", () => {
    const report = new Map<string, object>([
      ["pair", { type: "candidate-pair", nominated: true, currentRoundTripTime: 0.042 }],
      ["in", { type: "inbound-rtp", packetsLost: 2, packetsReceived: 98 }],
      ["out", { type: "outbound-rtp", kind: "video", bytesSent: 125_000, framesPerSecond: 59.4 }],
    ]);
    const { stats } = summarizeRtcStats(report as never, { bytesSent: 100_000, at: 0 }, 1000);
    expect(stats.rttMs).toBe(42);
    expect(stats.packetLoss).toBe(2);
    expect(stats.bitrate).toBe(200);
    expect(stats.videoFps).toBe(59);
  });
});
