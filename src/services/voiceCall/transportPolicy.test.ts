import { describe, expect, it } from "vitest";
import { isLiveKitGloballyDisabled, shouldUseP2PFallback } from "./transportPolicy";

describe("voice transport policy", () => {
  it("detects globally disabled LiveKit", () => {
    expect(isLiveKitGloballyDisabled(new Error("LiveKit não habilitado no backend."))).toBe(true);
    expect(isLiveKitGloballyDisabled(new Error("connection refused"))).toBe(false);
  });

  it("allows P2P only for start-call or when LiveKit is globally disabled", () => {
    expect(shouldUseP2PFallback("start-call", new Error("timeout"))).toBe(true);
    expect(shouldUseP2PFallback("answer-call", new Error("timeout"))).toBe(false);
    expect(
      shouldUseP2PFallback("join-room", new Error("LiveKit não habilitado no backend.")),
    ).toBe(true);
    expect(shouldUseP2PFallback("join-invite", new Error("token expired"))).toBe(false);
  });
});
