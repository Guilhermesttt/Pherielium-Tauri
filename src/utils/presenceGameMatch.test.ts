import { describe, expect, it } from "vitest";
import type { Game } from "../types/domain";
import { resolveGameFromPresence } from "./presenceGameMatch";

const baseGame = (overrides: Partial<Game>): Game => ({
  id: "1",
  title: "Outlast",
  image: "",
  category: "HORROR",
  executablePath: "C:/Games/Outlast/OLGame.exe",
  launcherType: "local",
  ...overrides,
});

describe("resolveGameFromPresence", () => {
  it("prefers executable path over ambiguous titles", () => {
    const games = [
      baseGame({ id: "outlast", title: "Outlast", executablePath: "C:/Games/Outlast/OLGame.exe" }),
      baseGame({ id: "outlast2", title: "Outlast 2", executablePath: "C:/Games/Outlast2/OLGame2.exe" }),
    ];

    expect(
      resolveGameFromPresence(games, "Outlast", "C:/Games/Outlast2/OLGame2.exe")?.id,
    ).toBe("outlast2");
  });

  it("uses exact title match when path is unavailable", () => {
    const games = [
      baseGame({ id: "outlast", title: "Outlast" }),
      baseGame({ id: "outlast2", title: "Outlast 2" }),
    ];

    expect(resolveGameFromPresence(games, "Outlast", null)?.id).toBe("outlast");
    expect(resolveGameFromPresence(games, "Outlast 2", null)?.id).toBe("outlast2");
  });

  it("does not fuzzy-match partial titles", () => {
    const games = [
      baseGame({ id: "outlast", title: "Outlast" }),
      baseGame({ id: "outlast2", title: "Outlast 2" }),
    ];

    expect(resolveGameFromPresence(games, "Outlast 2", null)?.id).toBe("outlast2");
    expect(resolveGameFromPresence(games, "Out", null)).toBeNull();
  });
});
