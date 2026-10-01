import { describe, expect, it } from "vitest";
import { executablePathsEqual, normalizeExecutablePath } from "./processIdentity";

describe("processIdentity", () => {
  it("normalizes Windows paths for strict comparison", () => {
    expect(normalizeExecutablePath(String.raw`C:\Games\Foo\Game.exe`)).toBe("c:/games/foo/game.exe");
    expect(normalizeExecutablePath(String.raw`"C:\Games\Foo\Game.exe"`)).toBe("c:/games/foo/game.exe");
  });

  it("does not treat same-name executables in different folders as equal", () => {
    expect(
      executablePathsEqual(
        String.raw`C:\Games\Alpha\game.exe`,
        String.raw`D:\Library\Beta\game.exe`,
      ),
    ).toBe(false);
    expect(
      executablePathsEqual(
        String.raw`C:\Games\Alpha\game.exe`,
        String.raw`C:\Games\Alpha\game.exe`,
      ),
    ).toBe(true);
  });
});
