import { describe, expect, it } from "vitest";
import {
  canConfirmSession,
  isPendingLaunchRecent,
  isValidSessionPid,
  shouldAllowBackgroundSessionConfirm,
} from "./sessionPolicy";

describe("sessionPolicy", () => {
  it("validates session pid", () => {
    expect(isValidSessionPid(1234)).toBe(true);
    expect(isValidSessionPid(0)).toBe(false);
    expect(isValidSessionPid(null)).toBe(false);
  });

  it("requires pid for session confirmation", () => {
    expect(canConfirmSession({
      confirmed: true,
      executablePath: "C:/Games/Foo/game.exe",
      pid: 42,
    })).toBe(true);
    expect(canConfirmSession({
      confirmed: true,
      executablePath: "C:/Games/Foo/game.exe",
      pid: 0,
    })).toBe(false);
  });

  it("allows background confirm only with recent pending launch", () => {
    const now = Date.now();
    expect(shouldAllowBackgroundSessionConfirm({
      pendingLaunchedAt: now - 30_000,
      hasActiveSession: false,
      pid: 99,
    })).toBe(true);
    expect(shouldAllowBackgroundSessionConfirm({
      pendingLaunchedAt: now - 4 * 60_000,
      hasActiveSession: false,
      pid: 99,
    })).toBe(false);
    expect(shouldAllowBackgroundSessionConfirm({
      pendingLaunchedAt: null,
      hasActiveSession: true,
      pid: 99,
    })).toBe(true);
  });

  it("detects recent pending launch window", () => {
    const now = Date.now();
    expect(isPendingLaunchRecent(now - 60_000)).toBe(true);
    expect(isPendingLaunchRecent(now - 5 * 60_000)).toBe(false);
  });
});
