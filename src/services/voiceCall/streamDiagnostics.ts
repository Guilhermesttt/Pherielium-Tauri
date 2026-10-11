/**
 * Read-only WebRTC diagnostics for screen-share quality (fps, drops, encoder, limits).
 *
 * Opt-in via `localStorage.pherielium_stream_debug = "1"` (see streamDebug.ts). It only
 * calls getStats() once per second and logs to the console; it never changes tracks,
 * encoder parameters or UI. When the flag is off, `startStreamDiagnostics` is a no-op.
 *
 * Sender side reads `outbound-rtp` + `media-source`; receiver side reads `inbound-rtp`.
 * The parsing/summary functions are pure so they can be unit-tested without WebRTC.
 */
import { isStreamDebugEnabled, streamDebugLog } from "./streamDebug";

type StatsRecord = Record<string, unknown>;
type StatsReportLike = { forEach(cb: (value: StatsRecord) => void): void };

const num = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;
const str = (value: unknown): string | null => (typeof value === "string" ? value : null);

export interface SenderSample {
  /** Frame rate reported by the encoder for the outgoing stream. */
  fps: number | null;
  /** Frame rate the capture source delivers (media-source). */
  sourceFps: number | null;
  /** track.getSettings().frameRate: what the capture was asked/granted. */
  trackFps: number | null;
  /** Frames the source produced this interval. */
  sourceFramesDelta: number;
  /** Source frames that never reached the encoder (source - encoded, >= 0). */
  droppedFramesDelta: number;
  limitationReason: string;
  encoder: string | null;
  powerEfficientEncoder: boolean | null;
  bitrateKbps: number | null;
  width: number | null;
  height: number | null;
  encodeMsPerFrame: number | null;
  /** document.visibilityState: separates hub-in-foreground vs background runs. */
  visible: boolean;
}

export interface SenderCounters {
  at: number;
  bytesSent: number;
  framesEncoded: number;
  totalEncodeTime: number;
  sourceFrames: number | null;
}

/** Picks the largest outgoing video stream (simulcast sends several). */
function findSenderRecords(report: StatsReportLike): { outbound: StatsRecord | null; source: StatsRecord | null } {
  const outbounds: StatsRecord[] = [];
  const sources = new Map<string, StatsRecord>();
  report.forEach((record) => {
    if (record.type === "outbound-rtp" && record.kind === "video") outbounds.push(record);
    if (record.type === "media-source" && record.kind === "video") {
      const id = str(record.id);
      if (id) sources.set(id, record);
    }
  });
  outbounds.sort((a, b) => (num(b.frameWidth) ?? 0) - (num(a.frameWidth) ?? 0));
  const outbound = outbounds[0] ?? null;
  const sourceId = outbound ? str(outbound.mediaSourceId) : null;
  const source = (sourceId && sources.get(sourceId)) || sources.values().next().value || null;
  return { outbound, source };
}

export function readSenderSample(
  report: StatsReportLike,
  prev: SenderCounters | null,
  trackFps: number | null,
  nowMs: number,
  visible: boolean,
): { sample: SenderSample; next: SenderCounters } | null {
  const { outbound, source } = findSenderRecords(report);
  if (!outbound) return null;

  const bytesSent = num(outbound.bytesSent) ?? 0;
  const framesEncoded = num(outbound.framesEncoded) ?? 0;
  const totalEncodeTime = num(outbound.totalEncodeTime) ?? 0;
  const sourceFrames = source ? num(source.frames) : null;
  const next: SenderCounters = { at: nowMs, bytesSent, framesEncoded, totalEncodeTime, sourceFrames };

  const seconds = prev ? (nowMs - prev.at) / 1000 : 0;
  const encodedDelta = prev ? Math.max(0, framesEncoded - prev.framesEncoded) : 0;
  const sourceDelta =
    prev && sourceFrames !== null && prev.sourceFrames !== null ? Math.max(0, sourceFrames - prev.sourceFrames) : 0;

  return {
    next,
    sample: {
      fps: num(outbound.framesPerSecond),
      sourceFps: source ? num(source.framesPerSecond) : null,
      trackFps,
      sourceFramesDelta: sourceDelta,
      droppedFramesDelta: Math.max(0, sourceDelta - encodedDelta),
      limitationReason: str(outbound.qualityLimitationReason) ?? "unknown",
      encoder: str(outbound.encoderImplementation),
      powerEfficientEncoder: typeof outbound.powerEfficientEncoder === "boolean" ? outbound.powerEfficientEncoder : null,
      bitrateKbps: prev && seconds > 0 ? ((bytesSent - prev.bytesSent) * 8) / 1000 / seconds : null,
      width: num(outbound.frameWidth),
      height: num(outbound.frameHeight),
      encodeMsPerFrame:
        prev && encodedDelta > 0 ? ((totalEncodeTime - prev.totalEncodeTime) / encodedDelta) * 1000 : null,
      visible,
    },
  };
}

