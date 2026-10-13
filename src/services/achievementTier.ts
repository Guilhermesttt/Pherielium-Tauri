/**
 * Tier (ferro/bronze/prata/ouro/platina) de uma conquista a partir da raridade global (% de jogadores que a têm).
 *
 * Porcentagem ausente, inválida ou **0** significa "desconhecida", não "raríssima": o servidor devolve 0 quando não consegue
 * a porcentagem global, e isso fazia conquistas comuns aparecerem como platina. Desconhecida vira bronze (o mais discreto).
 */
export type PollTier = "platinum" | "gold" | "silver" | "bronze";

export function tierFromGlobalPercent(percent: unknown): PollTier {
  if (typeof percent !== "number" || !Number.isFinite(percent) || percent <= 0) return "bronze";
  if (percent <= 5) return "platinum";
  if (percent <= 20) return "gold";
  if (percent <= 50) return "silver";
  return "bronze";
}

/** O cache ainda vale? `maxAgeMs` menor que o padrão é usado pelo modal de detalhes para não mostrar conquistas antigas. */
export function isCacheFresh(cachedAtMs: number, nowMs: number, maxAgeMs: number): boolean {
  return nowMs - cachedAtMs < maxAgeMs;
}
