import { describe, expect, it } from "vitest";
import { isCallInviteText, messageNotificationPreview } from "./inviteMessage";

describe("messageNotificationPreview", () => {
  const invite = JSON.stringify({ __type: "call_invite", chatId: "c", roomName: "Sala", createdAt: 1 });

  it("never shows the raw call_invite JSON in a notification", () => {
    expect(isCallInviteText(invite)).toBe(true);
    expect(messageNotificationPreview(invite, false)).toBe("📞 Convidou você para uma call");
  });

  it("keeps normal text and images as before", () => {
    expect(messageNotificationPreview("oi", false)).toBe("oi");
    expect(messageNotificationPreview("oi", true)).toBe("📷 Enviou uma imagem");
    expect(isCallInviteText("{\"outro\":1}")).toBe(false);
    expect(isCallInviteText(undefined)).toBe(false);
  });
});
