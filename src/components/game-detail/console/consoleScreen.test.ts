import { describe, expect, it } from "vitest";
import type { SteamAchievement } from "../../../services/steam";
import {
  filterTrophies,
  formatRarity,
  formatUnlockDate,
  pickRecentAchievements,
  rarityLabel,
  splitPlaytime,
  trophyPercent,
} from "./consoleScreen";

const ach = (apiName: string, extra: Partial<SteamAchievement>): SteamAchievement => ({
  apiName,
  achieved: false,
  unlockTime: 0,
  name: apiName,
  description: "",
  icon: "",
  iconGray: "",
  hidden: false,
  ...extra,
});

describe("pickRecentAchievements", () => {
  const list = [
    ach("old", { achieved: true, unlockTime: 100 }),
    ach("new", { achieved: true, unlockTime: 900 }),
    ach("easy", { percent: 72 }),
    ach("hard", { percent: 3 }),
    ach("secret", { percent: 90, hidden: true }),
  ];

  it("desbloqueadas mais recentes primeiro, depois as bloqueadas mais fáceis", () => {
    expect(pickRecentAchievements(list).map((r) => `${r.achievement.apiName}:${r.state}`)).toEqual([
      "new:unlocked",
      "old:unlocked",
      "easy:next",
      "hard:next",
    ]);
  });

  it("ocultas e bloqueadas não aparecem (spoiler) e o limite vale", () => {
    expect(pickRecentAchievements(list).some((r) => r.achievement.apiName === "secret")).toBe(false);
    expect(pickRecentAchievements(list, 2).map((r) => r.achievement.apiName)).toEqual(["new", "old"]);
    expect(pickRecentAchievements([], 6)).toEqual([]);
  });
});

describe("splitPlaytime / trophyPercent / formatUnlockDate", () => {
  it("separa horas e minutos", () => {
    expect(splitPlaytime(23.3167)).toEqual({ hours: 23, minutes: 19 });
    expect(splitPlaytime(0.5)).toEqual({ hours: 0, minutes: 30 });
    expect(splitPlaytime(undefined)).toEqual({ hours: 0, minutes: 0 });
  });

  it("porcentagem inteira e segura", () => {
    expect(trophyPercent(31, 42)).toBe(74);
    expect(trophyPercent(0, 0)).toBe(0);
    expect(trophyPercent(50, 42)).toBe(100);
  });

  it("raridade: decimal abaixo de 10%, nada sem dado", () => {
    expect(formatRarity(4.23, "têm")).toBe("4,2% têm");
    expect(formatRarity(72.6, "têm")).toBe("73% têm");
    expect(formatRarity(0, "têm")).toBeNull();
    expect(formatRarity(undefined, "têm")).toBeNull();
    expect(formatRarity(4.23, "have it", "en-US")).toBe("4.2% have it");
  });

  it("data a partir de segundos; sem data, null", () => {
    expect(formatUnlockDate(0, "pt-BR")).toBeNull();
    expect(formatUnlockDate(1_792_000_000, "pt-BR")).toMatch(/2026/);
  });
});

describe("rarityLabel", () => {
  it("faixas de raridade e ausência de dado", () => {
    expect(rarityLabel(0.4)).toBe("ultra");
    expect(rarityLabel(3)).toBe("veryRare");
    expect(rarityLabel(10.45)).toBe("rare");
    expect(rarityLabel(40)).toBe("common");
    expect(rarityLabel(0)).toBeNull();
    expect(rarityLabel(undefined)).toBeNull();
  });
});

describe("filterTrophies", () => {
  const list = [
    ach("old", { achieved: true, unlockTime: 100, name: "Old One", description: "first thing" }),
    ach("new", { achieved: true, unlockTime: 900, name: "Newest", description: "later" }),
    ach("easy", { percent: 72, name: "Easy", description: "find the key" }),
    ach("hard", { percent: 3, name: "Hard", description: "do it all" }),
    ach("secret", { percent: 1, hidden: true, name: "Mystery", description: "the butler did it" }),
  ];

  it("ordena: desbloqueados recentes primeiro, depois os bloqueados mais fáceis", () => {
    expect(filterTrophies(list, "all", "").map((a) => a.apiName)).toEqual(["new", "old", "easy", "hard", "secret"]);
  });

  it("filtra por estado", () => {
    expect(filterTrophies(list, "unlocked", "").map((a) => a.apiName)).toEqual(["new", "old"]);
    expect(filterTrophies(list, "locked", "").map((a) => a.apiName)).toEqual(["easy", "hard", "secret"]);
  });

  it("busca no nome e na descrição, mas não na descrição de troféu oculto bloqueado", () => {
    expect(filterTrophies(list, "all", "KEY").map((a) => a.apiName)).toEqual(["easy"]);
    expect(filterTrophies(list, "all", "butler")).toEqual([]);
    expect(filterTrophies(list, "all", "mystery").map((a) => a.apiName)).toEqual(["secret"]);
  });
});
