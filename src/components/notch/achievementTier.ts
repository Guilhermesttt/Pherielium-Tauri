import type { AchievementTier } from "./notchEvent";

export type TierEffect = "none" | "sheen" | "burst" | "prism";

export interface TierStyle {
  label: string;
  /** cor do aro estático do notch e dos detalhes (r,g,b) */
  rgb: string;
  /** quanto tempo o notch fica aberto revelando a conquista */
  durationMs: number;
  /** efeito de revelação, de acordo com a raridade */
  effect: TierEffect;
  /** quantas faíscas sobem ao redor da imagem */
  sparks: number;
  /** repetições dos anéis/pulsos (0 = sem) */
  pulses: number;
}

/**
 * Cada tier tem um efeito diferente para a importância ficar clara de relance:
 * ferro/bronze só o brilho que passa uma vez; prata um brilho frio mais lento;
 * ouro uma explosão de luz com faíscas; platina anéis prismáticos e mais faíscas.
 */
/** Todos os tiers ficam o mesmo tempo na tela; a raridade aparece no efeito, não na duração. */
export const ACHIEVEMENT_REVEAL_MS = 4000;

export const TIER_STYLES: Record<AchievementTier, TierStyle> = {
  iron: { label: "Ferro", rgb: "148,155,163", durationMs: ACHIEVEMENT_REVEAL_MS, effect: "none", sparks: 0, pulses: 0 },
  bronze: { label: "Bronze", rgb: "205,127,50", durationMs: ACHIEVEMENT_REVEAL_MS, effect: "sheen", sparks: 0, pulses: 0 },
  silver: { label: "Prata", rgb: "203,209,220", durationMs: ACHIEVEMENT_REVEAL_MS, effect: "sheen", sparks: 4, pulses: 0 },
  gold: { label: "Ouro", rgb: "245,176,36", durationMs: ACHIEVEMENT_REVEAL_MS, effect: "burst", sparks: 9, pulses: 1 },
  platinum: { label: "Platina", rgb: "125,249,255", durationMs: ACHIEVEMENT_REVEAL_MS, effect: "prism", sparks: 14, pulses: 3 },
};

export const tierStyle = (tier: AchievementTier | undefined): TierStyle => TIER_STYLES[tier ?? "bronze"];

/** Aro estático (sem animação) do notch na cor do tier: 4 camadas, como `notchBoxShadow`, para a mola interpolar. */
export function achievementBoxShadow(tier: AchievementTier | undefined): string {
  const { rgb } = tierStyle(tier);
  return [
    `0 0 0 1.5px rgba(${rgb},0.85)`,
    `0 0 22px rgba(${rgb},0.22)`,
    "0 0 0 0 rgba(0,0,0,0)",
    "0 0 0 0 rgba(0,0,0,0)",
  ].join(", ");
}

/** Posições das faíscas: determinísticas (sem Math.random) para o desenho não mudar a cada render. */
export function sparkPositions(count: number): { x: number; y: number; delay: number; size: number }[] {
  return Array.from({ length: count }, (_, i) => {
    const t = (i + 1) / (count + 1);
    return {
      x: Math.round((t * 2 - 1) * 46 + Math.sin(i * 2.4) * 10),
      y: Math.round(Math.cos(i * 1.7) * 12),
      delay: (i % 5) * 0.12,
      size: 3 + (i % 3),
    };
  });
}
