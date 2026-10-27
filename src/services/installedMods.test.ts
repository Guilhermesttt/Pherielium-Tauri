import { beforeEach, describe, expect, it } from "vitest";
import { installedModsStorageKey, readInstalledModsForGame } from "./installedMods";

const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    },
  });
});

describe("readInstalledModsForGame", () => {
  it("devolve os mods gravados para o jogo e só os dele", () => {
    store.set(
      installedModsStorageKey("u1"),
      JSON.stringify({
        g1: [
          { id: "cyberpunk2077:107", name: "CET", enabled: true, status: "installed", manifestPath: "m.json", pictureUrl: "" },
          { id: "cyberpunk2077:9", name: "Outro", enabled: false, status: "downloaded" },
        ],
        g2: [{ id: "x", name: "Não deste jogo", enabled: true }],
      }),
    );
    const mods = readInstalledModsForGame("u1", "g1");
    expect(mods.map((m) => m.name)).toEqual(["CET", "Outro"]);
    expect(mods[0]).toMatchObject({ enabled: true, status: "installed", manifestPath: "m.json", pictureUrl: undefined });
    expect(mods[1].enabled).toBe(false);
  });

  it("ignora dados ausentes, corrompidos ou malformados", () => {
    expect(readInstalledModsForGame("u1", "g1")).toEqual([]);
    store.set(installedModsStorageKey("u1"), "{nao é json");
    expect(readInstalledModsForGame("u1", "g1")).toEqual([]);
    store.set(installedModsStorageKey("u1"), JSON.stringify({ g1: [null, 3, { id: 1 }, { id: "a", name: "ok" }] }));
    expect(readInstalledModsForGame("u1", "g1").map((m) => m.id)).toEqual(["a"]);
  });
});
