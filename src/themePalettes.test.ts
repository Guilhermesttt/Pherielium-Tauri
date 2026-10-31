import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./index.css", import.meta.url), "utf8");

const block = (theme: string): string => {
  const start = css.indexOf(`html[data-launcher-theme="${theme}"] {`);
  return css.slice(start, css.indexOf("\n}", start));
};
const value = (theme: string, name: string): string => new RegExp(String.raw`\n\s+${name}: ([^;]+);`).exec(block(theme))![1].trim();

/** Primária, fundo, superfície, painel elevado, borda, texto e texto secundário de cada tema. */
const PALETTES = {
  playstation: ["38 59 143", "#03050D", "#080D1A", "#10172A", "#26304D", "#F2F4FF", "#8290B5"],
  ps5: ["244 244 246", "#0B0D12", "#131620", "#1C2230", "#303541", "#F8FAFC", "#9AA0B2"],
  ps4: ["22 133 255", "#040914", "#0A1326", "#101E3D", "#1D416B", "#FFFFFF", "#8CAFE0"],
  psp: ["203 213 225", "#0B0C0E", "#14161B", "#1D2027", "#363B46", "#F8FAFC", "#A0A5B5"],
  cyberpunk: ["255 238 0", "#050507", "#0E0F14", "#171822", "#30313D", "#FFFFFF", "#A5A8BD"],
  gamecube: ["139 92 246", "#090610", "#120E1E", "#1C1630", "#382A55", "#FFFFFF", "#B0A4CE"],
  xbox360: ["132 204 22", "#060B04", "#0D160A", "#152410", "#304526", "#FFFFFF", "#A7C49C"],
} as const;

describe("paletas dos temas do launcher", () => {
  for (const [theme, [accent, bg, surface, overlay, border, text, textSub]] of Object.entries(PALETTES)) {
    it(`${theme}: primária, superfícies, borda e textos seguem a paleta`, () => {
      expect(value(theme, "--launcher-accent")).toBe(accent);
      expect(value(theme, "--surface-base")).toBe(bg);
      expect(value(theme, "--surface-raised")).toBe(surface);
      expect(value(theme, "--surface-overlay")).toBe(overlay);
      expect(value(theme, "--color-ui-detail")).toBe(border);
      expect(value(theme, "--border-subtle")).toBe(border);
      expect(value(theme, "--color-text-main")).toBe(text);
      expect(value(theme, "--color-text-sub")).toBe(textSub);
    });

    it(`${theme}: o anel de foco usa uma versão clara da primária`, () => {
      expect(value(theme, "--launcher-accent-ring")).toMatch(/^\d+ \d+ \d+$/);
      expect(css).toMatch(/:focus-visible \{\s*outline: 2px solid rgba\(var\(--launcher-accent-ring/);
    });
  }

  it("o tema padrão é preto carvão com a primária laranja #E85002", () => {
    const root = css.slice(css.search(/:root,\s*html\[data-launcher-theme="phelierium"\]/), css.indexOf("/* Malha Base 4/8 */"));
    const v = (name: string) => new RegExp(String.raw`\n\s+${name}: ([^;]+);`).exec(root)![1].trim();
    expect(v("--launcher-accent")).toBe("232 80 2");
    expect(v("--launcher-accent-ring")).toBe("255 154 92"); // destaque suave #FF9A5C
    expect(v("--launcher-tint")).toBe("rgba(255, 106, 26, 0.12)"); // secundária #FF6A1A
    expect(v("--color-ui-detail")).toBe("#333333");
    expect(v("--color-text-main")).toBe("#F9F9F9");
    expect(v("--color-text-sub")).toBe("#A7A7A7");
    expect(root).toContain("--gray-0: #000000;");
    expect(root).toContain("--gray-1: #0A0A0A;");
    expect(root).toContain("--gray-2: #171717;");
  });

  it("todo tema tem o glow de seleção, derivado do realce claro do próprio tema", () => {
    // definido uma vez na raiz: cada tema só troca `--launcher-accent-ring`
    expect(css).toMatch(/--selection-glow: 0 0 14px 1px rgb\(var\(--launcher-accent-ring\) \/ 0\.32\)/);
    // abas, listas e navegação têm pílula própria e ficam de fora (ver tabsNeonWheel.test.ts)
    expect(css).toMatch(/:where\(\s*\[aria-current="true"\],\s*\[aria-pressed="true"\],[\s\S]*?\) \{\s*box-shadow: var\(--selection-glow\);/);
    for (const theme of Object.keys(PALETTES)) expect(block(theme)).toContain("--launcher-accent-ring");
  });

  it("o accent soft é a primária translúcida e o tint é a secundária", () => {
    expect(value("ps4", "--launcher-accent-soft")).toBe("rgba(22, 133, 255, 0.22)");
    expect(value("ps4", "--launcher-tint")).toBe("rgba(0, 112, 209, 0.16)");
  });
});
