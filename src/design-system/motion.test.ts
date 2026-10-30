import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { APPLE_EASE, STAGGER_MS, appleSpring, appleSprings, dropdownMotion, materialize, modalBackdropMotion, modalMotion } from "./motion";

const css = readFileSync(new URL("../index.css", import.meta.url), "utf8");
/** Valor de uma variável CSS declarada no primeiro `--nome: valor;` do index.css. */
const token = (name: string): string => {
  const match = css.match(new RegExp(`${name}:\s*([^;]+);`));
  if (!match) throw new Error(`token ${name} não encontrado em index.css`);
  return match[1].trim();
};

describe("presets de movimento x tokens do CSS", () => {
  it("o modal abre em 220ms e fecha em 140ms no ritmo Apple Motion", () => {
    expect(token("--modal-open-dur")).toBe("220ms");
    expect(token("--modal-close-dur")).toBe("140ms");
    expect(modalMotion.animate.transition.duration).toBe(0.22);
    expect(modalMotion.exit.transition.duration).toBe(0.14);
    expect(modalBackdropMotion.animate.transition.duration).toBe(0.22);
    expect(modalBackdropMotion.exit.transition.duration).toBe(0.14);
  });

  it("escalas: modal 0.96, dropdown abre em 0.97 e fecha em 0.99", () => {
    expect(token("--scale-large")).toBe("0.96");
    expect(token("--scale-medium")).toBe("0.97");
    expect(token("--scale-tiny")).toBe("0.99");
    expect(modalMotion.initial.scale).toBe(0.96);
    expect(dropdownMotion.initial.scale).toBe(0.97);
    expect(dropdownMotion.exit.scale).toBe(0.99);
  });

  it("os blocos .t-modal e .t-dropdown leem os tokens de timing", () => {
    expect(token("--modal-open-dur")).toBe("220ms");
    expect(token("--modal-close-dur")).toBe("140ms");
    expect(token("--dropdown-open-dur")).toBe("var(--duration-fast)");
    expect(token("--dropdown-close-dur")).toBe("var(--duration-quick)");
  });
});

describe("molas ao estilo Apple", () => {
  it("amortecimento vira bounce (1 − amortecimento) e a resposta vira a duração", () => {
    expect(appleSpring(1, 0.4)).toEqual({ type: "spring", bounce: 0, duration: 0.4 });
    expect(appleSpring(0.8, 0.3)).toEqual({ type: "spring", bounce: 0.2, duration: 0.3 });
    // fora da faixa não vira bounce negativo nem acima de 1
    expect(appleSpring(1.5, 0.3).bounce).toBe(0);
    expect(appleSpring(-1, 0.3).bounce).toBe(1);
  });

  it("segue a tabela da Apple: mover 1.0/0.4, gaveta 0.8/0.3; o resto da UI assenta sem sobra", () => {
    expect(appleSprings.move).toMatchObject({ bounce: 0, duration: 0.4 });
    expect(appleSprings.sheet).toMatchObject({ bounce: 0.2, duration: 0.3 });
    expect(appleSprings.snap.bounce).toBe(0);
    // só a comemoração rara tem sobra visível, e ainda assim moderada
    expect(appleSprings.delight.bounce).toBeGreaterThan(appleSprings.sheet.bounce);
    expect(appleSprings.delight.bounce).toBeLessThanOrEqual(0.3);
  });

  it("as curvas em TS são as mesmas dos tokens CSS", () => {
    const strong = token("--ease-out-strong").match(/cubic-bezier\(([^)]+)\)/)![1].split(",").map(Number);
    const drawer = token("--ease-drawer").match(/cubic-bezier\(([^)]+)\)/)![1].split(",").map(Number);
    expect(strong).toEqual([...APPLE_EASE.outStrong]);
    expect(drawer).toEqual([...APPLE_EASE.drawer]);
  });

  it("materializar nunca parte de escala zero e mantém o desfoque abaixo de 20px", () => {
    expect(materialize.initial.scale).toBeGreaterThanOrEqual(0.9);
    for (const frame of [materialize.initial, materialize.exit]) {
      const radius = Number(/blur\((\d+)px\)/.exec(frame.filter)![1]);
      expect(radius).toBeLessThan(20);
    }
    expect(STAGGER_MS).toBeGreaterThanOrEqual(30);
    expect(STAGGER_MS).toBeLessThanOrEqual(80);
  });
});
