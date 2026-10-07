import { describe, expect, it } from "vitest";
import {
  DEFAULT_PALETTE,
  deriveBodyPalette,
  luminance,
  normalizeHex,
  resolveBodyColor,
  withAlpha,
} from "./mascotColor";

describe("normalizeHex", () => {
  it("aceita #rgb, #rrggbb, sem # e com alfa", () => {
    expect(normalizeHex("#abc", null)).toBe("#aabbcc");
    expect(normalizeHex("3B82F6", null)).toBe("#3b82f6");
    expect(normalizeHex("#3B82F6CC", null)).toBe("#3b82f6");
    expect(normalizeHex("  #FFF ", null)).toBe("#ffffff");
  });

  it("rejeita lixo e devolve o fallback", () => {
    expect(normalizeHex("azul", "#000000")).toBe("#000000");
    expect(normalizeHex("#12", null)).toBeNull();
    expect(normalizeHex("#gggggg", null)).toBeNull();
    expect(normalizeHex(42, null)).toBeNull();
    expect(normalizeHex(undefined, "#111111")).toBe("#111111");
  });
});

describe("resolveBodyColor (migração do valor legado)", () => {
  it("branco legado e vazio significam 'sem cor escolhida'", () => {
    expect(resolveBodyColor("#FFFFFF")).toBeNull();
    expect(resolveBodyColor("#fff")).toBeNull();
    expect(resolveBodyColor(null)).toBeNull();
    expect(resolveBodyColor("")).toBeNull();
  });

  it("qualquer outra cor vira a cor do corpo", () => {
    expect(resolveBodyColor("#10B981")).toBe("#10b981");
    expect(resolveBodyColor("#F43F5E")).toBe("#f43f5e");
  });
});

describe("luminance", () => {
  it("preto = 0, branco = 1, e creme é bem mais claro que azul", () => {
    expect(luminance("#000000")).toBeCloseTo(0, 5);
    expect(luminance("#ffffff")).toBeCloseTo(1, 5);
    expect(luminance("#f1efe9")).toBeGreaterThan(luminance("#3b93f0"));
  });
});

describe("deriveBodyPalette", () => {
  it("sem cor mantém exatamente o visual original", () => {
    expect(deriveBodyPalette(null)).toBe(DEFAULT_PALETTE);
    expect(deriveBodyPalette("não é cor")).toBe(DEFAULT_PALETTE);
  });

  it("corpo escuro/colorido usa rosto branco e fone claro", () => {
    for (const c of ["#3b93f0", "#8b5cf6", "#e152b0", "#8b5e3c"]) {
      const p = deriveBodyPalette(c);
      expect(p.light, c).toBe(false);
      expect(p.face, c).toBe("#ffffff");
      expect(p.headphoneBand, c).toBe("#d9d9de");
    }
  });

  it("corpo claro usa rosto escuro, fone escuro e aro escuro", () => {
    for (const c of ["#f1efe9", "#ffffff", "#f0b429"]) {
      const p = deriveBodyPalette(c);
      expect(p.light, c).toBe(true);
      expect(p.face, c).toBe("#26262c");
      expect(p.headphoneBand, c).toBe("#2b2b31");
      expect(p.rim, c).not.toBe("rgba(255,255,255,0.16)");
    }
  });

  it("preto não some no notch: o topo e a base nunca ficam mais escuros que o piso", () => {
    const p = deriveBodyPalette("#000000");
    expect(luminance(p.top)).toBeGreaterThanOrEqual(luminance("#34343a") - 1e-9);
    expect(luminance(p.bottom)).toBeGreaterThanOrEqual(luminance("#16161a") - 1e-9);
    expect(luminance(p.ear)).toBeGreaterThanOrEqual(luminance("#1e1e22") - 1e-9);
    // e o notch (#050506) continua mais escuro que o mascote
    expect(luminance(p.top)).toBeGreaterThan(luminance("#050506"));
  });

  it("o gradiente vai do claro (topo) para o escuro (base)", () => {
    const p = deriveBodyPalette("#3b93f0");
    expect(luminance(p.top)).toBeGreaterThan(luminance(p.bottom));
  });

  it("corpos avermelhados atenuam as bochechas", () => {
    expect(deriveBodyPalette("#e8483f").cheekScale).toBeLessThan(1);
    expect(deriveBodyPalette("#3b93f0").cheekScale).toBe(1);
  });

  it("withAlpha monta rgba", () => {
    expect(withAlpha("#ff8000", 0.5)).toBe("rgba(255,128,0,0.5)");
  });
});
