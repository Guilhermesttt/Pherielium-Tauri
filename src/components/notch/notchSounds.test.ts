import { describe, expect, it } from "vitest";
import { NOTCH_SOUNDS, resolveNotchSoundSrc, resolveNotchVolume, shouldPlayNotchSound, type NotchSoundId } from "./notchSounds";
import { soundThemes } from "../../hooks/useSoundEffects";

const IDS = Object.keys(NOTCH_SOUNDS) as NotchSoundId[];

describe("sons do notch", () => {
  it("cada interação usa um efeito diferente do tema (nenhum repetido)", () => {
    const types = IDS.map((id) => NOTCH_SOUNDS[id].type);
    expect(new Set(types).size).toBe(IDS.length);
  });

  it("o som vem do tema sonoro escolhido, não de um pacote fixo", () => {
    expect(resolveNotchSoundSrc("expand", "xbox360")).toBe(soundThemes.xbox360.detailOpen);
    expect(resolveNotchSoundSrc("expand", "ps5")).toBe(soundThemes.ps5.detailOpen);
    expect(resolveNotchSoundSrc("expand", "xbox360")).not.toBe(resolveNotchSoundSrc("expand", "ps5"));
  });

  it("todo som do notch existe em todos os temas (ou cai no padrão)", () => {
    for (const theme of Object.keys(soundThemes)) {
      for (const id of IDS) {
        // o "reveal" é um som de hover, e o tema padrão não tem hover (fica em silêncio de propósito)
        if (theme === "default" && id === "reveal") continue;
        expect(resolveNotchSoundSrc(id, theme), `${theme}.${id}`).toBeTruthy();
      }
    }
  });

  it("o reveal do notch fica em silêncio no tema padrão, que não tem som de hover", () => {
    expect(resolveNotchSoundSrc("reveal", "default")).toBe("");
  });

  it("tema desconhecido ou ausente usa o padrão; nomes antigos são traduzidos", () => {
    expect(resolveNotchSoundSrc("panelOpen", undefined)).toBe(soundThemes.default.showModal);
    expect(resolveNotchSoundSrc("panelOpen", "nao-existe")).toBe(soundThemes.default.showModal);
    expect(resolveNotchSoundSrc("panelOpen", "playstation")).toBe(soundThemes.ps2.showModal);
    expect(resolveNotchSoundSrc("panelOpen", "phelierium")).toBe(soundThemes.default.showModal);
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
