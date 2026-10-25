/**
 * Destaque no falante na chamada de voz, sem mudar o layout da grade: quem está falando cresce
 * um pouco e passa à frente; os outros recuam e escurecem. Quando ninguém fala, ou há movimento
 * reduzido, todos ficam iguais.
 */
export interface SpotlightMotion {
  scale: number;
  opacity: number;
}

export const SPOTLIGHT_SPEAKER_SCALE = 1.06;
export const SPOTLIGHT_OTHERS_SCALE = 0.96;
export const SPOTLIGHT_OTHERS_OPACITY = 0.72;

export function spotlightMotion(isSpeaking: boolean, anySpeaking: boolean, reduceMotion: boolean): SpotlightMotion {
  if (reduceMotion || !anySpeaking) return { scale: 1, opacity: 1 };
  return isSpeaking
    ? { scale: SPOTLIGHT_SPEAKER_SCALE, opacity: 1 }
    : { scale: SPOTLIGHT_OTHERS_SCALE, opacity: SPOTLIGHT_OTHERS_OPACITY };
}
