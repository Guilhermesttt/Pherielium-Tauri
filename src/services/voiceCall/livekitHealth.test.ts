import { describe, expect, it } from "vitest";
import { isPoorLink, planOnDisconnect, toLinkQuality } from "./livekitHealth";

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

describe("planOnDisconnect", () => {
  it("ignores the disconnect the app asked for (hang up, switching rooms)", () => {
    expect(planOnDisconnect(1)).toEqual({ action: "ignore" });
  });

  it.each([
    [2, "outro lugar"],
    [3, "reiniciado"],
    [4, "removido"],
    [5, "encerrada"],
    [10, "encerrada"],
  ])("reason %s ends the call with a specific message", (reason, fragment) => {
    const plan = planOnDisconnect(reason);
    expect(plan.action).toBe("end-call");
    expect(plan.action === "end-call" && plan.message).toContain(fragment);
  });

  it.each([[undefined], [0], [6], [99]])("any other or missing reason (%s) ends the call as a lost connection", (reason) => {
    const plan = planOnDisconnect(reason);
    expect(plan).toEqual({ action: "end-call", message: "A conexão com o servidor de voz foi perdida." });
  });
});
