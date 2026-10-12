/**
 * Cola de runtime dos filtros de evento: aplica o modo, conta no armazenamento local e expõe o relatório.
 * A lógica de decisão está em eventGuards.ts e a de contagem em eventGuardStats.ts (ambas puras e testadas).
 */
import {
  getGuardMode,
  shouldProcess,
  type GuardDecision,
  type GuardEvent,
} from "./eventGuards";
import {
  formatGuardReport,
  loadStats,
  recordOutcome,
  saveStats,
  type GuardStats,
  type StatsStorage,
} from "./eventGuardStats";
import { getAppVersionCached } from "../../lib/protocolVersion";

let stats: GuardStats | null = null;
let installed = false;

function storage(): StatsStorage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch (error) {
    console.warn("[eventGuards] localStorage indisponível:", error);
    return null;
  }
}

function current(): GuardStats {
  if (!stats) stats = loadStats(storage());
  return stats;
}

/**
 * Registra a decisão e devolve `true` se o evento deve ser processado.
 * No modo `off` não conta nada e sempre devolve `true`.
 */
export function guardEvent(event: GuardEvent, decision: GuardDecision, sender: string): boolean {
  const mode = getGuardMode();
  if (mode === "off") return true;
  stats = recordOutcome(current(), { event, mode, decision, sender });
  saveStats(storage(), stats);
  if (!decision.accept) {
    console.info(`[event-guards] ${mode === "enforce" ? "descartado" : "descartaria"}: ${event} (${decision.reason})`);
  }
  return shouldProcess(mode, decision);
}

/** Instala `window.pherieliumGuardReport()`. Idempotente. */
export function installGuardReport(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  (window as unknown as { pherieliumGuardReport?: () => Promise<string> }).pherieliumGuardReport = async () => {
    const appVersion = await getAppVersionCached();
    const text = formatGuardReport(current(), { mode: getGuardMode(), appVersion });
    console.info(text);
    try {
      await navigator.clipboard.writeText(text);
      console.info("[event-guards] relatório copiado para a área de transferência.");
    } catch (error) {
      console.warn("[event-guards] não foi possível copiar; copie o texto acima.", error);
    }
    return text;
  };
}
