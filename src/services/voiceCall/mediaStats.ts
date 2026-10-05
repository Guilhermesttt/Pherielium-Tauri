export type CallMediaStats = {
  rttMs: number | null;
  packetLoss: number | null;
  bitrate: number | null;
  videoFps: number | null;
};

export type RtcStatSample = {
  type?: string;
  kind?: string;
  state?: string;
  nominated?: boolean;
  currentRoundTripTime?: number;
  packetsLost?: number;
  packetsReceived?: number;
  bytesSent?: number;
  framesPerSecond?: number;
};

export type ByteSample = { bytesSent: number; at: number };

export const emptyCallMediaStats = (): CallMediaStats => ({
  rttMs: null,
  packetLoss: null,
  bitrate: null,
  videoFps: null,
});

export function summarizeRtcStats(
  report: Iterable<[string, RtcStatSample]>,
  previous: ByteSample | null,
  now = Date.now(),
): { stats: CallMediaStats; sample: ByteSample } {
  let rttMs: number | null = null;
  let lost = 0;
  let received = 0;
  let bytesSent = 0;
  let videoFps: number | null = null;

  for (const [, stat] of report) {
    if (stat.type === "candidate-pair" && (stat.nominated || stat.state === "succeeded") && typeof stat.currentRoundTripTime === "number") {
      rttMs = Math.round(stat.currentRoundTripTime * 1000);
    }
    if (stat.type === "inbound-rtp") {
      lost += stat.packetsLost || 0;
      received += stat.packetsReceived || 0;
    }
    if (stat.type === "outbound-rtp") {
      bytesSent += stat.bytesSent || 0;
      if (stat.kind === "video" && typeof stat.framesPerSecond === "number") {
        videoFps = Math.round(stat.framesPerSecond);
      }
    }
  }

  const total = lost + received;
  const packetLoss = total > 0 ? Math.round((lost / total) * 1000) / 10 : null;
  let bitrate: number | null = null;
  if (previous && now > previous.at && bytesSent >= previous.bytesSent) {
    bitrate = Math.round(((bytesSent - previous.bytesSent) * 8) / (now - previous.at));
  }

  return {
    stats: { rttMs, packetLoss, bitrate, videoFps },
    sample: { bytesSent, at: now },
  };
}
