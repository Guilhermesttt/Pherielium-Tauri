/**
 * `unlockedAt` de conquistas locais em segundos desde a época Unix.
 * Aceita RFC 3339 (formato atual) e o formato legado `"<segundos>Z"` que versões antigas do
 * backend gravavam (não é uma data válida para `Date.parse`). Entrada inválida vira 0.
 */
export function parseUnlockedAtSeconds(value: string | null | undefined): number {
  if (!value) return 0;
  const legacy = /^(\d{9,11})Z$/.exec(value.trim());
  if (legacy) return Number(legacy[1]);
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : 0;
}
