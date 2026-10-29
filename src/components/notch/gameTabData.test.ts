import { describe, expect, it } from "vitest";
import { buildNotchGameTab } from "./gameTabData";

const base = { title: "Resident Evil", achievements: [], unlocked: 0, total: 0, friends: [] };

describe("buildNotchGameTab", () => {
  it("sem jogo não há aba", () => {
    expect(buildNotchGameTab({ ...base, title: null })).toBeNull();
  });

  it("calcula o percentual e nunca passa de 100%", () => {
    expect(buildNotchGameTab({ ...base, unlocked: 5, total: 20 })!.percent).toBe(25);
    expect(buildNotchGameTab({ ...base, unlocked: 30, total: 20 })!.percent).toBe(100);
    expect(buildNotchGameTab({ ...base, unlocked: 3, total: 0 })!.percent).toBe(0);
  });

  it("ordena as recentes pela data quando existe, senão pela ordem da lista", () => {
    const dated = buildNotchGameTab({
      ...base,
      achievements: [
        { name: "velha", achieved: true, unlockedAt: "2026-01-01T00:00:00Z" },
        { name: "nova", achieved: true, unlockedAt: "2026-10-01T00:00:00Z" },
        { name: "bloqueada", achieved: false },
      ],
    })!;
    expect(dated.recent.map((r) => r.name)).toEqual(["nova", "velha"]);

    const undated = buildNotchGameTab({
      ...base,
      achievements: [{ name: "a", achieved: true }, { name: "b", achieved: true }],
    })!;
    expect(undated.recent.map((r) => r.name)).toEqual(["b", "a"]);
  });

  it("aceita data em segundos Unix e limita a quatro conquistas", () => {
    const items = Array.from({ length: 6 }, (_, i) => ({ name: `c${i}`, achieved: true, unlockTime: 1_700_000_000 + i }));
    const tab = buildNotchGameTab({ ...base, achievements: items })!;
    expect(tab.recent).toHaveLength(4);
    expect(tab.recent[0].name).toBe("c5");
  });

  it("só lista amigos jogando e tolera dados malformados", () => {
    const tab = buildNotchGameTab({
      ...base,
      friends: [
        { id: "1", name: "Ana", status: "playing", playing: "Hades", avatar: "a.png" },
        { id: "2", name: "Beto", status: "online" },
        { name: "Caio", playing: "Celeste" },
        null,
        "texto solto",
      ],
    })!;
    expect(tab.friendsPlaying.map((f) => f.name)).toEqual(["Ana", "Caio"]);
    expect(tab.friendsPlaying[0]).toMatchObject({ game: "Hades", avatar: "a.png" });
  });
});
