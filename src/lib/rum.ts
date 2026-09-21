export function sendRumMetric(name: string, value: number) {
  if (!import.meta.env?.PROD) return;
  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    navigator.sendBeacon("/rum", JSON.stringify({ name, value, ts: Date.now() }));
  }
}

// Phase 5 — Trophy operations are now wrapped through the in-process
// `trophyMetrics` registry. The function below is the legacy entrypoint
// kept for call sites that want a simple one-liner; the actual work is
// done in `trophyInstrumentation.ts` and `trophyMetrics.ts`.

export { getDefaultTrophyMetrics as getTrophyMetrics } from "./trophyMetrics";
export {
  measureCalculatePlayerLevel as measureCalculatePlayerLevel,
  measureCalculatePlayerLevelFromGames as measureCalculatePlayerLevelFromGames,
  measureCalculateGameTrophyCounts as measureCalculateGameTrophyCounts,
  measureAggregateTrophyCounts as measureAggregateTrophyCounts,
  measureGetTrophyXp as measureGetTrophyXp,
} from "./trophyInstrumentation";
