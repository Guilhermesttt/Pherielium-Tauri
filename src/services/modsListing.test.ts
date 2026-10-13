import { describe, expect, it } from "vitest";
import {
  asSortOrder,
  asStatusFilter,
  distinctCategories,
  filterAndSortMods,
  type ModsListItem,
} from "./modsListing";

const item = (title: string, over: Partial<ModsListItem> = {}, category = "RPG"): ModsListItem => ({
  game: { title, category, launcherType: "steam" },
  gameModsCount: 0,
  activeModsCount: 0,
  hasFolder: false,
  ...over,
});

const items = [
  item("Skyrim", { gameModsCount: 5, activeModsCount: 3, hasFolder: true }),
  item("Doom", { gameModsCount: 2, activeModsCount: 0, hasFolder: true }, "FPS"),
  item("Cyberpunk", { gameModsCount: 0 }, "RPG"),
  item("Celeste", { gameModsCount: 1, activeModsCount: 1 }, "Plataforma"),
];
const base = { query: "", status: "ALL", category: "ALL", sort: "AZ" } as const;
const titles = (list: ModsListItem[]) => list.map((i) => i.game.title);

describe("filterAndSortMods", () => {
  it("sorts by title and reverse", () => {
    expect(titles(filterAndSortMods(items, base))).toEqual(["Celeste", "Cyberpunk", "Doom", "Skyrim"]);
    expect(titles(filterAndSortMods(items, { ...base, sort: "ZA" }))).toEqual(["Skyrim", "Doom", "Cyberpunk", "Celeste"]);
  });

  it("the category filter now filters (it used to do nothing)", () => {
    expect(titles(filterAndSortMods(items, { ...base, category: "RPG" }))).toEqual(["Cyberpunk", "Skyrim"]);
    expect(titles(filterAndSortMods(items, { ...base, category: "FPS" }))).toEqual(["Doom"]);
  });

  it.each([
    ["WITH_FOLDER", ["Doom", "Skyrim"]],
    ["NO_FOLDER", ["Celeste", "Cyberpunk"]],
    ["WITH_MODS", ["Celeste", "Doom", "Skyrim"]],
    ["WITH_ACTIVE_MODS", ["Celeste", "Skyrim"]],
    ["NO_MODS", ["Cyberpunk"]],
  ] as const)("status %s", (status, expected) => {
    expect(titles(filterAndSortMods(items, { ...base, status }))).toEqual(expected);
  });

  it("new sort orders break ties by title", () => {
    expect(titles(filterAndSortMods(items, { ...base, sort: "ACTIVE_MODS" }))).toEqual(["Skyrim", "Celeste", "Cyberpunk", "Doom"]);
    expect(titles(filterAndSortMods(items, { ...base, sort: "FOLDER_FIRST" }))).toEqual(["Doom", "Skyrim", "Celeste", "Cyberpunk"]);
    expect(titles(filterAndSortMods(items, { ...base, sort: "MODS" }))).toEqual(["Skyrim", "Doom", "Celeste", "Cyberpunk"]);
  });

  it("search matches title, category and launcher, and combines with the filters", () => {
    expect(titles(filterAndSortMods(items, { ...base, query: " rpg " }))).toEqual(["Cyberpunk", "Skyrim"]);
    expect(titles(filterAndSortMods(items, { ...base, query: "rpg", status: "WITH_MODS" }))).toEqual(["Skyrim"]);
  });

  it("does not mutate the input list", () => {
    const before = titles(items);
    filterAndSortMods(items, { ...base, sort: "ZA" });
    expect(titles(items)).toEqual(before);
  });
});

describe("helpers", () => {
  it("lists distinct categories alphabetically", () => {
    expect(distinctCategories(items)).toEqual(["FPS", "Plataforma", "RPG"]);
  });

  it("coerces stored values to valid ones", () => {
    expect(asStatusFilter("WITH_MODS")).toBe("WITH_MODS");
    expect(asStatusFilter("lixo")).toBe("ALL");
    expect(asSortOrder("FOLDER_FIRST")).toBe("FOLDER_FIRST");
    expect(asSortOrder(undefined)).toBe("AZ");
  });
});
