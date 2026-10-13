import { describe, expect, it } from "vitest";
import { isPoorLink, linkQualityPresentation, planOnDisconnect, toLinkQuality } from "./livekitHealth";

describe("toLinkQuality / isPoorLink", () => {
  it.each([
    ["excellent", "excellent", false],
    ["good", "good", false],
    ["poor", "poor", true],
    ["lost", "lost", true],
    ["unknown", "unknown", false],
    [undefined, "unknown", false],
    [3, "unknown", false],
  ] as const)("%s -> %s (poor=%s)", (raw, quality, poor) => {
    expect(toLinkQuality(raw)).toBe(quality);
    expect(isPoorLink(toLinkQuality(raw))).toBe(poor);
  });
});

describe("linkQualityPresentation", () => {
  it("shows an indicator only for poor and lost links", () => {
    expect(linkQualityPresentation("poor")).toMatchObject({ show: true, tone: "warn" });
    expect(linkQualityPresentation("lost")).toMatchObject({ show: true, tone: "bad" });
    for (const q of ["excellent", "good", "unknown"] as const) expect(linkQualityPresentation(q).show).toBe(false);
  });
});

describe("planOnDisconnect", () => {
  it("ignores the disconnect the app asked for (hang up, switching rooms)", () => {
    expect(planOnDisconnect(1)).toEqual({ action: "ignore" });
  });

  it.each([
    [2, "outro lugar"],
    [4, "removido"],
    [5, "encerrada"],
    [10, "encerrada"],
  ])("reason %s is deliberate: ends the call, no rejoin", (reason, fragment) => {
    const plan = planOnDisconnect(reason);
    expect(plan.action).toBe("end-call");
    expect(plan.action === "end-call" && plan.message).toContain(fragment);
  });

  it.each([[3], [undefined], [0], [6], [8], [9], [99]])("network/server reason %s tries to rejoin 3 times (2 s, 5 s, 10 s)", (reason) => {
    const plan = planOnDisconnect(reason);
    expect(plan.action).toBe("rejoin");
    expect(plan.action === "rejoin" && plan.delaysMs).toEqual([2000, 5000, 10000]);
  });

  it("the final message when every rejoin fails names the cause", () => {
    expect(planOnDisconnect(undefined)).toMatchObject({ message: "A conexão com o servidor de voz foi perdida." });
    expect(planOnDisconnect(3)).toMatchObject({ message: expect.stringContaining("reiniciado") });
  });
});
