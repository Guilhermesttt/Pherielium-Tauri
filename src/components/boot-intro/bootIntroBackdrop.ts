/**
 * Opacidade do vídeo de fundo da abertura ao longo da cena (segundos). Reproduz o que a textura
 * de bolinhas (imagem estática) fazia dentro da animação Lottie: some até ~2,0 s, sobe até o pico (40%, mais forte que os 15% da textura porque o vídeo tem pontos bem mais ralos) até
 * ~3,6 s, fica assim e desaparece entre ~7,8 s e ~12,4 s. Pura, para poder ser testada.
 */
export const BACKDROP = { rampFrom: 2.0, rampTo: 3.6, fadeFrom: 7.8, fadeTo: 12.4, peak: 0.4 } as const;

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

export function backdropOpacity(t: number): number {
  const rise = clamp01((t - BACKDROP.rampFrom) / (BACKDROP.rampTo - BACKDROP.rampFrom));
  const fall = clamp01((t - BACKDROP.fadeFrom) / (BACKDROP.fadeTo - BACKDROP.fadeFrom));
  return BACKDROP.peak * rise * (1 - fall);
}
