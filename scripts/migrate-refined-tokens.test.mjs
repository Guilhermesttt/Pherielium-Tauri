import { describe, expect, it } from "vitest";
import { migrate } from "./migrate-refined-tokens.mjs";

describe("migrate (tokens do Pherielium Refined)", () => {
  it("troca a opacidade do texto branco pela tinta", () => {
    expect(migrate('className="text-white/90 hover:text-white/60 text-white/[0.35]"')).toBe(
      'className="text-[var(--ink)] hover:text-[var(--ink-muted)] text-[var(--ink-faint)]"',
    );
  });

  it("leva tamanhos pequenos ao piso de 13px e mantém contadores de 9px", () => {
    expect(migrate("text-[10px] text-[14px] text-[18px] text-[9px]")).toBe(
      "text-[length:var(--step-0)] text-[length:var(--step-1)] text-[length:var(--step-2)] text-[9px]",
    );
  });

  it("troca cinzas de fundo por tons e mantém cores e a opacidade", () => {
    expect(migrate("bg-[#0A0A0A]/90 bg-[#1C1C1E] bg-[#3B82F6] bg-[#FFFFFF]")).toBe(
      "bg-[var(--tone-1)]/90 bg-[var(--tone-2)] bg-[#3B82F6] bg-[#FFFFFF]",
    );
  });

  it("não toca em outras classes nem em texto comum", () => {
    const src = 'const label = "text-white/90"; <p className="border-white/10">texto</p>';
    expect(migrate(src)).toBe('const label = "text-[var(--ink)]"; <p className="border-white/10">texto</p>');
    expect(migrate("divtext-white/50")).toBe("divtext-white/50");
  });

  it("reduz os raios escritos à mão aos três cantos do sistema", () => {
    expect(migrate("rounded-[22px] rounded-t-[32px] rounded-[14px] rounded-[6px]")).toBe(
      "rounded-[var(--corner-md)] rounded-t-[var(--corner-lg)] rounded-[var(--corner-sm)] rounded-[6px]",
    );
  });

  it("é idempotente", () => {
    const once = migrate("text-white/40 text-[11px] bg-[#111111]");
    expect(migrate(once)).toBe(once);
  });
});
