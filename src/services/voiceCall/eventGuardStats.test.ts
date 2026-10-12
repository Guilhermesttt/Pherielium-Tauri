import { describe, expect, it } from "vitest";
import {
  emptyStats,
  formatGuardReport,
  loadStats,
  outcomeFor,
  recordOutcome,
  saveStats,
  type StatsStorage,
} from "./eventGuardStats";

const memory = (initial?: string): StatsStorage & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set("pherielium_event_guard_stats_v1", initial);
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
};

describe("outcomeFor", () => {
  it("maps decision and mode to an outcome", () => {
    expect(outcomeFor("log", { accept: true, reason: "ok" })).toBe("accepted");
    expect(outcomeFor("log", { accept: false, reason: "wrong-chat" })).toBe("would-drop");
    expect(outcomeFor("enforce", { accept: false, reason: "wrong-chat" })).toBe("dropped");
  });
});

describe("recordOutcome", () => {
  it("counts per event, outcome and reason and keeps samples only for rejected events", () => {
    let stats = emptyStats(1000);
    stats = recordOutcome(stats, { event: "call:end", mode: "log", decision: { accept: true, reason: "ok" }, sender: "friend-uid", now: 2000 });
    stats = recordOutcome(stats, { event: "call:end", mode: "log", decision: { accept: false, reason: "sender-not-peer" }, sender: "05f2b9c9-cb97", now: 3000 });
    stats = recordOutcome(stats, { event: "call:end", mode: "log", decision: { accept: false, reason: "sender-not-peer" }, sender: "05f2b9c9-cb97", now: 4000 });
    expect(stats.counts["call:end|accepted|ok"]).toBe(1);
    expect(stats.counts["call:end|would-drop|sender-not-peer"]).toBe(2);
    expect(stats.samples).toHaveLength(2);
    expect(stats.samples[0].sender).toBe("05f2");
  });

  it("caps the sample list", () => {
    let stats = emptyStats(0);
    for (let i = 0; i < 100; i += 1) {
      stats = recordOutcome(stats, { event: "call:kick", mode: "log", decision: { accept: false, reason: "wrong-chat" }, sender: "x", now: i });
    }
    expect(stats.samples.length).toBe(40);
    expect(stats.counts["call:kick|would-drop|wrong-chat"]).toBe(100);
  });
});

describe("storage", () => {
  it("round-trips and recovers from corruption", () => {
    const storage = memory();
    const stats = recordOutcome(emptyStats(5), { event: "call:invite", mode: "log", decision: { accept: false, reason: "not-a-friend" }, sender: "abcd1234", now: 6 });
    saveStats(storage, stats);
    expect(loadStats(storage, 99).counts["call:invite|would-drop|not-a-friend"]).toBe(1);
    expect(loadStats(memory("{broken"), 99).since).toBe(99);
    expect(loadStats(null, 7).since).toBe(7);
  });
});

describe("formatGuardReport", () => {
  it("prints a table, reasons and samples without full uids", () => {
    let stats = emptyStats(0);
    stats = recordOutcome(stats, { event: "call:end", mode: "log", decision: { accept: true, reason: "ok" }, sender: "friend", now: 1 });
    stats = recordOutcome(stats, { event: "call:kick", mode: "log", decision: { accept: false, reason: "unknown-host" }, sender: "05f2b9c9-cb97-441a", now: 2 });
    const text = formatGuardReport(stats, { mode: "log", appVersion: "1.0.3-rc.1", now: 10 });
    expect(text).toContain("mode=log");
    expect(text).toContain("call:end");
    expect(text).toContain("1x call:kick unknown-host");
    expect(text).toContain("sender=05f2");
    expect(text).not.toContain("05f2b9c9");
  });

  it("says so when nothing was evaluated", () => {
    expect(formatGuardReport(emptyStats(0), { mode: "log", appVersion: "x", now: 1 })).toContain("nenhum evento avaliado");
  });
});
