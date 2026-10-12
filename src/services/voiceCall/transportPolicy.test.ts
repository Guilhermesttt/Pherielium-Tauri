import { describe, expect, it } from "vitest";
import { isLiveKitGloballyDisabled, shouldUseP2PFallback, type VoiceTransportContext } from "./transportPolicy";

const CONTEXTS: VoiceTransportContext[] = ["start-call", "answer-call", "join-room", "join-invite"];

describe("voice transport policy", () => {
  it("detects globally disabled LiveKit", () => {
    expect(isLiveKitGloballyDisabled(new Error("LiveKit não habilitado no backend."))).toBe(true);
    expect(isLiveKitGloballyDisabled(new Error("connection refused"))).toBe(false);
  });

  it("never switches to P2P on an individual failure when the flag is off (same for every context)", () => {
    // Regressão: antes, "start-call" devolvia true para QUALQUER erro, e só quem ligava caía para P2P.
    for (const context of CONTEXTS) {
      expect(shouldUseP2PFallback(context, new Error("timeout"), { p2pFlag: false })).toBe(false);
      expect(shouldUseP2PFallback(context, new Error("Token de autenticacao invalido."), { p2pFlag: false })).toBe(false);
    }
  });

  it("uses P2P for every context when the backend declares LiveKit disabled (both sides get the same answer)", () => {
    for (const context of CONTEXTS) {
      expect(shouldUseP2PFallback(context, new Error("LiveKit não habilitado no backend."), { p2pFlag: false })).toBe(true);
    }
  });

  it("uses P2P for every context only when the manual flag is on", () => {
    for (const context of CONTEXTS) {
      expect(shouldUseP2PFallback(context, new Error("timeout"), { p2pFlag: true })).toBe(true);
    }
  });
});
