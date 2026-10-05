import { describe, expect, it } from "vitest";
import { resolveOverlayCallPhase } from "./overlayCallPhase";

const base = {
  enabled: true,
  callActive: true,
  hubVisible: false,
  dismissed: false,
  pointerInReveal: false,
};

describe("resolveOverlayCallPhase", () => {
  it("hides the overlay while the hub is visible", () => {
    expect(resolveOverlayCallPhase({ ...base, hubVisible: true, dismissed: true })).toBe("hidden");
  });

  it("shows the overlay when the hub is hidden and the call is active", () => {
    expect(resolveOverlayCallPhase(base)).toBe("visible");
  });

  it("stays dismissed until the top edge is touched", () => {
    expect(resolveOverlayCallPhase({ ...base, dismissed: true })).toBe("dismissed");
    expect(resolveOverlayCallPhase({ ...base, dismissed: true, pointerInReveal: true })).toBe("revealing");
  });
});
