import { describe, expect, it } from "vitest";
import {
  cleanUid,
  evaluateCallAnswer,
  evaluateCallEnd,
  evaluateCallInvite,
  evaluateCallKick,
  evaluateCallPrivacy,
  evaluateCallSignal,
  getGuardMode,
  isRoomChat,
  shouldProcess,
  type GuardContext,
} from "./eventGuards";

const ME = "me-uid";
const FRIEND = "friend-uid";
const ROOM = "11111111-2222-3333-4444-555555555555";
const ONE_ON_ONE = `${FRIEND}_${ME}`;

const ctx = (over: Partial<GuardContext> = {}): GuardContext => ({
  localUid: ME,
  currentChatId: ONE_ON_ONE,
  peerUid: FRIEND,
  hostUid: null,
  participantUids: new Set(),
  friendUids: new Set([FRIEND]),
  ...over,
});

describe("helpers", () => {
  it("cleans the cp-friend: prefix", () => {
    expect(cleanUid("cp-friend:abc ")).toBe("abc");
    expect(cleanUid(undefined)).toBe("");
  });

  it("tells rooms from 1:1 chats", () => {
    expect(isRoomChat(ROOM)).toBe(true);
    expect(isRoomChat(ONE_ON_ONE)).toBe(false);
    expect(isRoomChat(null)).toBe(false);
  });
});

describe("evaluateCallEnd", () => {
  it("accepts the peer ending the current 1:1 call", () => {
    expect(evaluateCallEnd(ctx(), { senderId: FRIEND, chatId: ONE_ON_ONE })).toEqual({ accept: true, reason: "ok" });
  });

  it("accepts the peer with a cp-friend: prefix", () => {
    expect(evaluateCallEnd(ctx(), { senderId: `cp-friend:${FRIEND}`, chatId: ONE_ON_ONE }).accept).toBe(true);
  });

  it("rejects a stranger, another chat and our own echo", () => {
    expect(evaluateCallEnd(ctx(), { senderId: "stranger", chatId: ONE_ON_ONE })).toEqual({ accept: false, reason: "sender-not-peer" });
    expect(evaluateCallEnd(ctx(), { senderId: FRIEND, chatId: "other_chat" })).toEqual({ accept: false, reason: "wrong-chat" });
    expect(evaluateCallEnd(ctx(), { senderId: ME, chatId: ONE_ON_ONE })).toEqual({ accept: false, reason: "self" });
  });

  it("does not judge when there is no call context", () => {
    expect(evaluateCallEnd(ctx({ currentChatId: null, peerUid: null }), { senderId: "x", chatId: "y" }).reason).toBe("ok-unknown-context");
  });

  it("accepts the host and known participants in a room, rejects others", () => {
    const room = ctx({ currentChatId: ROOM, peerUid: null, hostUid: "host", participantUids: new Set(["p1"]) });
    expect(evaluateCallEnd(room, { senderId: "host", chatId: ROOM }).accept).toBe(true);
    expect(evaluateCallEnd(room, { senderId: "p1", chatId: ROOM }).accept).toBe(true);
    expect(evaluateCallEnd(room, { senderId: "evil", chatId: ROOM })).toEqual({ accept: false, reason: "sender-not-participant" });
  });

  it("does not judge a room sender when nothing about the room is known yet", () => {
    const room = ctx({ currentChatId: ROOM, peerUid: null });
    expect(evaluateCallEnd(room, { senderId: "x", chatId: ROOM }).reason).toBe("ok-unknown-context");
  });
});

describe("evaluateCallKick", () => {
  const room = ctx({ currentChatId: ROOM, peerUid: null, hostUid: "host" });

  it("accepts a kick from the known host aimed at me", () => {
    expect(evaluateCallKick(room, { adminId: "host", targetUserId: ME, chatId: ROOM }).accept).toBe(true);
  });

  it("rejects when the target is not me, the admin is not the host or the room differs", () => {
    expect(evaluateCallKick(room, { adminId: "host", targetUserId: "other", chatId: ROOM }).reason).toBe("target-mismatch");
    expect(evaluateCallKick(room, { adminId: "impostor", targetUserId: ME, chatId: ROOM }).reason).toBe("sender-not-host");
    expect(evaluateCallKick(room, { adminId: "host", targetUserId: ME, chatId: "another-room" }).reason).toBe("wrong-chat");
  });

  it("rejects when the host is unknown (the old code accepted anything)", () => {
    const noHost = ctx({ currentChatId: ROOM, peerUid: null, hostUid: null });
    expect(evaluateCallKick(noHost, { adminId: "anyone", targetUserId: ME, chatId: ROOM }).reason).toBe("unknown-host");
  });
});

describe("evaluateCallPrivacy and evaluateCallSignal and evaluateCallAnswer", () => {
  it("privacy only from the known host", () => {
    const room = ctx({ currentChatId: ROOM, peerUid: null, hostUid: "host" });
    expect(evaluateCallPrivacy(room, { adminId: "host", chatId: ROOM }).accept).toBe(true);
    expect(evaluateCallPrivacy(room, { adminId: "x", chatId: ROOM }).accept).toBe(false);
  });

  it("signal and answer only from the peer in 1:1", () => {
    expect(evaluateCallSignal(ctx(), { senderId: FRIEND, chatId: ONE_ON_ONE }).accept).toBe(true);
    expect(evaluateCallSignal(ctx(), { senderId: "evil", chatId: ONE_ON_ONE }).accept).toBe(false);
    expect(evaluateCallAnswer(ctx(), { responderId: FRIEND, chatId: ONE_ON_ONE }).accept).toBe(true);
    expect(evaluateCallAnswer(ctx(), { responderId: "evil", chatId: ONE_ON_ONE }).accept).toBe(false);
  });
});

describe("evaluateCallInvite", () => {
  const idle = ctx({ currentChatId: null, peerUid: null });

  it("accepts an invite from a friend and rejects a stranger", () => {
    expect(evaluateCallInvite(idle, { callerId: FRIEND, chatId: ONE_ON_ONE }).accept).toBe(true);
    expect(evaluateCallInvite(idle, { callerId: "stranger", chatId: "x_y" })).toEqual({ accept: false, reason: "not-a-friend" });
  });

  it("does not drop invites while the friend list has not loaded", () => {
    expect(evaluateCallInvite(ctx({ currentChatId: null, peerUid: null, friendUids: new Set() }), { callerId: "x", chatId: "y" }).reason).toBe("ok-unknown-context");
  });

  it("rejects an invite from ourselves", () => {
    expect(evaluateCallInvite(idle, { callerId: ME, chatId: "x" }).reason).toBe("self");
  });

  it("rejects a re-invite for the current 1:1 chat that does not come from the peer", () => {
    expect(evaluateCallInvite(ctx(), { callerId: "evil", chatId: ONE_ON_ONE }).reason).toBe("sender-not-peer");
  });
});

describe("mode", () => {
  it("defaults to log and validates the flag", () => {
    expect(getGuardMode({ getItem: () => null })).toBe("log");
    expect(getGuardMode({ getItem: () => "enforce" })).toBe("enforce");
    expect(getGuardMode({ getItem: () => "weird" })).toBe("log");
  });

  it("only enforce blocks rejected events", () => {
    const rejected = { accept: false, reason: "wrong-chat" as const };
    expect(shouldProcess("log", rejected)).toBe(true);
    expect(shouldProcess("off", rejected)).toBe(true);
    expect(shouldProcess("enforce", rejected)).toBe(false);
    expect(shouldProcess("enforce", { accept: true, reason: "ok" })).toBe(true);
  });
});
