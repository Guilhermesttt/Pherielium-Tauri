import { describe, expect, it } from "vitest";
import {
  MAX_CALL_PARTICIPANTS,
  callCapacityMessage,
  canAcceptNewParticipant,
  countCallParticipants,
  isCallAtCapacity,
  isPersistentVoiceRoomId,
} from "./limits";

describe("voiceCall limits", () => {
  it("uses a global cap of 10", () => {
    expect(MAX_CALL_PARTICIPANTS).toBe(10);
  });

  it("detects persistent room ids", () => {
    expect(
      isPersistentVoiceRoomId("550e8400-e29b-41d4-a716-446655440000"),
    ).toBe(true);
    expect(
      isPersistentVoiceRoomId(
        "550e8400-e29b-41d4-a716-446655440000_660e8400-e29b-41d4-a716-446655440001",
      ),
    ).toBe(false);
  });

  it("counts unique participants including self", () => {
    const nineOthers = Array.from({ length: 9 }, (_, i) => ({ uid: `u${i}` }));
    expect(countCallParticipants(nineOthers)).toBe(10);
    expect(isCallAtCapacity(nineOthers)).toBe(true);
    expect(canAcceptNewParticipant(nineOthers, "new-user")).toBe(false);
    expect(canAcceptNewParticipant(nineOthers, "u0")).toBe(true);
  });

  it("formats capacity message", () => {
    expect(callCapacityMessage()).toContain("10");
  });
});
