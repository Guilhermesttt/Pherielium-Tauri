import { describe, expect, it } from "vitest";
import { DEFAULT_NOTCH_CONFIG, sanitizeNotchConfig, notchConfigsEqual } from "./notchConfig";
import {
  DEFAULT_NOTCH_SURFACE,
  baseStyleForTheme,
  chamferClipPath,
  notchBoxShadow,
  resolveNotchStyle,
  surfaceColor,
} from "./notchTheme";

describe("resolveNotchStyle", () => {
  it("o tema padrão reproduz exatamente o visual de antes (#000000, sem borda, raio 14)", () => {
    for (const theme of ["phelierium", "checkpoint", undefined, null, ""]) {
      const s = resolveNotchStyle(theme);
      expect(s.surface).toBe(DEFAULT_NOTCH_SURFACE);
      expect(s.surfaceOpacity).toBe(1);
      expect(s.borderColor).toBeNull();
      expect(s.glow).toBe(0);
      expect(s.cornerRadius).toBe(14);
      expect(s.chamfer).toBe(false);
      expect(s.isDefault).toBe(true);
    }
  });

  it("cyberpunk é a 'pílula tática': #0A0A0C a 88%, borda neon e cantos chanfrados", () => {
    const s = resolveNotchStyle("cyberpunk");
    expect(s.surface).toBe("#0a0a0c");
    expect(s.surfaceOpacity).toBeCloseTo(0.88, 5);
    expect(s.borderColor).toContain("252,238,10"); // #fcee0a
    expect(s.chamfer).toBe(true);
    expect(s.glow).toBeGreaterThan(0);
    expect(s.isDefault).toBe(false);
  });

  it("os demais temas ficam limpos como o padrão (sem borda nem brilho); só o acento muda", () => {
    for (const theme of ["ps5", "ps4", "playstation", "psp", "gamecube", "xbox360"]) {
      const s = resolveNotchStyle(theme);
      expect(s.borderColor, theme).toBeNull();
      expect(s.glow, theme).toBe(0);
      expect(s.surface, theme).toBe(DEFAULT_NOTCH_SURFACE);
      expect(s.chamfer, theme).toBe(false);
      expect(s.cornerRadius, theme).toBe(14);
      expect(s.accent, theme).not.toBe("#ffffff");
    }
    expect(resolveNotchStyle("tema-inexistente").isDefault).toBe(true);
  });

  it("ajustes do usuário vencem o tema e são limitados às faixas", () => {
    const s = resolveNotchStyle("cyberpunk", { cornerRadius: 40, backgroundOpacity: 0.1, glowIntensity: 5, chamfer: false });
    expect(s.cornerRadius).toBe(28);
    expect(s.surfaceOpacity).toBe(0.5);
    expect(s.glow).toBe(1);
    expect(s.chamfer).toBe(false);
  });

  it("null nos ajustes significa 'usar o do tema'", () => {
    const s = resolveNotchStyle("cyberpunk", { cornerRadius: null, glowIntensity: null, backgroundOpacity: null, chamfer: null });
    expect(s).toEqual(resolveNotchStyle("cyberpunk"));
  });

  it("useThemeStyle desligado volta ao padrão mesmo num tema colorido", () => {
    const s = resolveNotchStyle("cyberpunk", { useThemeStyle: false });
    expect(s.surface).toBe(DEFAULT_NOTCH_SURFACE);
    expect(s.chamfer).toBe(false);
    expect(s.isDefault).toBe(true);
  });

  it("brilho no tema padrão cria uma borda no acento e deixa de ser 'padrão'", () => {
    const s = resolveNotchStyle("phelierium", { glowIntensity: 0.8 });
    expect(s.borderColor).not.toBeNull();
    expect(s.glow).toBe(0.8);
    expect(s.isDefault).toBe(false);
  });
});

