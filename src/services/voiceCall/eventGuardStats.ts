/**
 * Contador e relatório dos eventos que os filtros do receptor (eventGuards.ts) aceitaram ou descartariam.
 *
 * Os totais ficam em memória e em `localStorage` (para sobreviver a reinício durante a semana de teste).
 * O relatório é um texto curto para colar numa conversa: sem payloads e com UIDs truncados (4 caracteres).
 *
 * Gerar:  window.pherieliumGuardReport()   (também copia para a área de transferência)
 */
import type { GuardDecision, GuardEvent, GuardMode } from "./eventGuards";

const STORAGE_KEY = "pherielium_event_guard_stats_v1";
const MAX_SAMPLES = 40;

export type GuardOutcome = "accepted" | "would-drop" | "dropped";

export interface GuardSample {
  t: number;
  event: GuardEvent;
  outcome: GuardOutcome;
  reason: string;
  sender: string;
}

export interface GuardStats {
  since: number;
  /** chave: `${event}|${outcome}|${reason}` */
  counts: Record<string, number>;
  samples: GuardSample[];
}

export interface StatsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const emptyStats = (now = Date.now()): GuardStats => ({ since: now, counts: {}, samples: [] });

export function outcomeFor(mode: GuardMode, decision: GuardDecision): GuardOutcome {
  if (decision.accept) return "accepted";
  return mode === "enforce" ? "dropped" : "would-drop";
}

const short = (uid: string): string => (uid ? uid.slice(0, 4) : "?");

/** Soma um evento ao contador. Só guarda amostra dos rejeitados (os aceitos só entram na contagem). */
export function recordOutcome(
  stats: GuardStats,
  input: { event: GuardEvent; mode: GuardMode; decision: GuardDecision; sender: string; now?: number },
): GuardStats {
  const outcome = outcomeFor(input.mode, input.decision);
  const key = `${input.event}|${outcome}|${input.decision.reason}`;
  const counts = { ...stats.counts, [key]: (stats.counts[key] ?? 0) + 1 };
  const samples =
    outcome === "accepted"
      ? stats.samples
      : [
          ...stats.samples,
          { t: input.now ?? Date.now(), event: input.event, outcome, reason: input.decision.reason, sender: short(input.sender) },
        ].slice(-MAX_SAMPLES);
  return { since: stats.since, counts, samples };
}

export function loadStats(storage: StatsStorage | null, now = Date.now()): GuardStats {
  if (!storage) return emptyStats(now);
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return emptyStats(now);
    const parsed = JSON.parse(raw) as Partial<GuardStats>;
    if (typeof parsed?.since !== "number" || typeof parsed.counts !== "object" || parsed.counts === null) return emptyStats(now);
    return {
      since: parsed.since,
      counts: parsed.counts as Record<string, number>,
      samples: Array.isArray(parsed.samples) ? (parsed.samples as GuardSample[]).slice(-MAX_SAMPLES) : [],
    };
  } catch (error) {
    console.warn("[eventGuardStats] ignorando estatística ilegível:", error);
    return emptyStats(now);
  }
}

export function saveStats(storage: StatsStorage | null, stats: GuardStats): void {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch (error) {
    console.warn("[eventGuardStats] não foi possível salvar a estatística:", error);
  }
}

const pad = (n: number): string => String(n).padStart(2, "0");
const stamp = (t: number): string => {
  const d = new Date(t);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

/** Texto para colar. Mostra totais por evento e desfecho, os motivos dos rejeitados e as últimas amostras. */
export function formatGuardReport(stats: GuardStats, context: { mode: GuardMode; appVersion: string; now?: number }): string {
  const now = context.now ?? Date.now();
  const perEvent = new Map<string, { accepted: number; wouldDrop: number; dropped: number }>();
  const reasons = new Map<string, number>();
  for (const [key, count] of Object.entries(stats.counts)) {
    const [event, outcome, reason] = key.split("|");
    const row = perEvent.get(event) ?? { accepted: 0, wouldDrop: 0, dropped: 0 };
    if (outcome === "accepted") row.accepted += count;
    else if (outcome === "would-drop") row.wouldDrop += count;
    else row.dropped += count;
    perEvent.set(event, row);
    if (outcome !== "accepted") reasons.set(`${event} ${reason}`, (reasons.get(`${event} ${reason}`) ?? 0) + count);
  }

  const lines: string[] = [];
  lines.push("=== Pherielium event guards report ===");
  lines.push(`app=${context.appVersion} mode=${context.mode} since=${stamp(stats.since)} generated=${stamp(now)}`);
  lines.push("event            accepted  would-drop  dropped");
  for (const [event, row] of Array.from(perEvent.entries()).sort()) {
    lines.push(`${event.padEnd(16)} ${String(row.accepted).padStart(8)}  ${String(row.wouldDrop).padStart(10)}  ${String(row.dropped).padStart(7)}`);
  }
  if (perEvent.size === 0) lines.push("(nenhum evento avaliado ainda)");
  lines.push("--- motivos dos eventos rejeitados ---");
  if (reasons.size === 0) lines.push("(nenhum)");
  for (const [reason, count] of Array.from(reasons.entries()).sort((a, b) => b[1] - a[1])) lines.push(`${count}x ${reason}`);
  lines.push("--- últimas amostras (rejeitados) ---");
  if (stats.samples.length === 0) lines.push("(nenhuma)");
  for (const sample of stats.samples.slice(-15)) {
    lines.push(`${stamp(sample.t)} ${sample.event} ${sample.outcome} ${sample.reason} sender=${sample.sender}`);
  }
  return lines.join("\n");
}
