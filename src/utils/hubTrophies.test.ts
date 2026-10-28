import { beforeEach, describe, expect, it, vi } from "vitest";
import { awardHubAchievement, getHubCounts, isHubAchievement, tierIndexFromName } from "./hubTrophies";

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  });
});

describe("tierIndexFromName", () => {
  it("lê os nomes de tier do overlay, em inglês ou português", () => {
    expect(tierIndexFromName("platinum")).toBe(0);
    expect(tierIndexFromName("Ouro")).toBe(1);
    expect(tierIndexFromName("silver")).toBe(2);
    expect(tierIndexFromName("bronze")).toBe(3);
  });

  it("um tier desconhecido não vira troféu", () => {
    expect(tierIndexFromName("diamond")).toBeNull();
    expect(tierIndexFromName(undefined)).toBeNull();
  });
});

describe("awardHubAchievement", () => {
  it("conta a conquista na primeira vez e ignora as seguintes (dois ouvintes, um troféu)", () => {
    expect(awardHubAchievement("u1", "steam_1", "ACH_A", 3)).toBe(true);
    expect(awardHubAchievement("u1", "steam_1", "ACH_A", 3)).toBe(false);
    expect(getHubCounts("u1", "steam_1").bronze).toBe(1);
    expect(isHubAchievement("u1", "steam_1", "ach_a")).toBe(true);
  });

  it("conquistas diferentes somam", () => {
    awardHubAchievement("u1", "steam_1", "ACH_A", 3);
    awardHubAchievement("u1", "steam_1", "ACH_B", 1);
    const counts = getHubCounts("u1", "steam_1");
    expect(counts.bronze).toBe(1);
    expect(counts.gold).toBe(1);
  });
});