export interface ReceiverSample {
  fps: number | null;
  jitterMs: number | null;
  framesDecodedDelta: number;
  framesDroppedDelta: number;
  decodeMsPerFrame: number | null;
  freezeCount: number | null;
  totalFreezesDurationSec: number | null;
}

export interface ReceiverCounters {
  framesDecoded: number;
  framesDropped: number;
  totalDecodeTime: number;
}

export function readReceiverSample(
  report: StatsReportLike,
  prev: ReceiverCounters | null,
): { sample: ReceiverSample; next: ReceiverCounters } | null {
  let inbound: StatsRecord | null = null;
  report.forEach((record) => {
    if (record.type === "inbound-rtp" && record.kind === "video") inbound = record;
  });
  const record = inbound as StatsRecord | null;
  if (!record) return null;

  const framesDecoded = num(record.framesDecoded) ?? 0;
  const framesDropped = num(record.framesDropped) ?? 0;
  const totalDecodeTime = num(record.totalDecodeTime) ?? 0;
  const decodedDelta = prev ? Math.max(0, framesDecoded - prev.framesDecoded) : 0;
  const jitter = num(record.jitter);

  return {
    next: { framesDecoded, framesDropped, totalDecodeTime },
    sample: {
      fps: num(record.framesPerSecond),
      jitterMs: jitter === null ? null : jitter * 1000,
      framesDecodedDelta: decodedDelta,
      framesDroppedDelta: prev ? Math.max(0, framesDropped - prev.framesDropped) : 0,
      decodeMsPerFrame:
        prev && decodedDelta > 0 ? ((totalDecodeTime - prev.totalDecodeTime) / decodedDelta) * 1000 : null,
      freezeCount: num(record.freezeCount),
      totalFreezesDurationSec: num(record.totalFreezesDuration),
    },
  };
}

// ---- summaries ---------------------------------------------------------------------

const present = (values: Array<number | null>): number[] =>
  values.filter((value): value is number => value !== null);

const mean = (values: number[]): number | null =>
  values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;

/** Nearest-rank percentile; `p` in [0, 100]. */
export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.max(1, Math.ceil((p / 100) * sorted.length));
  return sorted[rank - 1];
}

