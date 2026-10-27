import { describe, expect, it } from "vitest";
import { openCloseSound } from "./useOpenCloseSound";

const sounds = { open: "detailOpen", close: "back" } as const;

describe("openCloseSound", () => {
  it("não toca na primeira renderização, nem aberto nem fechado", () => {
    expect(openCloseSound(undefined, false, sounds)).toBeNull();
    expect(openCloseSound(undefined, true, sounds)).toBeNull();
  });

  it("toca o som de abrir ao abrir e o de fechar ao fechar", () => {
    expect(openCloseSound(false, true, sounds)).toBe("detailOpen");
    expect(openCloseSound(true, false, sounds)).toBe("back");
  });

  it("não toca quando nada mudou", () => {
    expect(openCloseSound(true, true, sounds)).toBeNull();
    expect(openCloseSound(false, false, sounds)).toBeNull();
  });
});
