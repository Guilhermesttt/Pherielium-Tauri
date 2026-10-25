import { describe, expect, it } from "vitest";
import { MIN_LAUNCH_SCREEN_MS } from "../../types/gameDetail";
import { LAUNCH_INTRO_TIMELINE } from "./GameLaunchIntro";
import { NOTCH_SOUNDS, resolveNotchSoundSrc } from "../notch/notchSounds";

describe("linha do tempo da intro de lançamento", () => {
  const t = LAUNCH_INTRO_TIMELINE;

  it("segue a ordem: fones descem → encaixe → hub dobra → launcher esconde", () => {
    expect(t.headphonesDrop).toBeLessThan(t.headphonesSnap);
    expect(t.headphonesSnap).toBeLessThan(t.fold);
    expect(t.fold).toBeLessThan(t.hideHub);
  });

  it("o jogo só abre depois do hub começar a dobrar e antes de o launcher esconder", () => {
    expect(t.launch).toBeGreaterThan(t.fold);
    expect(t.launch).toBeLessThanOrEqual(t.hideHub);
  });

  it("o launcher só esconde depois do mascote já estar voando (>= 500ms após o handoff)", () => {
    expect(t.hideHub - t.fold).toBeGreaterThanOrEqual(500);
  });

  it("tudo cabe na tela de lançamento mínima (o jogo continua abrindo por baixo)", () => {
    expect(t.hideHub).toBeLessThan(MIN_LAUNCH_SCREEN_MS);
  });

  it("os sons da intro existem em qualquer tema e são efeitos diferentes", () => {
    for (const theme of ["default", "ps5", "xbox360"]) {
      expect(resolveNotchSoundSrc("headphonesSnap", theme)).toBeTruthy();
      expect(resolveNotchSoundSrc("hubFold", theme)).toBeTruthy();
    }
    expect(NOTCH_SOUNDS.headphonesSnap.type).not.toBe(NOTCH_SOUNDS.hubFold.type);
  });
});
