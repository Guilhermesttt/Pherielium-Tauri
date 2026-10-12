import { describe, expect, it } from "vitest";
import {
  diffInviteOverlay,
  inviteHandling,
  resolveAnswerSource,
  resolveRejectSource,
  inviteNotificationId,
  inviteOverlayPayload,
  inviteToastShouldPlaySound,
  nextInviteExpiryMs,
  parseInviteNotificationId,
} from "./inviteSurfaces";
import { INVITE_TTL_MS, type PendingInvite } from "./inviteState";

const pending = (key: string, receivedAtMs = 0): PendingInvite => ({
  key,
  receivedAtMs,
  invite: { callerId: "ana", callerName: "Ana", callerAvatar: "a.png", chatId: "chat-1", timestamp: receivedAtMs },
});

describe("notification ids", () => {
  it("round-trips invite ids and rejects the legacy ring id and junk", () => {
    expect(parseInviteNotificationId(inviteNotificationId("c|ana|c"))).toBe("c|ana|c");
    expect(parseInviteNotificationId("incoming-call:chat-1:123")).toBeNull();
    expect(parseInviteNotificationId("invite:")).toBeNull();
    expect(parseInviteNotificationId(42)).toBeNull();
    expect(parseInviteNotificationId(undefined)).toBeNull();
  });
});

describe("single sound source", () => {
  it.each([
    [true, false], // overlay disponível: ele toca, o toast do hub fica mudo
    [false, true], // sem overlay: o toast toca
  ])("overlayAvailable=%s -> toast sound=%s", (overlayAvailable, expected) => {
    expect(inviteToastShouldPlaySound({ overlayAvailable })).toBe(expected);
  });
});

describe("inviteOverlayPayload", () => {
  it("uses the existing incoming-call overlay type, lasts 15 min and carries the id for accept/dismiss", () => {
    const payload = inviteOverlayPayload(pending("k"));
    expect(payload).toMatchObject({
      type: "incoming-call",
      id: "invite:k",
      notificationId: "invite:k",
      duration: INVITE_TTL_MS,
      friendId: "ana",
      imageUrl: "a.png",
    });
    expect(payload.metadata.senderName).toBe("Ana");
  });
});

describe("diffInviteOverlay (regression: overlay path with and without the flag)", () => {
  it("flag ON: shows new invites once and dismisses the ones that left (accepted, cancelled, expired, dismissed)", () => {
    const first = diffInviteOverlay(new Set(), [pending("a"), pending("b")], true);
    expect(first.show.map((p) => p.key)).toEqual(["a", "b"]);
    expect(first.dismiss).toEqual([]);

    const shown = new Set(["invite:a", "invite:b"]);
    expect(diffInviteOverlay(shown, [pending("a"), pending("b")], true)).toEqual({ show: [], dismiss: [] });

    const afterAccept = diffInviteOverlay(shown, [pending("b")], true);
    expect(afterAccept.show).toEqual([]);
    expect(afterAccept.dismiss).toEqual(["invite:a"]);
  });

  it("flag OFF: never shows anything and cleans up leftovers, so the old ringing-in overlay path is the only one", () => {
    expect(diffInviteOverlay(new Set(), [pending("a")], false)).toEqual({ show: [], dismiss: [] });
    expect(diffInviteOverlay(new Set(["invite:a"]), [pending("a")], false)).toEqual({ show: [], dismiss: ["invite:a"] });
  });
});

describe("nextInviteExpiryMs", () => {
  it("is null without invites and the soonest remaining time otherwise", () => {
    expect(nextInviteExpiryMs([], 0)).toBeNull();
    expect(nextInviteExpiryMs([pending("a", 0), pending("b", 60_000)], 120_000)).toBe(INVITE_TTL_MS - 120_000);
    expect(nextInviteExpiryMs([pending("a", 0)], INVITE_TTL_MS + 5)).toBe(0);
  });
});

describe("flag OFF keeps the previous behavior (regression for the no-argument callers)", () => {
  it.each(["idle", "ringing-in", "ringing-out", "connecting", "active"])("call:invite in state %s stays on the legacy path", (callState) => {
    expect(inviteHandling({ flagOn: false, callState })).toBe("legacy");
  });

  it("flag ON only changes the idle case", () => {
    expect(inviteHandling({ flagOn: true, callState: "idle" })).toBe("notification");
    expect(inviteHandling({ flagOn: true, callState: "active" })).toBe("legacy");
  });

  // Com a flag desligada nunca há convite pendente (só o ramo "notification" os cria), então pendingCount é sempre 0.
  it.each([
    [{ hasOverride: true, hasIncoming: true }, "override"],
    [{ hasOverride: false, hasIncoming: true }, "incoming"],
    [{ hasOverride: false, hasIncoming: false }, "none"],
  ] as const)("answerCall with no pending invites: %j -> %s (old: override || incoming || nothing)", (input, expected) => {
    expect(resolveAnswerSource({ ...input, pendingCount: 0 })).toBe(expected);
  });

  it.each([
    [true, "incoming"],
    [false, "none"],
  ])("rejectCall with no pending invites: incoming=%s -> %s", (hasIncoming, expected) => {
    expect(resolveRejectSource({ hasIncoming, pendingCount: 0 })).toBe(expected);
  });

  it("pending invites are used only when nothing is ringing", () => {
    expect(resolveAnswerSource({ hasOverride: false, hasIncoming: false, pendingCount: 2 })).toBe("pending");
    expect(resolveAnswerSource({ hasOverride: false, hasIncoming: true, pendingCount: 2 })).toBe("incoming");
    expect(resolveRejectSource({ hasIncoming: false, pendingCount: 1 })).toBe("pending");
    expect(resolveRejectSource({ hasIncoming: true, pendingCount: 1 })).toBe("incoming");
  });
});
