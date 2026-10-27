import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TIER_STYLES } from "./achievementTier";

/**
 * Os tiers existem em dois lugares: TIER_STYLES (notch, TypeScript) e as variáveis
 * --tier-* (telas, CSS). Este teste impede que as cores se separem.
 */
describe("tokens de tier", () => {
  const css = readFileSync(new URL("../../index.css", import.meta.url), "utf8");

  it.each(Object.entries(TIER_STYLES))("--tier-%s tem o mesmo rgb do notch", (tier, style) => {
    const match = css.match(new RegExp(`--tier-${tier}:\\s*([0-9 ]+);`));
    expect(match, `--tier-${tier} ausente em index.css`).not.toBeNull();
    expect(match![1].trim()).toBe(style.rgb.split(",").join(" "));
  });
});
