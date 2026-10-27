import { describe, expect, it } from "vitest";
import { buildChannelInvitePayload, isNightKind } from "./channelInvite";

const base = {
  roomId: "room-1",
  roomName: "Noite de jogo: Hades II",
  category: "resenha_games" as const,
  isPrivate: false,
  callerName: "Gui",
};

describe("buildChannelInvitePayload", () => {
  it("monta o cartão que o CallInviteCard lê", () => {
    expect(buildChannelInvitePayload({ ...base, callerAvatar: "https://x/a.png" }, 123)).toEqual({
      __type: "call_invite",
      chatId: "room-1",
      roomName: "Noite de jogo: Hades II",
      category: "resenha_games",
      callerName: "Gui",
      callerAvatar: "https://x/a.png",
      isPrivate: false,
      createdAt: 123,
    });
  });

  it("não manda avatar embutido (data:) nem vazio", () => {
    expect(buildChannelInvitePayload({ ...base, callerAvatar: "data:image/png;base64,AAAA" }).callerAvatar).toBeNull();
    expect(buildChannelInvitePayload({ ...base, callerAvatar: "" }).callerAvatar).toBeNull();
    expect(buildChannelInvitePayload(base).callerAvatar).toBeNull();
  });

  it("anuncia o tipo de noite só quando há um (convite comum não ganha o campo)", () => {
    expect(buildChannelInvitePayload({ ...base, nightKind: "movie" }).nightKind).toBe("movie");
    expect("nightKind" in buildChannelInvitePayload(base)).toBe(false);
  });

  it("reconhece só os tipos de noite conhecidos", () => {
    expect(["game", "movie", "chat"].every(isNightKind)).toBe(true);
    expect(isNightKind("karaoke")).toBe(false);
    // "estudos" saiu da lista: cartões antigos com esse tipo viram convite comum
    expect(isNightKind("study")).toBe(false);
    expect(isNightKind(undefined)).toBe(false);
  });

  it("preserva se a sala é privada, para o cartão pedir a senha", () => {
    expect(buildChannelInvitePayload({ ...base, isPrivate: true }).isPrivate).toBe(true);
  });
});
