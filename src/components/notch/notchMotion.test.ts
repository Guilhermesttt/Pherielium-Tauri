import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const notch = read("./DesktopNotch.tsx");
const css = read("../../index.css");

describe("movimento da notch (Apple): transform/opacity, sem `transition-all`", () => {
  it("nenhum botão da notch anima `all`", () => {
    expect(notch).not.toMatch(/transition-all/);
  });

  it("a pílula da aba ativa desliza por transform, com o mesmo passo do botão (w-11 + gap-1 = 48px)", () => {
    expect(notch).toContain("TAB_STEP_PX = 48");
    expect(css).toMatch(/\.notch-tab-pill\s*\{\s*transition:\s*transform 260ms/);
  });

  it("os cards sobem em sequência de 40 ms e o movimento reduzido desliga a animação", () => {
    expect(css).toMatch(/@keyframes notch-rise/);
    expect(css).toMatch(/:nth-child\(2\)[\s\S]*?animation-delay:\s*40ms/);
    expect(css).toMatch(/prefers-reduced-motion: reduce\) \{\s*\.notch-tab-pill/);
  });
});
