import { describe, expect, it } from "vitest";
import { buildBoard, formatLastSeen, groupPlaying, railSections, titleHue } from "./friendsBoard";
import type { Game, SocialFriend } from "../../types/domain";

const f = (id: string, status: SocialFriend["status"], playing?: string): SocialFriend => ({ id, name: id, status, playing });
const game = (title: string, image: string): Game => ({ id: title, title, image } as unknown as Game);

describe("groupPlaying", () => {
  it("agrupa pelo jogo, ignora maiúsculas/pontuação e ordena pelo mais cheio", () => {
    const groups = groupPlaying([
      f("a", "playing", "Hades II"),
      f("b", "playing", "hades ii"),
      f("c", "playing", "Counter-Strike 2"),
      f("d", "online"),
    ]);
    expect(groups.map((g) => g.friends.length)).toEqual([2, 1]);
    expect(groups[0].title).toBe("Hades II");
  });

  it("usa a arte da biblioteca quando o jogo existe lá", () => {
    const groups = groupPlaying([f("a", "playing", "Hades II")], [game("Hades II", "cover.png")]);
    expect(groups[0].art).toBe("cover.png");
    expect(groupPlaying([f("a", "playing", "Outro")], [game("Hades II", "x")])[0].art).toBeNull();
  });

  it("jogando sem título vira 'Um jogo'", () => {
    expect(groupPlaying([f("a", "playing")])[0].title).toBe("Um jogo");
  });
});

describe("buildBoard", () => {
  it("separa jogando, online e offline sem repetir ninguém", () => {
    const b = buildBoard([f("z", "online"), f("a", "playing", "X"), f("m", "offline"), f("b", "idle")]);
    expect(b.playing.flatMap((g) => g.friends.map((x) => x.id))).toEqual(["a"]);
    expect(b.online.map((x) => x.id)).toEqual(["b", "z"]);
    expect(b.offline.map((x) => x.id)).toEqual(["m"]);
  });
});

describe("helpers", () => {
  it("matiz estável por título", () => {
    expect(titleHue("Hades II")).toBe(titleHue("Hades II"));
    expect(titleHue("Hades II")).toBeGreaterThanOrEqual(0);
    expect(titleHue("Hades II")).toBeLessThan(360);
  });

  it("formata a última vez visto", () => {
    const now = 10_000_000_000;
    expect(formatLastSeen(now - 3 * 3_600_000, now)).toBe("há 3 h");
    expect(formatLastSeen(now - 2 * 86_400_000, now)).toBe("há 2 d");
    expect(formatLastSeen(undefined, now)).toBe("");
  });
});

describe("railSections", () => {
  it("separa jogando, online e só conta os offline", () => {
    const rail = railSections([
      f("zeca", "playing", "Hades II"),
      f("ana", "playing", "CS2"),
      f("bia", "online"),
      f("caio", "idle"),
      f("duda", "offline"),
      f("edu", "offline"),
      f("fabi", "in_call"),
    ]);
    expect(rail.playing.map((x) => x.id)).toEqual(["ana", "zeca"]);
    expect(rail.inCall.map((x) => x.id)).toEqual(["fabi"]);
    expect(rail.online.map((x) => x.id)).toEqual(["bia", "caio"]);
    expect(rail.offline.map((x) => x.id)).toEqual(["duda", "edu"]);
  });

  it("os offline vistos há menos tempo vêm primeiro; sem data, por nome no fim", () => {
    const seen = (uid: string, lastSeen?: number): SocialFriend => ({ ...f(uid, "offline"), lastSeen });
    const rail = railSections([seen("ana", 1000), seen("bia", 3000), seen("caio"), seen("duda", 2000)]);
    expect(rail.offline.map((x) => x.id)).toEqual(["bia", "duda", "ana", "caio"]);
  });

  it("lista vazia não quebra", () => {
    expect(railSections([])).toEqual({ playing: [], inCall: [], online: [], offline: [] });
  });
});
