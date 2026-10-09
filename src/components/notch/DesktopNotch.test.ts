import { describe, expect, it } from "vitest";
import {
  formatSeconds,
  prettySourceApp,
  resolveMascotMood,
  resolveNotchCompactWidth,
  shouldAutoHide,
} from "./DesktopNotch";

describe("DesktopNotch & PherieMascot Logic", () => {
  const base = { isCallActive: false, isMuted: false, activeGameTitle: null, isMusicPlaying: false, viewState: "compact" as const };

  it("resolves calling mood when call is active and unmuted", () => {
    expect(resolveMascotMood({ ...base, isCallActive: true })).toBe("calling");
  });

  it("resolves muted mood when call is active and muted", () => {
    expect(resolveMascotMood({ ...base, isCallActive: true, isMuted: true, isMusicPlaying: true })).toBe("muted");
  });

  it("prioritizes gaming mood when game is running without a call", () => {
    expect(resolveMascotMood({ ...base, activeGameTitle: "Counter-Strike 2", isMusicPlaying: true })).toBe("gaming");
  });

  it("resolves music mood when music is playing with no game or call", () => {
    expect(resolveMascotMood({ ...base, isMusicPlaying: true })).toBe("music");
  });

  it("resolves sleeping mood in peek state and idle otherwise", () => {
    expect(resolveMascotMood({ ...base, viewState: "peek" })).toBe("sleeping");
    expect(resolveMascotMood(base)).toBe("idle");
  });

  it("formats seconds to MM:SS string correctly", () => {
    expect(formatSeconds(0)).toBe("00:00");
    expect(formatSeconds(65)).toBe("01:05");
    expect(formatSeconds(3600)).toBe("60:00");
  });

  it("sizes the compact bar by what is happening (call > game > media > idle)", () => {
    const w = (isCallActive: boolean, activeGameTitle: string | null, isPcMediaPlaying: boolean) =>
      resolveNotchCompactWidth({ isCallActive, activeGameTitle, isPcMediaPlaying });
    expect(w(false, null, false)).toBe(216);
    expect(w(false, null, true)).toBe(256);
    expect(w(false, "Hades II", true)).toBe(284);
    expect(w(true, "Hades II", true)).toBe(368);
  });

  it("auto-hides when another app overlaps unless a call pins the notch", () => {
    const hide = (o: Partial<Parameters<typeof shouldAutoHide>[0]>) =>
      shouldAutoHide({ isWindowOverlapping: true, isCallActive: false, isGameRunning: false, disabled: false, ...o });
    expect(hide({})).toBe(true);
    expect(hide({ isWindowOverlapping: false })).toBe(false);
    expect(hide({ isCallActive: true })).toBe(false);
    expect(hide({ isGameRunning: true })).toBe(true); // jogo não fixa mais o notch: segue o auto-hide
    expect(hide({ disabled: true })).toBe(false);
  });

  it("turns raw GSMTC app ids into readable names", () => {
    expect(prettySourceApp("Spotify.exe")).toBe("Spotify");
    expect(prettySourceApp("chrome.exe")).toBe("Chrome");
    expect(prettySourceApp("Microsoft.ZuneMusic_8wekyb3d8bbwe!Microsoft.ZuneMusic")).toBe("ZuneMusic");
    expect(prettySourceApp(null)).toBe("");
  });
});
