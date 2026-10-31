/**
 * Coreografia da intro de abertura (`GameBootIntro`), toda feita com molas do `@react-spring/web`
 * (só `transform`, `opacity` e `filter`). Os sons não vêm de nenhum arquivo de animação: são
 * tocados nos instantes de `cues`, e os marcos de `stages` disparam as molas.
 *
 *   0,0 s   fundo radial escuro; o vídeo de pontos de luz sobe a partir de 2,0 s    → música de abertura
 *   2,0 s   a placa (squircle) surge pequena, girando de -45°; o selo entra 200 ms depois
 *   2,2 s   onda de choque, faíscas e brilho atrás do logo                          → swoosh de ar (2,3 s)
 *   3,0 s   uma faixa de luz atravessa o logo
 *   4,6 s   o conjunto se contrai (96%)
 *   4,75 s  hiper-zoom: cresce 25× e some                                           → swoosh de ar (4,95 s)
 *   5,38 s  o nome entra letra a letra (useTrail)                                   → swoosh suave (5,6 s)
 *   10,2 s  o nome sai na mesma ordem, subindo e desfocando (depois de ~4,8 s parado)
 *   12,6 s  fim (some em 400 ms)
 */

export type SceneSoundId = "lead" | "swooshSoft" | "swooshAir1" | "swooshAir2";

export type SceneStage = "idle" | "plate" | "shock" | "shine" | "anticipate" | "launch" | "name" | "nameOut";

export interface SceneTiming {
  /** segundo em que a intro termina e começa a sumir */
  endAt: number;
  cues: ReadonlyArray<{ at: number; sound: SceneSoundId }>;
  /** segundo em que cada fase começa (as molas partem daí) */
  stages: ReadonlyArray<{ at: number; stage: Exclude<SceneStage, "idle"> }>;
}

/** Sons de abertura dos consoles que o usuário colocou em `src/sounds/<pasta do tema>/startup.*`. */
export const STARTUP_SOUNDS = import.meta.glob("../../sounds/*/startup.{mp3,wav,ogg}", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

export const SCENE_TIMING: SceneTiming = {
  endAt: 12.6,
  cues: [
    { at: 0, sound: "lead" },
    { at: 2.3, sound: "swooshAir1" },
    { at: 4.95, sound: "swooshAir2" },
    { at: 5.6, sound: "swooshSoft" },
  ],
  stages: [
    { at: 2.0, stage: "plate" },
    { at: 2.2, stage: "shock" },
    { at: 3.0, stage: "shine" },
    { at: 4.6, stage: "anticipate" },
    { at: 4.75, stage: "launch" },
    { at: 5.38, stage: "name" },
    { at: 10.2, stage: "nameOut" },
  ],
};
