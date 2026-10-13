import { describe, expect, it } from "vitest";
import { countScreenViewers, isWatchingRemoteScreen, viewersLabel } from "./screenViewers";

describe("isWatchingRemoteScreen", () => {
  it.each([
    [{ windowOpen: true, remoteSharing: true, focusedFeedId: "remote-screen" }, true],
    [{ windowOpen: true, remoteSharing: true, focusedFeedId: "remote-screen:abc" }, true],
    [{ windowOpen: false, remoteSharing: true, focusedFeedId: "remote-screen" }, false],
    [{ windowOpen: true, remoteSharing: false, focusedFeedId: "remote-screen" }, false],
    [{ windowOpen: true, remoteSharing: true, focusedFeedId: "local-screen" }, false],
    [{ windowOpen: true, remoteSharing: true, focusedFeedId: null }, false],
  ])("%j -> %s", (input, expected) => {
    expect(isWatchingRemoteScreen(input)).toBe(expected);
  });
});

describe("countScreenViewers", () => {
  const states = new Map([
    ["me", { isWatchingScreen: true }],
    ["ana", { isWatchingScreen: true }],
    ["bia", { isWatchingScreen: false }],
    ["gone", { isWatchingScreen: true }],
    ["noflag", {}],
  ]);

  it("counts watchers other than me who are still in the call", () => {
    expect(countScreenViewers(states, "me", new Set(["me", "ana", "bia", "noflag"]))).toBe(1);
  });

  it("without a known participant list it counts every watcher except me", () => {
    expect(countScreenViewers(states, "me", new Set())).toBe(2);
  });
});

describe("viewersLabel", () => {
  it("is empty without watchers and pluralises", () => {
    expect(viewersLabel(0)).toBe("");
    expect(viewersLabel(1)).toBe("1 pessoa assistindo");
    expect(viewersLabel(3)).toBe("3 pessoas assistindo");
  });
});
