import { describe, expect, it } from "vitest";
import { parseUnlockedAtSeconds } from "./unlockTime";

describe("parseUnlockedAtSeconds", () => {
  it("lê RFC 3339", () => {
    expect(parseUnlockedAtSeconds("2023-11-14T22:13:20Z")).toBe(1_700_000_000);
  });
  it("lê o formato legado <segundos>Z", () => {
    expect(parseUnlockedAtSeconds("1700000000Z")).toBe(1_700_000_000);
  });
  it("entrada vazia ou inválida vira 0", () => {
    expect(parseUnlockedAtSeconds("")).toBe(0);
    expect(parseUnlockedAtSeconds(undefined)).toBe(0);
    expect(parseUnlockedAtSeconds("ontem")).toBe(0);
  });
});
