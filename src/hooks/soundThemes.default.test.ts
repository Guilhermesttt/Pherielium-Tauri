import { describe, expect, it } from "vitest";
import { resolveThemeSounds, soundThemes, soundTypeGain, type SoundEffectType } from "./useSoundEffects";
import { NOTCH_SOUNDS, resolveNotchSoundSrc, type NotchSoundId } from "../components/notch/notchSounds";

// Ações da interface que o usuário ouve com frequência: no tema padrão cada uma tem o seu som.
const DISTINCT_TYPES: SoundEffectType[] = [
  "navigate", "hover", "select", "back", "edit", "modalClose",
  "favoriteOn", "favoriteOff", "play", "boot", "search", "detailOpen", "showModal",
];

describe("tema sonoro padrão", () => {
  it("as ações principais não repetem o mesmo arquivo", () => {
    const files = DISTINCT_TYPES.map((type) => soundThemes.default[type]);
    expect(new Set(files).size).toBe(DISTINCT_TYPES.length);
  });

  it("ligar/desligar de interruptor usa o mesmo som do favoritar (mesma ideia)", () => {
    expect(soundThemes.default.switchOn).toBe(soundThemes.default.favoriteOn);
    expect(soundThemes.default.switchOff).toBe(soundThemes.default.favoriteOff);
  });

  it("os sons do notch também não se repetem no tema padrão", () => {
    const ids = Object.keys(NOTCH_SOUNDS) as NotchSoundId[];
    const files = ids.map((id) => resolveNotchSoundSrc(id, "default"));
    expect(new Set(files).size).toBe(ids.length);
  });
});

describe("papéis de navegação do tema padrão", () => {
  const pack = soundThemes.default;
  // o bundler devolve o caminho com espaços codificados (%20)
  const file = (type: SoundEffectType): string => decodeURIComponent(pack[type]);

  it("cada papel usa o arquivo combinado e os sons de abrir/fechar não se confundem", () => {
    expect(file("navigate")).toMatch(/Misc 10/);
    expect(file("detailOpen")).toMatch(/Into Game Detail/);
    expect(file("sidebarOpen")).toMatch(/Side Menu Fly In/);
    expect(file("sidebarClose")).toMatch(/Side Menu Fly Out/);
    expect(file("tabSwitch")).toMatch(/Tab Transition 01/);
    expect(file("edgeBump")).toMatch(/Bumper End 02/);
    expect(file("showModal")).toMatch(/Show Modal/);
    expect(file("modalClose")).toMatch(/Hide Modal/);
    expect(file("menuClick")).toMatch(/Navigation/);
    expect(file("keyTyping")).toMatch(/Typing/);
  });

  it("o tema padrão não tem som de hover (vazio), mas os outros temas têm", () => {
    expect(soundThemes.default.hover).toBe("");
    expect(resolveThemeSounds(undefined).hover).toBe("");
    expect(resolveThemeSounds("ps5").hover).toBeTruthy();
  });

  it("temas sem arquivo próprio herdam um equivalente para os papéis novos", () => {
    const ps5 = resolveThemeSounds("ps5");
    expect(ps5.tabSwitch).toBe(soundThemes.ps5.navigate);
    expect(ps5.sidebarOpen).toBe(soundThemes.ps5.showModal);
    expect(ps5.sidebarClose).toBe(soundThemes.ps5.modalClose);
    expect(ps5.keyTyping).toBe(soundThemes.ps5.navigate);
    for (const type of Object.keys(soundThemes.default) as SoundEffectType[]) {
      expect(ps5[type], `ps5.${type}`).toBeTruthy();
    }
  });

  it("tema desconhecido cai no padrão", () => {
    expect(resolveThemeSounds("nao-existe").tabSwitch).toBe(soundThemes.default.tabSwitch);
  });
});

describe("ganho por efeito", () => {
  it("sem ajuste por efeito, o ganho é 1 em qualquer tema", () => {
    expect(soundTypeGain("default", "select")).toBe(1);
    expect(soundTypeGain("ps5", "hover")).toBe(1);
    expect(soundTypeGain(undefined, "hover")).toBe(1);
  });
});
