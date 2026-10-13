import { describe, expect, it, vi } from "vitest";
import { applyUiStyle, readUiStyle, resolveUiStyle } from "./uiStyle";

describe("resolveUiStyle", () => {
  it.each([
    [undefined, "refined"],
    [null, "refined"],
    ["", "refined"],
    ["refined", "refined"],
    ["lixo", "refined"],
    ["classic", "classic"],
    [" Classic ", "classic"],
  ])("%s -> %s", (raw, expected) => {
    expect(resolveUiStyle(raw as string | null | undefined)).toBe(expected);
  });
});

describe("readUiStyle / applyUiStyle", () => {
  it("reads the stored choice and falls back safely when storage throws", () => {
    expect(readUiStyle({ getItem: () => "classic" })).toBe("classic");
    expect(readUiStyle({ getItem: () => null })).toBe("refined");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(
      readUiStyle({
        getItem: () => {
          throw new Error("blocked");
        },
      }),
    ).toBe("refined");
    warn.mockRestore();
  });

  it("sets the attribute the CSS keys on", () => {
    const setAttribute = vi.fn();
    applyUiStyle({ setAttribute }, "refined");
    expect(setAttribute).toHaveBeenCalledWith("data-ui-style", "refined");
  });
});
