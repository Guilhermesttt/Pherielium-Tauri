import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { dropdownMotion, modalBackdropMotion, modalMotion } from "./motion";

const css = readFileSync(new URL("../index.css", import.meta.url), "utf8");
/** Valor de uma variável CSS declarada no primeiro `--nome: valor;` do index.css. */
const token = (name: string): string => {
  const match = css.match(new RegExp(`${name}:\s*([^;]+);`));
  if (!match) throw new Error(`token ${name} não encontrado em index.css`);
  return match[1].trim();
};

describe("presets de movimento x tokens do CSS", () => {
  it("o modal abre em --duration-fast (250ms) e fecha em --duration-quick (150ms)", () => {
    expect(token("--duration-fast")).toBe("250ms");
    expect(token("--duration-quick")).toBe("150ms");
    expect(modalMotion.animate.transition.duration).toBe(0.25);
    expect(modalMotion.exit.transition.duration).toBe(0.15);
    expect(modalBackdropMotion.animate.transition.duration).toBe(0.25);
    expect(modalBackdropMotion.exit.transition.duration).toBe(0.15);
  });

  it("escalas: modal 0.96, dropdown abre em 0.97 e fecha em 0.99", () => {
    expect(token("--scale-large")).toBe("0.96");
    expect(token("--scale-medium")).toBe("0.97");
    expect(token("--scale-tiny")).toBe("0.99");
    expect(modalMotion.initial.scale).toBe(0.96);
    expect(dropdownMotion.initial.scale).toBe(0.97);
    expect(dropdownMotion.exit.scale).toBe(0.99);
  });

  it("os blocos .t-modal e .t-dropdown leem os tokens (nada de duração solta)", () => {
    expect(token("--modal-open-dur")).toBe("var(--duration-fast)");
    expect(token("--modal-close-dur")).toBe("var(--duration-quick)");
    expect(token("--dropdown-open-dur")).toBe("var(--duration-fast)");
    expect(token("--dropdown-close-dur")).toBe("var(--duration-quick)");
  });
});
