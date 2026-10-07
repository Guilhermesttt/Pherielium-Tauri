import { describe, expect, it } from "vitest";
import { NOTCH_SOUNDS, resolveNotchVolume, shouldPlayNotchSound, type NotchSoundId } from "./notchSounds";

const IDS = Object.keys(NOTCH_SOUNDS) as NotchSoundId[];

describe("sons do notch", () => {
  it("cada interação tem um som próprio (nenhum arquivo repetido)", () => {
    const sources = IDS.map((id) => NOTCH_SOUNDS[id].src);
    expect(new Set(sources).size).toBe(IDS.length);
  });

  it("nenhum som de mutar/desligar: esses tocam no hook de voz e dobrariam", () => {
    expect(IDS).not.toContain("mute" as NotchSoundId);
    expect(IDS).not.toContain("deafen" as NotchSoundId);
    expect(IDS).not.toContain("hangup" as NotchSoundId);
  });

  it("volume = volume dos efeitos × ganho, sempre entre 0 e 1", () => {
    for (const id of IDS) {
      expect(resolveNotchVolume(1, id)).toBeLessThanOrEqual(1);
      expect(resolveNotchVolume(0, id)).toBe(0);
      expect(resolveNotchVolume(0.5, id)).toBeCloseTo(0.5 * NOTCH_SOUNDS[id].gain, 6);
    }
  });

  it("volume inválido cai num padrão baixo em vez de NaN ou estourar", () => {
    expect(resolveNotchVolume(undefined, "expand")).toBeCloseTo(0.3 * NOTCH_SOUNDS.expand.gain, 6);
    expect(resolveNotchVolume(Number.NaN, "expand")).toBeCloseTo(0.3 * NOTCH_SOUNDS.expand.gain, 6);
    expect(resolveNotchVolume(50, "expand")).toBeLessThanOrEqual(1);
    expect(resolveNotchVolume(-2, "expand")).toBe(0);
  });

  it("antirrepique respeita o intervalo mínimo de cada som", () => {
    expect(shouldPlayNotchSound("expand", 1000, undefined)).toBe(true);
    expect(shouldPlayNotchSound("expand", 1100, 1000)).toBe(false);
    expect(shouldPlayNotchSound("expand", 1000 + NOTCH_SOUNDS.expand.minIntervalMs, 1000)).toBe(true);
    // cutucar o mascote aceita cliques rápidos (intervalo curto)
    expect(shouldPlayNotchSound("mascotPoke", 1090, 1000)).toBe(true);
  });
});
