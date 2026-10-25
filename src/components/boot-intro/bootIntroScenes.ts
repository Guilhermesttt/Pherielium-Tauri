import defaultSceneUrl from "../../assets/intro-scenes/scene-default.json?url";
import xboxSceneUrl from "../../assets/intro-scenes/scene-xbox.json?url";
import type { SoundTheme } from "../../context/PreferencesContext";
import { resolveBootIntro, type BootSceneId } from "./bootIntroTheme";

/**
 * As cenas são animações Lottie exportadas do Jitter (1920×1080, 60 fps, ~14,6 s). Elas não
 * carregam áudio nenhum: os sons são tocados por `GameBootIntro` nos instantes de `cues`.
 * Os JSONs ficam fora do código (são ~1,4 MB cada, com texturas embutidas) e só são baixados
 * quando a intro vai tocar.
 */

export const SCENE_FPS = 60;

const SCENE_URLS: Record<BootSceneId, string> = {
  default: defaultSceneUrl,
  xbox: xboxSceneUrl,
};

/** Sons de abertura dos consoles que o usuário colocou em `src/sounds/<pasta do tema>/startup.*`. */
export const STARTUP_SOUNDS = import.meta.glob("../../sounds/*/startup.{mp3,wav,ogg}", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

export type SceneSoundId = "lead" | "swooshSoft" | "swooshAir1" | "swooshAir2";

export interface SceneTiming {
  /** segundo em que a cena termina (o resto do arquivo é preto) */
  endAt: number;
  /** segundo mais "completo" da cena, mostrado quando o movimento está reduzido */
  restFrame: number;
  cues: ReadonlyArray<{ at: number; sound: SceneSoundId }>;
}

// As duas cenas têm a mesma coreografia (só mudam cores e pequenos atrasos do texto):
// ~2,4 s o selo aparece, ~5,0 s o logo "atravessa" a tela, ~5,6 s o nome surge.
const CHOREOGRAPHY: SceneTiming = {
  endAt: 10.4,
  restFrame: 9.0,
  cues: [
    { at: 0, sound: "lead" },
    { at: 2.3, sound: "swooshAir1" },
    { at: 4.95, sound: "swooshAir2" },
    { at: 5.6, sound: "swooshSoft" },
  ],
};

export const SCENE_TIMING: Record<BootSceneId, SceneTiming> = {
  default: CHOREOGRAPHY,
  xbox: CHOREOGRAPHY,
};

const cache = new Map<BootSceneId, Promise<unknown>>();

/** Baixa e interpreta o JSON da cena (uma vez só; as chamadas seguintes reaproveitam). */
export function loadBootScene(scene: BootSceneId): Promise<unknown> {
  let promise = cache.get(scene);
  if (!promise) {
    promise = fetch(SCENE_URLS[scene]).then((response) => {
      if (!response.ok) throw new Error(`Cena de abertura indisponível (${response.status})`);
      return response.json() as Promise<unknown>;
    });
    // Falhou: tira do cache para a próxima tentativa baixar de novo.
    promise.catch(() => cache.delete(scene));
    cache.set(scene, promise);
  }
  return promise;
}

/** Pré-carrega a cena do tema durante a tela de carregamento, para a intro começar sem espera. */
export function preloadBootIntro(theme: SoundTheme): Promise<unknown> {
  return loadBootScene(resolveBootIntro(theme, STARTUP_SOUNDS).scene);
}
