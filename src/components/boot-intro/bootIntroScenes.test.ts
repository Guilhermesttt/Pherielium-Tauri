import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SCENE_TIMING } from "./bootIntroScenes";

const css = readFileSync(new URL("../../index.css", import.meta.url), "utf8");
const component = readFileSync(new URL("../GameBootIntro.tsx", import.meta.url), "utf8");

describe("coreografia da intro de abertura", () => {
  it("toca os sons nos marcos da cena", () => {
    expect(SCENE_TIMING.cues.map((c) => [c.at, c.sound])).toEqual([
      [0, "lead"],
      [2.3, "swooshAir1"],
      [4.95, "swooshAir2"],
      [5.6, "swooshSoft"],
    ]);
  });

  it("as fases seguem a ordem: placa, onda, faixa de luz, antecipação, disparo, nome e saída do nome", () => {
    expect(SCENE_TIMING.stages.map((s) => [s.at, s.stage])).toEqual([
      [2.0, "plate"],
      [2.2, "shock"],
      [3.0, "shine"],
      [4.6, "anticipate"],
      [4.75, "launch"],
      [5.38, "name"],
      [10.2, "nameOut"],
    ]);
    const times = SCENE_TIMING.stages.map((s) => s.at);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it("o nome sai antes de a intro terminar e fica parado por mais tempo que antes (>4 s)", () => {
    const last = SCENE_TIMING.stages[SCENE_TIMING.stages.length - 1];
    expect(last.at).toBeLessThan(SCENE_TIMING.endAt);
    const nameIn = SCENE_TIMING.stages.find((s) => s.stage === "name")!.at;
    expect(last.at - nameIn).toBeGreaterThan(4);
    expect(SCENE_TIMING.endAt).toBeGreaterThan(10.8); // a intro anterior terminava em 10,8 s
  });
});

describe("GameBootIntro com react-spring", () => {
  it("o surgimento do logo tem brilho, desfoque, faíscas, segunda onda e faixa de luz", () => {
    expect(component).toContain("bloomApi");
    expect(component).toContain("blur: 14");
    expect(component).toContain("SPARKS");
    expect(component).toContain("shock2Api");
    expect(component).toContain("shineApi");
    // a mola do logo é subamortecida (overshoot)
    const m = /LOGO_SPRING = \{ tension: (\d+), friction: (\d+), mass: ([\d.]+) \}/.exec(component)!;
    const ratio = Number(m[2]) / (2 * Math.sqrt(Number(m[1]) * Number(m[3])));
    expect(ratio).toBeLessThan(0.9);
  });

  it("usa as molas da especificação", () => {
    expect(component).toContain("LOGO_SPRING");
    expect(component).toContain("ZOOM_SPRING");
    expect(component).toContain("LETTER_SPRING");
    expect(component).toContain("useTrail(BRAND.length");
    expect(component).toMatch(/scale: 0\.94/);
    expect(component).toMatch(/ZOOM_FACTOR = 25/);
  });

  it("o logo aparece sem placa e a tipografia tem tracking amplo", () => {
    expect(component).not.toContain("rounded-[48px]");
    expect(component).not.toContain("bg-[var(--gray-2)]");
    expect(component).toContain("tracking-[0.14em]");
  });

  it("o hiper-zoom é lento: mola leve e pesada, bem mais mole que a antecipação", () => {
    const tension = (name: string) => Number(new RegExp(`${name} = \\{ tension: (\\d+)`).exec(component)?.[1]);
    expect(tension("ZOOM_SPRING")).toBeLessThan(60);
    expect(tension("ZOOM_SPRING")).toBeLessThan(tension("ANTICIPATE_SPRING"));
  });

  it("o logo some durante o zoom (opacidade atrelada ao progresso) e termina invisível", () => {
    expect(component).toContain("zoomFade");
    expect(component).toMatch(/o \* zoomFade\(p\)/);
  });

  it("não depende mais do Lottie", () => {
    expect(component).not.toContain("lottie");
  });
});

describe("CSS da intro", () => {
  const block = css.slice(css.indexOf("/* ── Intro de abertura"));

  it("o fundo é radial e usa o laranja do tema no lugar do cinza", () => {
    expect(block).toMatch(/\.boot-intro \{[\s\S]*?radial-gradient\(circle at 50% 46%, rgb\(var\(--launcher-accent\) \/ 0\.2\)[\s\S]*?var\(--gray-0\)/);
    expect(block).toMatch(/\.boot-glow::before \{[\s\S]*?rgb\(var\(--launcher-accent\) \/ 0\.22\)/);
  });

  it("o vídeo de pontos de luz acende na explosão (4,6 s → 5,4 s) e só anima opacity", () => {
    const end = SCENE_TIMING.endAt;
    expect(2.0 / end).toBeCloseTo(0.159, 2);
    expect(3.6 / end).toBeCloseTo(0.286, 2);
    expect(4.6 / end).toBeCloseTo(0.365, 2);
    expect(5.4 / end).toBeCloseTo(0.429, 2);
    expect(block).toContain("boot-backdrop 12.6s");
    expect(block).toMatch(/0%, 15\.9% \{ opacity: 0; \}/);
    expect(block).toMatch(/28\.6%, 36\.5% \{ opacity: 0\.4; \}/);
    expect(block).toMatch(/42\.9% \{ opacity: 0\.7; \}/);
    expect(block).not.toMatch(/transition:\s*all/);
  });

  it("o degradê se move desde o início (focos que giram e respiram) e só anima transform/opacity", () => {
    expect(block).toMatch(/\.boot-glow::before[^}]*animation: boot-glow-orbit/);
    expect(block).toMatch(/@keyframes boot-glow-orbit \{\s*to \{ transform: rotate\(360deg\); \}/);
    expect(component).toContain("boot-glow");
  });

  it("a saída faz fade com zoom de 1,02 para 1,00", () => {
    expect(block).toMatch(/\.boot-stage \{[^}]*scale\(1\.02\)/);
    expect(block).toMatch(/data-exiting="true"\] \.boot-stage \{[^}]*scale\(1\)/);
  });
});
