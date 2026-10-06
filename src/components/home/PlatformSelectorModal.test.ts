import { describe, expect, it } from "vitest";
import {
  PLATFORM_DEFINITIONS,
  countGamesForPlatform,
} from "./PlatformSelectorModal";
import type { Game } from "../../types/domain";

describe("PlatformSelectorModal logic", () => {
  const mockGames: Game[] = [
    { id: "1", title: "Portal 2", launcherType: "steam" } as Game,
    { id: "2", title: "Half-Life: Alyx", launcherType: "steam" } as Game,
    { id: "3", title: "Fortnite", launcherType: "epic" } as Game,
    { id: "4", title: "FIFA 23", launcherType: "ea" } as Game,
    { id: "5", title: "Assassin's Creed", launcherType: "ubisoft" } as Game,
    { id: "6", title: "Witcher 3", launcherType: "gog" } as Game,
    { id: "7", title: "Halo Infinite", launcherType: "xbox" } as Game,
    { id: "8", title: "Valorant", launcherType: "riot" } as Game,
    { id: "9", title: "Diablo IV", launcherType: "battlenet" } as Game,
    { id: "10", title: "GTA V", launcherType: "rockstar" } as Game,
    { id: "11", title: "Emulated ROM", launcherType: "local" } as Game,
    { id: "12", title: "Custom App" } as Game, // no launcherType -> local
  ];

  it("contains all expected platform definitions including ALL and LOCAL", () => {
    const ids = PLATFORM_DEFINITIONS.map((def) => def.id);
    expect(ids).toContain("ALL");
    expect(ids).toContain("STEAM");
    expect(ids).toContain("EPIC");
    expect(ids).toContain("EA");
    expect(ids).toContain("UBISOFT");
    expect(ids).toContain("GOG");
    expect(ids).toContain("XBOX");
    expect(ids).toContain("RIOT");
    expect(ids).toContain("BATTLENET");
    expect(ids).toContain("ROCKSTAR");
    expect(ids).toContain("LOCAL");
    expect(PLATFORM_DEFINITIONS.length).toBe(11);
  });

  it("counts all games for ALL platform", () => {
    expect(countGamesForPlatform("ALL", mockGames)).toBe(12);
  });

  it("correctly counts launcher-specific games", () => {
    expect(countGamesForPlatform("STEAM", mockGames)).toBe(2);
    expect(countGamesForPlatform("EPIC", mockGames)).toBe(1);
    expect(countGamesForPlatform("EA", mockGames)).toBe(1);
    expect(countGamesForPlatform("UBISOFT", mockGames)).toBe(1);
    expect(countGamesForPlatform("GOG", mockGames)).toBe(1);
    expect(countGamesForPlatform("XBOX", mockGames)).toBe(1);
    expect(countGamesForPlatform("RIOT", mockGames)).toBe(1);
    expect(countGamesForPlatform("BATTLENET", mockGames)).toBe(1);
    expect(countGamesForPlatform("ROCKSTAR", mockGames)).toBe(1);
  });

  it("counts local and undefined launcher games as LOCAL", () => {
    expect(countGamesForPlatform("LOCAL", mockGames)).toBe(2);
  });

  it("returns 0 for unknown platform", () => {
    expect(countGamesForPlatform("UNKNOWN", mockGames)).toBe(0);
  });
});
