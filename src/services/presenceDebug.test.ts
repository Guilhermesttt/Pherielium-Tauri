import { describe, expect, it } from "vitest";
import {
  formatPresenceReport,
  shortUid,
  summarizeGaps,
  type PresenceDebugEvent,
} from "./presenceDebug";

describe("summarizeGaps", () => {
  it("returns nulls with fewer than two timestamps", () => {
    expect(summarizeGaps([]).count).toBe(0);
    expect(summarizeGaps([1000])).toEqual({ count: 0, minMs: null, medianMs: null, maxMs: null, slowCount: 0 });
  });

  it("computes min, median, max and counts slow gaps", () => {
    const stats = summarizeGaps([0, 25_000, 50_000, 125_000]);
    expect(stats.count).toBe(3);
    expect(stats.minMs).toBe(25_000);
    expect(stats.medianMs).toBe(25_000);
    expect(stats.maxMs).toBe(75_000);
    expect(stats.slowCount).toBe(1);
  });

  it("does not depend on input order", () => {
    expect(summarizeGaps([50_000, 0, 25_000]).maxMs).toBe(25_000);
  });
});

describe("shortUid", () => {
  it("truncates to four characters and tolerates garbage", () => {
    expect(shortUid("05f2b9c9-cb97-441a-9ad2-1cb77039b131")).toBe("05f2");
    expect(shortUid(undefined)).toBe("?");
    expect(shortUid("")).toBe("?");
  });
});

describe("formatPresenceReport", () => {
  const ev = (t: number, kind: PresenceDebugEvent["kind"], data: Record<string, unknown> = {}): PresenceDebugEvent => ({
    t,
    kind,
    data: { instance: "aaaa1111", visible: "visible", ...data },
  });

  it("summarizes heartbeats, flags duplicate instances and lists the offline triggers", () => {
    const list = [
      ev(0, "heartbeat_sent"),
      ev(25_000, "heartbeat_sent"),
      ev(25_100, "heartbeat_ack", { ok: true, ms: 100 }),
      ev(90_000, "heartbeat_sent", { visible: "hidden" }),
      ev(90_500, "heartbeat_ack", { ok: false, error: "timeout" }),
      ev(91_000, "offline_trigger", { origin: "pagehide" }),
      { t: 92_000, kind: "presence_leave_raw", data: { instance: "bbbb2222", key: "05f2", leftCount: 1 } } as PresenceDebugEvent,
    ];
    const text = formatPresenceReport(list, { appVersion: "1.0.3-rc.1", uid: "05f2b9c9-cb97", now: 100_000 });
    expect(text).toContain("app=1.0.3-rc.1 uid=05f2");
    expect(text).toContain("sent=3 (hidden=1)");
    expect(text).toContain("ack_ok=1 ack_fail=1");
    expect(text).toContain("slow(>45s)=1");
    expect(text).toContain("instances_seen=aaaa1111,bbbb2222");
    expect(text).toContain("offline_trigger");
    expect(text).toContain("presence_leave_raw");
    expect(text).toContain('"error":"timeout"');
  });

  it("never prints full uids or the instance field in the timeline", () => {
    const text = formatPresenceReport([ev(1, "offline_trigger", { origin: "x" })], {
      appVersion: "1",
      uid: "05f2b9c9-cb97-441a-9ad2-1cb77039b131",
      now: 2,
    });
    expect(text).not.toContain("05f2b9c9");
    expect(text.split("--- timeline")[1]).not.toContain("instance");
  });
});
