import { describe, expect, it } from "vitest";
import { resolveBootIntro, SOUND_FOLDER_BY_THEME } from "./bootIntroTheme";
import type { SoundTheme } from "../../context/PreferencesContext";

const themes = Object.keys(SOUND_FOLDER_BY_THEME) as SoundTheme[];

describe("resolveBootIntro", () => {
  it("o tema do Xbox tem cena própria e todos os outros usam a padrão", () => {
    expect(resolveBootIntro("xbox360", {}).scene).toBe("xbox");
    for (const theme of themes.filter((t) => t !== "xbox360")) {
      expect(resolveBootIntro(theme, {}).scene).toBe("default");
    }
  });

  it("sem arquivo de abertura do console, não há som próprio (usa a música padrão)", () => {
    expect(resolveBootIntro("xbox360", {}).startupSound).toBeNull();
  });

  it("usa o startup.* da pasta do próprio tema, e só dela", () => {
    const sounds = {
      "../sounds/Xbox One/startup.mp3": "xbox-url",
      "../sounds/PS4/startup.wav": "ps4-url",
    };
    expect(resolveBootIntro("xbox360", sounds).startupSound).toBe("xbox-url");
    expect(resolveBootIntro("ps4", sounds).startupSound).toBe("ps4-url");
    expect(resolveBootIntro("ps5", sounds).startupSound).toBeNull();
  });

  it("com som de abertura do tema, toca só ele (sem os efeitos por cima) e no volume do tema", () => {
    const sounds = { "../sounds/Phelierium Default/startup.mp3": "d", "../sounds/Xbox One/startup.mp3": "x" };
    const def = resolveBootIntro("default", sounds);
    const xbox = resolveBootIntro("xbox360", sounds);
    expect(def.playEffects).toBe(false);
    expect(xbox.playEffects).toBe(false);
    // o arquivo do Xbox é bem mais alto: precisa de volume menor
    expect(xbox.leadVolume).toBeLessThan(def.leadVolume);
    expect(def.leadVolume).toBeLessThanOrEqual(1);
  });

  it("sem som de abertura, usa a música padrão com os efeitos", () => {
    const choice = resolveBootIntro("ps5", {});
    expect(choice.startupSound).toBeNull();
    expect(choice.playEffects).toBe(true);
    expect(choice.leadVolume).toBeGreaterThan(0);
  });

  it("não confunde pastas de nome parecido", () => {
    const sounds = { "../sounds/PS4 Extra/startup.mp3": "wrong" };
    expect(resolveBootIntro("ps4", sounds).startupSound).toBeNull();
  });
});