describe("helpers de estilo", () => {
  it("surfaceColor só usa rgba quando há transparência", () => {
    expect(surfaceColor(resolveNotchStyle("phelierium"))).toBe("#000000");
    expect(surfaceColor(resolveNotchStyle("cyberpunk"))).toMatch(/^rgba\(10,10,12,0\.88\)$/);
  });

  it("chamferClipPath corta os dois cantos de baixo", () => {
    expect(chamferClipPath(9)).toBe(
      "polygon(0 0, 100% 0, 100% calc(100% - 9px), calc(100% - 9px) 100%, 9px 100%, 0 calc(100% - 9px))",
    );
    expect(chamferClipPath(-3)).toContain("calc(100% - 0px)");
  });

  it("notchBoxShadow tem sempre 4 camadas (a mola interpola box-shadow por camada)", () => {
    for (const theme of ["phelierium", "cyberpunk", "ps5"]) {
      for (const expanded of [false, true]) {
        const shadow = notchBoxShadow(resolveNotchStyle(theme), expanded);
        // separa as camadas pelas vírgulas de nível 0 (fora de rgba(...))
        let depth = 0;
        let layers = 1;
        for (const ch of shadow) {
          if (ch === "(") depth++;
          else if (ch === ")") depth--;
          else if (ch === "," && depth === 0) layers++;
        }
        expect(layers).toBe(4);
      }
    }
  });

  it("baseStyleForTheme é estável (mesma referência para o padrão)", () => {
    expect(baseStyleForTheme("phelierium")).toBe(baseStyleForTheme("checkpoint"));
  });
});

describe("sanitizeNotchConfig — novos campos", () => {
  it("padrões novos não mudam o visual de quem já usava o notch", () => {
    const c = sanitizeNotchConfig({});
    expect(c.ears).toBe("cat");
    expect(c.items).toEqual([]);
    expect(c.useThemeStyle).toBe(true);
    expect(c.cornerRadius).toBeNull();
    expect(c.gameHud).toBe("line");
  });

  it("valida ids e remove itens inválidos/duplicados", () => {
    const c = sanitizeNotchConfig({ ears: "demon", items: ["halo", "halo", "capacete", "sunglasses", 7], gameHud: "compact", bubbleStyle: "retro" });
    expect(c.ears).toBe("demon");
    expect(c.items).toEqual(["halo", "sunglasses"]);
    expect(c.gameHud).toBe("compact");
    expect(c.bubbleStyle).toBe("retro");
    expect(sanitizeNotchConfig({ ears: "dragão", gameHud: "x", bubbleStyle: "y" })).toMatchObject({
      ears: "cat",
      gameHud: "line",
      bubbleStyle: "soft",
    });
    expect(sanitizeNotchConfig({ bubbleStyle: "soft" }).bubbleStyle).toBe("soft");
  });

  it("limita os sliders e aceita null (= usar o tema)", () => {
    const c = sanitizeNotchConfig({ cornerRadius: 99, backgroundOpacity: 0.1, glowIntensity: -1, chamfer: true });
    expect(c.cornerRadius).toBe(28);
    expect(c.backgroundOpacity).toBe(0.5);
    expect(c.glowIntensity).toBe(0);
    expect(c.chamfer).toBe(true);
    const n = sanitizeNotchConfig({ cornerRadius: null, backgroundOpacity: null, glowIntensity: null, chamfer: null });
    expect(n.cornerRadius).toBeNull();
    expect(n.chamfer).toBeNull();
    expect(sanitizeNotchConfig({ cornerRadius: "x", chamfer: "sim" }).cornerRadius).toBeNull();
  });

  it("notchConfigsEqual compara a lista de itens por conteúdo", () => {
    expect(notchConfigsEqual({ ...DEFAULT_NOTCH_CONFIG, items: ["halo"] }, { ...DEFAULT_NOTCH_CONFIG, items: ["halo"] })).toBe(true);
    expect(notchConfigsEqual({ ...DEFAULT_NOTCH_CONFIG, items: ["halo"] }, { ...DEFAULT_NOTCH_CONFIG, items: [] })).toBe(false);
  });
});
