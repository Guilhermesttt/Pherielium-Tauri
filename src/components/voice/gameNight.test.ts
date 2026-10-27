import { describe, expect, it } from "vitest";
import type { SocialFriend } from "../../types/domain";
import {
  friendUid,
  gameNightRoomConfig,
  gameNightRoomName,
  groupInvitees,
  isInviteable,
  maxInvitees,
  NIGHT_KINDS,
  nightRoomName,
  toggleInvitee,
} from "./gameNight";

const f = (uid: string, status: SocialFriend["status"], playing?: string, source: SocialFriend["source"] = "checkpoint"): SocialFriend => ({
  id: `checkpoint:${uid}`,
  name: uid,
  status,
  playing,
  source,
});

describe("gameNightRoomName", () => {
  it("usa o prefixo e o título", () => {
    expect(gameNightRoomName("Hades II")).toBe("Noite de jogo: Hades II");
  });

  it("corta só o título quando passa de 40 caracteres", () => {
    const name = gameNightRoomName("The Elder Scrolls V: Skyrim Special Edition Anniversary");
    expect(name.length).toBeLessThanOrEqual(40);
    expect(name.startsWith("Noite de jogo: The Elder")).toBe(true);
    expect(name.endsWith("…")).toBe(true);
  });

  it("título vazio não deixa a sala sem nome", () => {
    expect(gameNightRoomName("   ")).toBe("Noite de jogo: jogo");
  });
});

describe("gameNightRoomConfig", () => {
  it("cria uma sala pública de resenha por padrão", () => {
    const config = gameNightRoomConfig({ gameTitle: "Hades II", hostName: "Gui" });
    expect(config).toMatchObject({ roomName: "Noite de jogo: Hades II", category: "resenha_games", isPrivate: false });
    expect(config.password).toBeUndefined();
    expect(config.description).toBe("Noite de jogo de Gui");
  });

  it("privada só vale com senha; sem senha vira pública", () => {
    expect(gameNightRoomConfig({ gameTitle: "X", isPrivate: true, password: " abc123 " })).toMatchObject({ isPrivate: true, password: "abc123" });
    expect(gameNightRoomConfig({ gameTitle: "X", isPrivate: true, password: "  " }).isPrivate).toBe(false);
  });
});

describe("tipos de noite", () => {
  it("nomeia a sala pelo tipo, com o assunto quando há", () => {
    expect(nightRoomName("movie")).toBe("Noite de cinema");
    expect(nightRoomName("movie", "Duna")).toBe("Noite de cinema: Duna");
    expect(nightRoomName("chat", "  ")).toBe("Noite de resenha");
    expect(nightRoomName("chat", "Jogos antigos")).toBe("Noite de resenha: Jogos antigos");
    expect(nightRoomName("game", "")).toBe("Noite de jogo: jogo");
  });

  it("corta só o assunto nos tipos sem jogo também", () => {
    const name = nightRoomName("movie", "O Senhor dos Anéis: A Sociedade do Anel (Versão Estendida)");
    expect(name.length).toBeLessThanOrEqual(40);
    expect(name.startsWith("Noite de cinema: O Senhor")).toBe(true);
  });

  it("a configuração da sala segue o tipo: ícone, categoria e descrição", () => {
    expect(gameNightRoomConfig({ kind: "movie", subject: "Duna", hostName: "Gui" })).toMatchObject({
      roomName: "Noite de cinema: Duna",
      category: "casual_chat",
      icon: "🎬",
      description: "Noite de cinema de Gui",
    });
    expect(gameNightRoomConfig({ kind: "chat" })).toMatchObject({ category: "casual_chat", icon: "💬" });
    // sem tipo, continua sendo a noite de jogo de sempre
    expect(gameNightRoomConfig({ gameTitle: "Hades II" })).toMatchObject({ roomName: "Noite de jogo: Hades II", icon: "🎮" });
  });

  it("fora da noite de jogo ninguém vem pré-marcado por jogar o título", () => {
    const groups = groupInvitees([f("a", "playing", "Hades II"), f("b", "online")], "");
    expect(groups.playingIt).toEqual([]);
    expect(groups.online.map((x) => x.name)).toEqual(["a", "b"]);
  });
});

describe("seletor de tipo", () => {
  it("tem jogos, cinema e resenha, cada um com um ícone SF Symbol (e sem estudos)", () => {
    expect(NIGHT_KINDS.map((k) => k.id)).toEqual(["game", "movie", "chat"]);
    expect(NIGHT_KINDS.every((k) => k.symbol.length > 0)).toBe(true);
    expect(new Set(NIGHT_KINDS.map((k) => k.symbol)).size).toBe(NIGHT_KINDS.length);
  });
});

describe("groupInvitees", () => {
  it("separa quem joga o título, quem está online e quem está offline", () => {
    const groups = groupInvitees(
      [
        f("zeca", "playing", "hades ii"),
        f("ana", "online"),
        f("bia", "playing", "Outro Jogo"),
        f("caio", "offline"),
        f("duda", "idle"),
      ],
      "Hades II",
    );
    expect(groups.playingIt.map((x) => x.name)).toEqual(["zeca"]);
    expect(groups.online.map((x) => x.name)).toEqual(["ana", "bia", "duda"]);
    expect(groups.offline.map((x) => x.name)).toEqual(["caio"]);
  });

  it("deixa de fora quem não é amigo do Pherielium (Discord)", () => {
    const discord: SocialFriend = { id: "discord:1", name: "d", status: "online", source: "discord" };
    expect(isInviteable(discord)).toBe(false);
    const groups = groupInvitees([discord, f("ana", "online")], "X");
    expect(groups.online.map((x) => x.name)).toEqual(["ana"]);
  });
});

describe("seleção", () => {
  it("o anfitrião ocupa uma vaga", () => {
    expect(maxInvitees(10)).toBe(9);
    expect(maxInvitees(0)).toBe(0);
  });

  it("marca, desmarca e para no limite", () => {
    let selected: string[] = [];
    selected = toggleInvitee(selected, "a", 2);
    selected = toggleInvitee(selected, "b", 2);
    expect(toggleInvitee(selected, "c", 2)).toEqual(["a", "b"]);
    expect(toggleInvitee(selected, "a", 2)).toEqual(["b"]);
  });

  it("extrai o uid do id do amigo", () => {
    expect(friendUid(f("abc", "online"))).toBe("abc");
    expect(friendUid({ id: "xyz", name: "n", status: "online" })).toBe("xyz");
  });
});
