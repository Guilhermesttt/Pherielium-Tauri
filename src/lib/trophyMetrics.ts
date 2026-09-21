// src/lib/trophyMetrics.ts
// Phase 5 — Rolling-window performance metrics for trophy operations.
//
// Goals:
//   * Track p50/p95/p99 latency for each named operation in a fixed time
//     window (default 5 minutes, matching the plan).
//   * Be cheap: O(1) record, O(N log N) summary where N <= maxSamples in
//     the window. Pruning happens lazily on each `summary()` call.
//   * Be testable in pure Node: no DOM, no Supabase, no Electron imports.
//   * Emit Prometheus exposition text so an external collector can scrape
//     it (see T5.2 in the plan).
//
// Usage:
//   const metrics = createTrophyMetrics();
//   metrics.measure("trophy.unlock").ok(elapsedMs);
//   metrics.measure("trophy.unlock").fail(err);
//   const text = metrics.prometheus();

export interface RollingPercentilesOptions {
  windowMs: number;
  /** Cap the number of samples retained for memory safety. */
  maxSamples?: number;
  now?: () => number;
}

const DEFAULT_MAX_SAMPLES = 5000;

interface Sample {
  value: number;
  ts: number;
}

export interface PercentileSummary {
  count: number;
  min: number;
  max: number;
  mean: number;
  p50: number;
  p95: number;
  p99: number;
}

const sum = (values: number[]): number => {
  let total = 0;
  for (const v of values) total += v;
  return total;
};

const nearestRank = (sorted: number[], p: number): number => {
  if (sorted.length === 0) return 0;
  // p in (0, 1] (caller clamps). ceil(p * N) yields 1-based rank.
  const rank = Math.max(1, Math.ceil(p * sorted.length));
  return sorted[Math.min(rank, sorted.length) - 1];
};

export class RollingPercentiles {
  private readonly windowMs: number;
  private readonly maxSamples: number;
  private readonly now: () => number;
  private samples: Sample[] = [];

  constructor(options: RollingPercentilesOptions) {
    if (!Number.isFinite(options.windowMs) || options.windowMs <= 0) {
      throw new Error("RollingPercentiles: windowMs must be > 0");
    }
    this.windowMs = options.windowMs;
    this.maxSamples = Math.max(1, options.maxSamples ?? DEFAULT_MAX_SAMPLES);
    this.now = options.now ?? (() => Date.now());
  }

  record(value: number, ts: number = this.now()): void {
    if (!Number.isFinite(value)) return;
    this.samples.push({ value, ts });
    if (this.samples.length > this.maxSamples) {
      this.samples.splice(0, this.samples.length - this.maxSamples);
    }
  }

  private prune(nowMs: number): Sample[] {
    const cutoff = nowMs - this.windowMs;
    // Find the first sample >= cutoff (samples are appended in roughly
    // monotonic time order; binary search is overkill for 5k samples).
    let dropUntil = 0;
    while (dropUntil < this.samples.length && this.samples[dropUntil].ts < cutoff) {
      dropUntil += 1;
    }
    if (dropUntil > 0) this.samples.splice(0, dropUntil);
    return this.samples;
  }

  summary(): PercentileSummary {
    const samples = this.prune(this.now());
    if (samples.length === 0) {
      return { count: 0, min: 0, max: 0, mean: 0, p50: 0, p95: 0, p99: 0 };
    }
    const values = samples.map((s) => s.value);
    values.sort((a, b) => a - b);
    const total = sum(values);
    return {
      count: values.length,
      min: values[0],
      max: values[values.length - 1],
      mean: total / values.length,
      p50: nearestRank(values, 0.5),
      p95: nearestRank(values, 0.95),
      p99: nearestRank(values, 0.99),
    };
  }
}

export interface TrophyMetricsSnapshot extends PercentileSummary {
  failures: number;
}

export interface MeasureHandle {
  ok: (durationMs: number) => void;
  fail: (err?: unknown) => void;
}

