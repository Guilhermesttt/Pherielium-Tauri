import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const button = read("./button.tsx");
const glass = read("./GlassButton.tsx");
const css = read("../../index.css");

/** Bloco CSS de um seletor (do `{` ao primeiro `}` seguinte). */
const block = (selector: string) => {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`${selector} não encontrado`);
  return css.slice(start, css.indexOf("}", start));
};

describe("movimento dos botões (Apple): resposta no toque, sem `transition: all`", () => {
  it("nenhum componente de botão anima `all`", () => {
    expect(button).not.toMatch(/transition-all/);
    expect(glass).not.toMatch(/transition-all/);
    for (const selector of [".btn-play", ".ctl-circle"]) expect(block(selector)).not.toMatch(/transition:\s*all/);
  });

  it("os dois botões do app usam a mesma curva, o mesmo aperto (0.97) e apertam mais rápido do que soltam", () => {
    for (const source of [button, glass]) {
      expect(source).toContain("ease-[var(--ease-out-strong)]");
      expect(source).toContain("active:scale-[0.97]");
      expect(source).toContain("active:duration-75");
      expect(source).toContain("duration-[180ms]");
      expect(source).toContain("motion-reduce:active:scale-100");
    }
    expect(glass).not.toContain("active:scale-[0.98]");
    expect(button).not.toContain("--ease-mech");
  });

  it("o botão Jogar aperta em 80 ms e os controles do topo em 70 ms, ambos a 0.97", () => {
    expect(block(".btn-play:active:not(:disabled)")).toMatch(/scale\(0\.97\)[\s\S]*80ms/);
    expect(block(".ctl-circle:active")).toMatch(/scale\(0\.97\)[\s\S]*70ms/);
  });

  it("só o botão principal cresce no hover; os controles do topo não, e o hover é restrito a ponteiro fino", () => {
    expect(block(".ctl-circle:hover")).not.toMatch(/transform/);
    expect(css).toMatch(/@media \(hover: hover\) and \(pointer: fine\) \{\s*\.btn-play:hover:not\(:disabled\)/);
  });
});
