import { describe, expect, it } from "vitest";
import {
  PHERIELIUM_DOWNLOAD_URL,
  buildInviteMessage,
  discordIdOf,
  groupDiscordFriends,
  type DiscordMatch,
} from "./discordFriendGroups";
import type { SocialFriend } from "../../types/domain";

const dc = (id: string): SocialFriend => ({ id: `discord-friend:${id}`, name: id, status: "offline", source: "discord_friend" });
const match = (uid: string, discordId: string): DiscordMatch => ({ uid, discordId, displayName: uid, photoURL: null });
const none = { friendUids: new Set<string>(), outgoingUids: new Set<string>(), incomingUids: new Set<string>() };

describe("groupDiscordFriends", () => {
  it("separa amigos, pendentes, adicionáveis e quem não tem conta", () => {
    const groups = groupDiscordFriends(
      [dc("1"), dc("2"), dc("3"), dc("4"), dc("5")],
      [match("u1", "1"), match("u2", "2"), match("u3", "3"), match("u5", "5")],
      { friendUids: new Set(["u1"]), outgoingUids: new Set(["u2"]), incomingUids: new Set(["u5"]) },
    );
    expect(groups.friends.map((f) => f.name)).toEqual(["1"]);
    expect(groups.pending.map((f) => f.name)).toEqual(["2", "5"]);
    expect(groups.addable.map((f) => f.name)).toEqual(["3"]);
    expect(groups.invite.map((f) => f.name)).toEqual(["4"]);
    expect(groups.stateById["discord-friend:3"]).toEqual({ kind: "addable", uid: "u3" });
    expect(groups.stateById["discord-friend:5"]).toEqual({ kind: "pending_in", uid: "u5" });
    expect(groups.stateById["discord-friend:4"]).toEqual({ kind: "invite" });
  });

  it("sem resposta do RPC todos viram convite", () => {
    const groups = groupDiscordFriends([dc("1"), dc("2")], [], none);
    expect(groups.invite).toHaveLength(2);
    expect(groups.addable).toHaveLength(0);
  });

  it("ignora linhas que não são amigos do Discord", () => {
    const local: SocialFriend = { id: "cp-friend:x", name: "x", status: "offline", source: "checkpoint" };
    const groups = groupDiscordFriends([local], [match("x", "x")], none);
    expect(groups.stateById).toEqual({});
  });
});

describe("discordIdOf", () => {
  it("extrai o id do Discord e rejeita outros prefixos", () => {
    expect(discordIdOf(dc("123"))).toBe("123");
    expect(discordIdOf({ id: "cp-friend:1", name: "a", status: "offline" })).toBeNull();
  });
});

describe("buildInviteMessage", () => {
  it("leva o link de download e não promete envio automático", () => {
    const msg = buildInviteMessage("Ana");
    expect(msg).toContain(PHERIELIUM_DOWNLOAD_URL);
    expect(msg.startsWith("Ana te chamou")).toBe(true);
    expect(buildInviteMessage("  ").startsWith("Te chamei")).toBe(true);
  });
});