export interface TrophyMetrics {
  /**
   * Manual timing: returns a handle the caller can use to record the
   * outcome of an operation that does not fit the function-wrapper API.
   */
  start(name: string): MeasureHandle;
  /** Time a synchronous function. Throws after recording a failure. */
  measureSync<T>(name: string, fn: () => T): T;
  /** Time a (possibly async) function. Throws after recording a failure. */
  measure<T>(name: string, fn: () => Promise<T> | T): Promise<T>;
  snapshot(name: string): TrophyMetricsSnapshot;
  listOperations(): string[];
  /** Render the current state in Prometheus text exposition format. */
  prometheus(): string;
  /** Reset all state. */
  reset(): void;
}

export function createTrophyMetrics(options?: {
  windowMs?: number;
  now?: () => number;
}): TrophyMetrics {
  const windowMs = options?.windowMs ?? 5 * 60_000;
  const now = options?.now ?? (() => Date.now());
  const series = new Map<string, RollingPercentiles>();
  const failures = new Map<string, number>();

  const ensure = (name: string): RollingPercentiles => {
    let s = series.get(name);
    if (!s) {
      s = new RollingPercentiles({ windowMs, now });
      series.set(name, s);
    }
    return s;
  };

  const recordOk = (name: string, durationMs: number): void => {
    const s = ensure(name);
    s.record(Math.max(0, durationMs), now());
  };

  const recordFail = (name: string, _err: unknown): void => {
    // Failures do NOT contribute to latency percentiles — a thrown error
    // does not have a meaningful latency. They only bump the failure
    // counter so the percentile stays representative of successful work.
    failures.set(name, (failures.get(name) ?? 0) + 1);
  };

  const manualHandle = (name: string): MeasureHandle => ({
    ok: (durationMs) => recordOk(name, durationMs),
    fail: (err) => recordFail(name, err),
  });

  return {
    start(name) {
      return manualHandle(name);
    },
    measureSync(name, fn) {
      const start = now();
      try {
        const out = fn();
        recordOk(name, now() - start);
        return out;
      } catch (err) {
        recordFail(name, err);
        throw err;
      }
    },
    async measure(name, fn) {
      const start = now();
      try {
        const out = await fn();
        recordOk(name, now() - start);
        return out;
      } catch (err) {
        recordFail(name, err);
        throw err;
      }
    },
    snapshot(name) {
      const s = ensure(name);
      return { failures: failures.get(name) ?? 0, ...s.summary() };
    },
    listOperations() {
      return Array.from(series.keys());
    },
    prometheus() {
      const lines: string[] = [];
      for (const name of series.keys()) {
        const safeName = name.replace(/[^a-zA-Z0-9_:]/g, "_");
        const snap = this.snapshot(name);
        lines.push(`# HELP ${safeName}_ms Latency of ${name} in milliseconds.`);
        lines.push(`# TYPE ${safeName}_ms summary`);
        if (snap.count === 0) continue;
        lines.push(`${safeName}_ms{quantile="0.5"} ${snap.p50}`);
        lines.push(`${safeName}_ms{quantile="0.95"} ${snap.p95}`);
        lines.push(`${safeName}_ms{quantile="0.99"} ${snap.p99}`);
        lines.push(`${safeName}_ms_count ${snap.count}`);
        lines.push(`${safeName}_ms_sum ${Math.round(snap.mean * snap.count)}`);
        const f = failures.get(name) ?? 0;
        if (f > 0) {
          lines.push(`# HELP ${safeName}_failures_total Failure counter for ${name}.`);
          lines.push(`# TYPE ${safeName}_failures_total counter`);
          lines.push(`${safeName}_failures_total ${f}`);
        }
      }
      return lines.length === 0 ? "" : lines.join("\n") + "\n";
    },
    reset() {
      series.clear();
      failures.clear();
    },
  };
}

let defaultInstance: TrophyMetrics | null = null;

/**
 * Lazily-constructed singleton for renderer-side use. Tests and
 * alternative contexts (e.g. main process) can pass their own
 * `createTrophyMetrics()` instance.
 */
export function getDefaultTrophyMetrics(): TrophyMetrics {
  if (!defaultInstance) {
    defaultInstance = createTrophyMetrics();
  }
  return defaultInstance;
}

/** Reset the default singleton — only meant for tests. */
export function __resetDefaultTrophyMetrics(): void {
  defaultInstance = null;
}


