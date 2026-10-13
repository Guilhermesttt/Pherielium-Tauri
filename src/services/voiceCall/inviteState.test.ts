import { describe, expect, it } from "vitest";
import {
  EMPTY_INVITE_STATE,
  INVITE_DEDUPE_WINDOW_MS,
  INVITE_MATCH_TOLERANCE_MS,
  INVITE_TTL_MS,
  inviteKey,
  inviteRemainingMs,
  inviteState,
  isChannelInviteRingOn,
  isInviteCancelled,
  reduceInvites,
} from "./inviteState";
import type { CallInvitePayload } from "./types";

const invite = (over: Partial<CallInvitePayload> = {}): CallInvitePayload => ({
  callerId: "ana",
  callerName: "Ana",
  chatId: "chat-1",
  timestamp: 1_000,
  ...over,
});

describe("inviteState", () => {
  it.each([
    // [criado, agora, cancelado, esperado]
    [0, 0, false, "pending"],
    [0, INVITE_TTL_MS - 1, false, "pending"],
    [0, INVITE_TTL_MS, false, "expired"],
    [0, INVITE_TTL_MS * 2, false, "expired"],
    [0, 10, true, "cancelled"],
    [0, INVITE_TTL_MS * 2, true, "cancelled"], // cancelado vence expirado
  ])("created=%s now=%s cancelled=%s -> %s", (createdAtMs, nowMs, cancelled, expected) => {
    expect(inviteState({ createdAtMs, nowMs, cancelled })).toBe(expected);
  });

  it("remaining time never goes negative", () => {
    expect(inviteRemainingMs({ createdAtMs: 0, nowMs: 60_000 })).toBe(INVITE_TTL_MS - 60_000);
    expect(inviteRemainingMs({ createdAtMs: 0, nowMs: INVITE_TTL_MS + 5 })).toBe(0);
  });
});

describe("inviteKey", () => {
  it("uses the chat as channel when none is given", () => {
    expect(inviteKey({ chatId: "c", inviterId: "u" })).toBe("c|u|c");
    expect(inviteKey({ chatId: "c", inviterId: "u", channelId: "room" })).toBe("c|u|room");
  });
});

describe("reduceInvites", () => {
  it("stores a new invite and ignores the same one while pending", () => {
    const once = reduceInvites(EMPTY_INVITE_STATE, { type: "received", invite: invite(), nowMs: 100 });
    expect(once.pending).toHaveLength(1);
    const twice = reduceInvites(once, { type: "received", invite: invite({ timestamp: 2_000 }), nowMs: 200 });
    expect(twice).toBe(once); // mesma chave: nada muda (timestamp diferente não gera segundo convite)
  });

  it("ignores a repeat inside the dedupe window even after it was dismissed, and accepts it after", () => {
    const first = reduceInvites(EMPTY_INVITE_STATE, { type: "received", invite: invite(), nowMs: 0 });
    const dismissed = reduceInvites(first, { type: "dismissed", key: first.pending[0]!.key });
    expect(dismissed.pending).toHaveLength(0);
    const tooSoon = reduceInvites(dismissed, { type: "received", invite: invite(), nowMs: INVITE_DEDUPE_WINDOW_MS - 1 });
    expect(tooSoon).toBe(dismissed);
    const later = reduceInvites(dismissed, { type: "received", invite: invite(), nowMs: INVITE_DEDUPE_WINDOW_MS });
    expect(later.pending).toHaveLength(1);
  });

  it("keeps invites from different inviters or chats apart", () => {
    let state = reduceInvites(EMPTY_INVITE_STATE, { type: "received", invite: invite(), nowMs: 0 });
    state = reduceInvites(state, { type: "received", invite: invite({ callerId: "bia" }), nowMs: 1 });
    state = reduceInvites(state, { type: "received", invite: invite({ chatId: "chat-2" }), nowMs: 2 });
    expect(state.pending).toHaveLength(3);
  });

  it("call:end from the inviter cancels it; from someone else does not", () => {
    const state = reduceInvites(EMPTY_INVITE_STATE, { type: "received", invite: invite(), nowMs: 0 });
    const stranger = reduceInvites(state, { type: "cancelled", chatId: "chat-1", inviterId: "evil", nowMs: 5 });
    expect(stranger).toBe(state);
    const cancelled = reduceInvites(state, { type: "cancelled", chatId: "chat-1", inviterId: "ana", nowMs: 5 });
    expect(cancelled.pending).toHaveLength(0);
    expect(isInviteCancelled(cancelled, "chat-1", 1_000)).toBe(true);
    expect(isInviteCancelled(cancelled, "chat-1", 1_000 + 60_000)).toBe(true); // cartão criado até 2 min depois do aviso
    expect(isInviteCancelled(cancelled, "chat-1", 1_000 + INVITE_MATCH_TOLERANCE_MS + 1)).toBe(false); // convite novo
    expect(isInviteCancelled(cancelled, "other", 0)).toBe(false);
  });

  it("live invites expire from the receipt time, not from the sender clock", () => {
    // remetente com relógio 1 h atrasado: o timestamp dele já "venceu", mas o convite acabou de chegar
    const state = reduceInvites(EMPTY_INVITE_STATE, {
      type: "received",
      invite: invite({ timestamp: -3_600_000 }),
      nowMs: 1_000_000,
    });
    expect(reduceInvites(state, { type: "prune", nowMs: 1_000_000 + INVITE_TTL_MS - 1 }).pending).toHaveLength(1);
    expect(reduceInvites(state, { type: "prune", nowMs: 1_000_000 + INVITE_TTL_MS }).pending).toHaveLength(0);
  });

  it("prune drops expired invites and old dedupe entries only", () => {
    const state = reduceInvites(EMPTY_INVITE_STATE, { type: "received", invite: invite({ timestamp: 0 }), nowMs: 0 });
    expect(reduceInvites(state, { type: "prune", nowMs: 1 })).toBe(state);
    const pruned = reduceInvites(state, { type: "prune", nowMs: INVITE_TTL_MS });
    expect(pruned.pending).toHaveLength(0);
    expect(pruned.seen).toEqual({});
  });
});

describe("isChannelInviteRingOn (sender side)", () => {
  const storage = (value: string | null) => ({ getItem: () => value });

  it("is OFF by default: channel invites go as a chat card, not as a ringing call", () => {
    expect(isChannelInviteRingOn(storage(null))).toBe(false);
    expect(isChannelInviteRingOn(storage("garbage"))).toBe(false);
  });

  it("can be turned back on", () => {
    expect(isChannelInviteRingOn(storage("1"))).toBe(true);
    expect(isChannelInviteRingOn(storage("off"))).toBe(false);
  });
});
