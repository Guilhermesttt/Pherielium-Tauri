/**
 * Resolves when a play session clock should start — never before the user clicked Play.
 */
export function resolveSessionStartedAt(
  launchedAt: number,
  processStartTimeMs?: number | null,
  confirmedAt: number = Date.now(),
): number {
  const safeLaunchedAt = launchedAt > 0 ? launchedAt : confirmedAt;
  if (processStartTimeMs && processStartTimeMs >= safeLaunchedAt) {
    return processStartTimeMs;
  }
  return confirmedAt;
}