function mostFrequent<T extends string>(values: Array<T | null>): T | null {
  const counts = new Map<T, number>();
  for (const value of values) if (value !== null) counts.set(value, (counts.get(value) ?? 0) + 1);
  let best: T | null = null;
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

export interface SenderSummary {
  seconds: number;
  fpsAvg: number | null;
  fpsFloorP5: number | null;
  sourceFpsAvg: number | null;
  droppedPercent: number | null;
  limitationMostFrequent: string | null;
  /** Share of samples where the limitation reason was "cpu". */
  cpuLimitedPercent: number;
  encoder: string | null;
  powerEfficientEncoder: boolean | null;
  resolution: string | null;
  bitrateKbpsAvg: number | null;
  encodeMsPerFrameAvg: number | null;
  /** Share of samples taken while the window was hidden/backgrounded. */
  backgroundPercent: number;
}

export function summarizeSender(samples: SenderSample[]): SenderSummary {
  const sourceTotal = samples.reduce((sum, s) => sum + s.sourceFramesDelta, 0);
  const droppedTotal = samples.reduce((sum, s) => sum + s.droppedFramesDelta, 0);
  const widths = present(samples.map((s) => s.width));
  const heights = present(samples.map((s) => s.height));
  const fps = present(samples.map((s) => s.fps));
  const efficient = samples.map((s) => s.powerEfficientEncoder).filter((v): v is boolean => v !== null);
  const round = (value: number | null, digits = 1): number | null =>
    value === null ? null : Number(value.toFixed(digits));

  return {
    seconds: samples.length,
    fpsAvg: round(mean(fps)),
    fpsFloorP5: round(percentile(fps, 5)),
    sourceFpsAvg: round(mean(present(samples.map((s) => s.sourceFps)))),
    droppedPercent: sourceTotal > 0 ? round((droppedTotal / sourceTotal) * 100) : null,
    limitationMostFrequent: mostFrequent(samples.map((s) => s.limitationReason)),
    cpuLimitedPercent:
      samples.length === 0 ? 0 : round((samples.filter((s) => s.limitationReason === "cpu").length / samples.length) * 100, 0) ?? 0,
    encoder: mostFrequent(samples.map((s) => s.encoder)),
    powerEfficientEncoder: efficient.length === 0 ? null : efficient.every(Boolean),
    resolution:
      widths.length && heights.length ? `${Math.round(mean(widths) ?? 0)}x${Math.round(mean(heights) ?? 0)}` : null,
    bitrateKbpsAvg: round(mean(present(samples.map((s) => s.bitrateKbps))), 0),
    encodeMsPerFrameAvg: round(mean(present(samples.map((s) => s.encodeMsPerFrame))), 2),
    backgroundPercent:
      samples.length === 0 ? 0 : round((samples.filter((s) => !s.visible).length / samples.length) * 100, 0) ?? 0,
  };
}

export interface ReceiverSummary {
  seconds: number;
  fpsAvg: number | null;
  fpsFloorP5: number | null;
  jitterMsAvg: number | null;
  droppedPercent: number | null;
  decodeMsPerFrameAvg: number | null;
  freezeCount: number | null;
  totalFreezesDurationSec: number | null;
}

export function summarizeReceiver(samples: ReceiverSample[]): ReceiverSummary {
  const decoded = samples.reduce((sum, s) => sum + s.framesDecodedDelta, 0);
  const dropped = samples.reduce((sum, s) => sum + s.framesDroppedDelta, 0);
  const fps = present(samples.map((s) => s.fps));
  const last = samples[samples.length - 1];
  const round = (value: number | null, digits = 1): number | null =>
    value === null ? null : Number(value.toFixed(digits));
  return {
    seconds: samples.length,
    fpsAvg: round(mean(fps)),
    fpsFloorP5: round(percentile(fps, 5)),
    jitterMsAvg: round(mean(present(samples.map((s) => s.jitterMs))), 2),
    droppedPercent: decoded + dropped > 0 ? round((dropped / (decoded + dropped)) * 100) : null,
    decodeMsPerFrameAvg: round(mean(present(samples.map((s) => s.decodeMsPerFrame))), 2),
    freezeCount: last?.freezeCount ?? null,
    totalFreezesDurationSec: round(last?.totalFreezesDurationSec ?? null, 2),
  };
}

// ---- runtime -----------------------------------------------------------------------

export interface DiagnosticsOptions {
  role: "sender" | "receiver";
  /** Free-text scenario tag copied into the summary (e.g. "screen audio=on 1080p60"). */
  label: string;
  readReport: () => Promise<StatsReportLike | undefined>;
  /** Sender only: capture frame rate granted by getSettings(). */
  readTrackFrameRate?: () => number | null;
  intervalMs?: number;
}

const NOOP = (): void => undefined;

/**
 * Starts sampling. Returns a stop function that prints a copy-friendly summary.
 * Returns a no-op when the debug flag is off.
 */
export function startStreamDiagnostics(options: DiagnosticsOptions): () => void {
  if (!isStreamDebugEnabled()) return NOOP;

  const senderSamples: SenderSample[] = [];
  const receiverSamples: ReceiverSample[] = [];
  let senderPrev: SenderCounters | null = null;
  let receiverPrev: ReceiverCounters | null = null;
  let reading = false;

  const tick = async (): Promise<void> => {
    if (reading) return; // never stack reads if getStats is slow
    reading = true;
    try {
      const report = await options.readReport();
      if (!report) return;
      if (options.role === "sender") {
        const visible = typeof document === "undefined" || document.visibilityState === "visible";
        const read = readSenderSample(report, senderPrev, options.readTrackFrameRate?.() ?? null, Date.now(), visible);
        if (!read) return;
        const hadBaseline = senderPrev !== null;
        senderPrev = read.next;
        // The first read only seeds the counters; its deltas are meaningless.
        if (!hadBaseline) return;
        senderSamples.push(read.sample);
        streamDebugLog("stream-sender", read.sample);
      } else {
        const read = readReceiverSample(report, receiverPrev);
        if (!read) return;
        const hadBaseline = receiverPrev !== null;
        receiverPrev = read.next;
        if (!hadBaseline) return;
        receiverSamples.push(read.sample);
        streamDebugLog("stream-receiver", read.sample);
      }
    } catch (error) {
      console.warn("[streamDiagnostics] getStats failed:", error);
    } finally {
      reading = false;
    }
  };

  const timer = window.setInterval(() => void tick(), options.intervalMs ?? 1000);

  return () => {
    window.clearInterval(timer);
    const summary =
      options.role === "sender" ? summarizeSender(senderSamples) : summarizeReceiver(receiverSamples);
    console.info(
      `[stream-debug:summary] ${options.role} ${options.label}\n${JSON.stringify(summary, null, 2)}`,
    );
  };
}
