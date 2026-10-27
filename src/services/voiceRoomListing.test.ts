import { describe, expect, it } from "vitest";
import type { VoiceRoom } from "../types/voice-governance";
import { mergeVoiceRooms } from "./voiceRoomListing";

const room = (id: string, createdAt: string, extra: Partial<VoiceRoom> = {}): VoiceRoom =>
  ({
    id,
    hostUid: "host",
    name: id,
    category: "casual_chat",
    isPrivate: false,
    hasPassword: false,
    maxParticipants: 10,
    status: "active",
    createdAt,
    participantsCount: 0,
    participants: [],
    ...extra,
  }) as VoiceRoom;

describe("mergeVoiceRooms", () => {
  it("acrescenta as salas privadas às públicas, da mais nova para a mais antiga", () => {
    const merged = mergeVoiceRooms(
      [room("a", "2026-10-23T10:00:00Z"), room("c", "2026-10-23T08:00:00Z")],
      [room("b", "2026-10-23T09:00:00Z", { isPrivate: true, hasPassword: true })],
    );
    expect(merged.map((r) => r.id)).toEqual(["a", "b", "c"]);
    expect(merged[1].isPrivate).toBe(true);
  });

  it("não repete uma sala que veio nas duas listas e mantém a da primeira", () => {
    const merged = mergeVoiceRooms(
      [room("a", "2026-10-23T10:00:00Z", { participantsCount: 3 })],
      [room("a", "2026-10-23T10:00:00Z", { participantsCount: 0 })],
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].participantsCount).toBe(3);
  });

  it("aceita listas vazias", () => {
    expect(mergeVoiceRooms([], [])).toEqual([]);
    expect(mergeVoiceRooms([room("a", "2026-10-23T10:00:00Z")], [])).toHaveLength(1);
  });
});
