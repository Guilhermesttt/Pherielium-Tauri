import { describe, expect, it } from "vitest";
import { isPresenceActive, presenceLabel } from "./presenceStatus";

describe("presenceStatus", () => {
  it("keeps call, idle and dnd visible", () => {
    expect(isPresenceActive("streaming")).toBe(true);
    expect(isPresenceActive("in_call")).toBe(true);
    expect(isPresenceActive("idle")).toBe(true);
    expect(isPresenceActive("dnd")).toBe(true);
    expect(isPresenceActive("offline")).toBe(false);
  });

  it("labels rich presence", () => {
    expect(presenceLabel("playing", "RE Requiem")).toBe("Jogando RE Requiem");
    expect(presenceLabel("streaming")).toBe("Transmitindo");
    expect(presenceLabel("in_call")).toBe("Em chamada");
    expect(presenceLabel("idle")).toBe("Ausente");
  });
});
