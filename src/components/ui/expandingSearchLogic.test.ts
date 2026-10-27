import { describe, expect, it } from "vitest";
import { isSearchOpen } from "./expandingSearchLogic";

describe("isSearchOpen", () => {
  it("fechada por padrão e aberta quando a pessoa a abre", () => {
    expect(isSearchOpen(false, "")).toBe(false);
    expect(isSearchOpen(true, "")).toBe(true);
  });

  it("com texto digitado fica aberta, mesmo que tenha perdido o foco", () => {
    expect(isSearchOpen(false, "hades")).toBe(true);
  });
});
