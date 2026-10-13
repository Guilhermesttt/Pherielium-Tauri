import { describe, expect, it } from "vitest";
import { buildOneOnOneInviteCardText, isCallInviteText, isInviteCardForChat, messageNotificationPreview } from "./inviteMessage";

describe("messageNotificationPreview", () => {
  const invite = JSON.stringify({ __type: "call_invite", chatId: "c", roomName: "Sala", createdAt: 1 });

  it("never shows the raw call_invite JSON in a notification", () => {
    expect(isCallInviteText(invite)).toBe(true);
    expect(messageNotificationPreview(invite, false)).toBe("Convidou para uma chamada.");
    const named = JSON.stringify({ __type: "call_invite", chatId: "c", callerName: "Bia" });
    expect(messageNotificationPreview(named, false)).toBe("Bia convidou para uma chamada.");
    expect(messageNotificationPreview(invite, false, "Ana")).toBe("Ana convidou para uma chamada.");
  });

  it("keeps normal text and images as before", () => {
    expect(messageNotificationPreview("oi", false)).toBe("oi");
    expect(messageNotificationPreview("oi", true)).toBe("📷 Enviou uma imagem");
    expect(isCallInviteText("{\"outro\":1}")).toBe(false);
    expect(isCallInviteText(undefined)).toBe(false);
  });
});

describe("1:1 invite card", () => {
  const text = buildOneOnOneInviteCardText({ chatId: "a_b", callerId: "a", callerName: "Ana", callerAvatar: null, nowMs: 5 });

  it("is a call_invite card that carries the caller id and reads as an invite", () => {
    expect(isCallInviteText(text)).toBe(true);
    expect(JSON.parse(text)).toMatchObject({ chatId: "a_b", callerId: "a", callerName: "Ana", isPrivate: false, createdAt: 5 });
    expect(messageNotificationPreview(text, false)).toBe("Ana convidou para uma chamada.");
  });

  it("is recognised as the card of that 1:1 chat only", () => {
    expect(isInviteCardForChat(text, "a_b")).toBe(true);
    expect(isInviteCardForChat(text, "other")).toBe(false);
    expect(isInviteCardForChat("oi", "a_b")).toBe(false);
  });
});
