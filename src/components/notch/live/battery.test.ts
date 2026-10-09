import { describe, expect, it } from "vitest";
import { batteryTone, clampBattery } from "./battery";

describe("battery", () => {
  it("cor por nível", () => {
    expect(batteryTone(80).rgb).toBe("48,209,88");
    expect(batteryTone(25).rgb).toBe("255,159,10");
    expect(batteryTone(10)).toEqual({ rgb: "255,69,58", critical: true });
  });
  it("carregando é sempre verde", () => {
    expect(batteryTone(5, true)).toEqual({ rgb: "48,209,88", critical: false });
  });
  it("limita 0..100", () => {
    expect(clampBattery(140)).toBe(100);
    expect(clampBattery(-5)).toBe(0);
    expect(clampBattery(49.6)).toBe(50);
  });
});
