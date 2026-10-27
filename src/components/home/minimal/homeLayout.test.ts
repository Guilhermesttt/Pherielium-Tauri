import { describe, expect, it } from "vitest";
import { DEFAULT_HOME_LAYOUT, isHomeLayout, otherHomeLayout, parseHomeLayout } from "./homeLayout";

describe("layout da Home", () => {
  it("o padrão é o clássico (o minimalista é opcional, pela paleta)", () => {
    expect(DEFAULT_HOME_LAYOUT).toBe("classic");
    expect(parseHomeLayout(null)).toBe("classic");
    expect(parseHomeLayout(undefined)).toBe("classic");
  });

  it("lembra a escolha gravada", () => {
    expect(parseHomeLayout("classic")).toBe("classic");
    expect(parseHomeLayout("minimal")).toBe("minimal");
  });

  it("valor desconhecido ou corrompido cai no padrão", () => {
    expect(parseHomeLayout("grid")).toBe("classic");
    expect(parseHomeLayout("")).toBe("classic");
    expect(isHomeLayout(3)).toBe(false);
  });

  it("alternar leva ao outro layout", () => {
    expect(otherHomeLayout("minimal")).toBe("classic");
    expect(otherHomeLayout("classic")).toBe("minimal");
  });
});
