import type { SoundTheme } from "../../context/PreferencesContext";

/**
 * Qual cena de abertura e qual som de partida cada tema sonoro usa. Lógica pura (sem React,
 * sem arquivos) para poder ser testada à parte; `GameBootIntro` só aplica o resultado.
 */

export type BootSceneId = "default" | "xbox";

/** Tema que tem cena própria; os demais usam a cena padrão. */
const SCENE_BY_THEME: Partial<Record<SoundTheme, BootSceneId>> = {
  xbox360: "xbox",
};

/** Pasta de `src/sounds` de cada tema (é lá que o som de abertura do console deve ficar). */
export const SOUND_FOLDER_BY_THEME: Record<SoundTheme, string> = {
  default: "Phelierium Default",
  ps5: "PS5_Plus",
  ps4: "PS4",
  psp: "PSP Sounds",
  ps2: "PS2 System Sounds",
  gamecube: "Nintendo GameCube Menu SFX",
  xbox360: "Xbox One",
  cyberpunk: "Cyberpunk 2077 UI SFX PACK",
};

/** Nome do arquivo (sem extensão) que, na pasta do tema, vira o som de abertura do console. */
export const STARTUP_SOUND_NAME = "startup";

/**
 * Volume (0..1) do som de abertura de cada tema. Os arquivos têm loudness muito diferente
 * (o do Xbox é bem mais alto que o padrão), então cada um ganha o seu nível.
 */
const STARTUP_VOLUME: Partial<Record<SoundTheme, number>> = { default: 1, xbox360: 0.55 };
const STARTUP_VOLUME_FALLBACK = 0.8;
/** Volume da música de abertura usada quando o tema não tem som de abertura próprio. */
const FALLBACK_MUSIC_VOLUME = 0.55;

export interface BootIntroChoice {
  scene: BootSceneId;
  /** som de abertura do console do tema, quando o arquivo existe; senão `null` (usa a música padrão) */
  startupSound: string | null;
  /** volume do som que abre a intro (o de abertura do tema ou a música padrão) */
  leadVolume: number;
  /**
   * Toca os efeitos (swooshes) por cima do som de abertura. O som de abertura de um console já é
   * a trilha completa da cena; somar os efeitos duplicaria os sons, então com ele toca só ele.
   */
  playEffects: boolean;
}

/**
 * `startupSounds` mapeia o caminho de cada arquivo `startup.*` encontrado em `src/sounds`
 * (por exemplo `../sounds/Xbox One/startup.mp3`) para a sua URL.
 */
export function resolveBootIntro(theme: SoundTheme, startupSounds: Readonly<Record<string, string>>): BootIntroChoice {
  const folder = SOUND_FOLDER_BY_THEME[theme];
  const found = Object.entries(startupSounds).find(([path]) =>
    new RegExp(`/${folder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/${STARTUP_SOUND_NAME}\\.[a-z0-9]+$`, "i").test(path),
  );
  const startupSound = found?.[1] ?? null;
  return {
    scene: SCENE_BY_THEME[theme] ?? "default",
    startupSound,
    leadVolume: startupSound ? (STARTUP_VOLUME[theme] ?? STARTUP_VOLUME_FALLBACK) : FALLBACK_MUSIC_VOLUME,
    playEffects: startupSound === null,
  };
}
