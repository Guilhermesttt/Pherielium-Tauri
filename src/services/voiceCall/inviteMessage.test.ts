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

  it("announces the night (game, cinema...) in the notification instead of a generic call", () => {
    const night = JSON.stringify({ __type: "call_invite", chatId: "c", callerName: "Gui", roomName: "Noite de cinema: Duna", nightKind: "movie" });
    expect(messageNotificationPreview(night, false)).toBe("Gui chamou você para a Noite de cinema: Duna.");
    expect(messageNotificationPreview(night, false, "Ana")).toBe("Gui chamou você para a Noite de cinema: Duna.");
    // sem o nome de quem convidou, usa o do amigo da lista; sem nenhum, a frase continua inteira
    const anon = JSON.stringify({ __type: "call_invite", chatId: "c", roomName: "Noite de jogo: Hades II", nightKind: "game" });
    expect(messageNotificationPreview(anon, false, "Ana")).toBe("Ana chamou você para a Noite de jogo: Hades II.");
    expect(messageNotificationPreview(anon, false)).toBe("Chamou você para a Noite de jogo: Hades II.");
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
