import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const css = read("./index.css");
const wheel = read("./components/ui/wheel-carousel.tsx");
const trophies = read("./components/TrophiesPage.tsx");
const sha = (path: string) => createHash("sha256").update(readFileSync(new URL(path, import.meta.url))).digest("hex");

const themeBlock = (theme: string): string => {
  const start = css.indexOf(`html[data-launcher-theme="${theme}"] {`);
  return css.slice(start, css.indexOf("\n}", start));
};

describe("abas em laranja (cor do tema) que não encostam nas vizinhas", () => {
  it("a pílula deslizante usa o preenchimento do tema e o texto por cima tem contraste (--on-accent)", () => {
    expect(css).toMatch(/\.console-tab-pill \{[\s\S]*?background: var\(--accent-fill\);[\s\S]*?box-shadow: var\(--accent-fill-shadow\);/);
    expect(css).toMatch(/\.console-tab-item\[data-active="true"\] \{\s*color: var\(--on-accent\);/);
    expect(css).toMatch(/--tabs-pill-bg: var\(--accent-fill\);/);
  });

  it("a sombra da aba cai para baixo e é recolhida (spread negativo), sem alcançar as vizinhas", () => {
    const m = /--accent-fill-shadow: 0 (\d+)px (\d+)px (-\d+)px/.exec(css)!;
    expect(Number(m[3])).toBeLessThan(0);
    expect(Math.abs(Number(m[3]))).toBeGreaterThanOrEqual(Number(m[2]) / 2);
  });

  it("o glow genérico de seleção não se soma ao da pílula nas abas", () => {
    expect(css).not.toMatch(/:where\(\s*\[aria-selected="true"\]/);
  });

  it("todo tema define --on-accent", () => {
    for (const theme of ["playstation", "ps5", "ps4", "psp", "cyberpunk", "gamecube", "xbox360"]) {
      expect(themeBlock(theme), theme).toMatch(/--on-accent: #[0-9A-F]{6};/);
    }
    expect(css).toMatch(/--on-accent: #120600;/);
  });
});

describe("borda neon", () => {
  it("tem a versão estática, a animada (parada com reduzir movimento) e o chip de filtro", () => {
    expect(css).toMatch(/\.neon-border::before/);
    expect(css).toMatch(/@property --neon-angle/);
    expect(css).toMatch(/\.neon-border--animated::before \{[\s\S]*?conic-gradient/);
    expect(css).toMatch(/prefers-reduced-motion: reduce\) \{\s*\.neon-border--animated::before \{\s*animation: none;/);
    expect(css).toMatch(/\.neon-chip\[data-active="true"\]/);
  });

  it("a página de Troféus aplica a borda: patente, degrau atual, objetivo (animada) e abas", () => {
    expect(trophies).toMatch(/aria-label="Sua patente" className="neon-border/);
    expect(trophies).toContain('isCurrentTier ? "neon-border');
    expect(trophies).toMatch(/neon-border neon-border--animated/);
    expect(trophies).toContain("t-tabs--neon");
  });
});

describe("roda de plataformas: o scroll desliza em vez de saltar", () => {
  it("o passo de scroll define um alvo e a roda se aproxima dele a cada quadro", () => {
    expect(wheel).toContain("targetRef");
    expect(wheel).toMatch(/1 - Math\.exp\(-dt \* 15\)/);
    expect(wheel).toMatch(/targetRef\.current = Math\.round\(base\) \+ delta;/);
    // o salto antigo (commit imediato no activeIndex) saiu
    expect(wheel).not.toMatch(/commitRotationRef\.current\(rotationRef\.current \+ delta\)/);
  });

  it("a pílula e o tamanho acompanham a distância ao centro (sem ligar de uma vez)", () => {
    expect(wheel).toMatch(/const closeness = Math\.max\(0, 1 - Math\.abs\(offset\)\)/);
    expect(wheel).toContain("wheel-pill-bg");
  });
});

describe("ícone do desktop", () => {
  it("o ícone público (favicon e manifest) é o mesmo arquivo do app", () => {
    expect(sha("../public/Pherielium_Desktop_icon.png")).toBe(sha("./assets/Pherielium_Desktop_icon.png"));
  });
});

describe("selecionado em laranja, hover em cinza (menus, listas suspensas e navegação)", () => {
  const ghost = read("./components/ui/GhostSelect.tsx");
  const dropdown = read("./components/ui/dropdown-menu.tsx");
  const settings = read("./pages/SettingsPage.tsx");

  it("`.sel-pill`: selecionado usa o preenchimento do tema com a sombra curta; hover e foco usam um cinza neutro", () => {
    expect(css).toMatch(/\.sel-pill:is\(\[aria-selected="true"\][^)]*\) \{\s*background: var\(--accent-fill\);\s*color: var\(--on-accent\);\s*box-shadow: var\(--accent-fill-shadow\);/);
    expect(css).toMatch(/\.sel-pill:is\(:hover, \[data-highlighted\], :focus-visible\):not\([\s\S]*?\) \{\s*background: color-mix\(in srgb, var\(--ink\) 10%, var\(--tone-2\)\);/);
  });

  it("os componentes usam a pílula: ajustes, lista suspensa, menu Radix e os filtros de Troféus", () => {
    expect(ghost).toContain("sel-pill relative flex");
    expect(ghost).toContain("glideActive && !isSelected"); // o cinza do hover não cobre o item laranja
    expect(settings).toContain("sel-pill group flex h-11");
    expect(trophies.match(/sel-pill flex h-11/g)).toHaveLength(2);
    expect(dropdown.match(/"sel-pill /g)).toHaveLength(3);
  });

  it("a navegação ativa (barra lateral, paleta de comandos) e o foco do menu Opções usam o laranja", () => {
    expect(css.match(/--nav-active-bg: rgb\(var\(--launcher-accent\)\);/g)).toHaveLength(2);
    expect(css).toMatch(/\.console-options \[role="menuitem"\]:focus \{\s*background: var\(--accent-fill\);/);
    expect(css).toMatch(/\.console-options \[role="menuitem"\]:hover \{\s*background: color-mix/);
  });

  it("o glow genérico (quadrado e largo) saiu de itens com pílula própria", () => {
    const rule = /:where\(([\s\S]*?)\) \{\s*box-shadow: var\(--selection-glow\);/.exec(css)![1];
    expect(rule).not.toContain("aria-selected");
    expect(rule).not.toContain('aria-current="page"');
  });
});
