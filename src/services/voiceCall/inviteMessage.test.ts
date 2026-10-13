import { describe, expect, it } from "vitest";
import { isCallInviteText, messageNotificationPreview } from "./inviteMessage";

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
