import type { NexusDownloadState } from "./nexus";

/**
 * O que a tela mostra de um download, derivado do estado que o Rust publica. Funções puras (sem
 * React), para testar as regras: quando dá para pausar, quanto falta, em que passo do fluxo guiado
 * da conta grátis a pessoa está.
 */

export type DownloadPhase =
  | "waiting"
  | "expired"
  | "resolving"
  | "downloading"
  | "paused"
  | "installing"
  | "done"
  | "error"
  | "cancelled";

/** Fase na tela. "Esperando o link" que passou da validade vira "expirou" (o Rust só publica uma vez). */
export function downloadPhase(state: Pick<NexusDownloadState, "status" | "expiresAt">, now: number): DownloadPhase {
  switch (state.status) {
    case "waiting_link":
      return state.expiresAt !== undefined && state.expiresAt <= now ? "expired" : "waiting";
    case "resolving":
      return "resolving";
    case "downloading":
      return "downloading";
    case "paused":
      return "paused";
    case "installing":
      return "installing";
    case "completed":
      return "done";
    case "cancelled":
      return "cancelled";
    default:
      return "error";
  }
}

export const isFinished = (phase: DownloadPhase): boolean => phase === "done" || phase === "error" || phase === "cancelled";

export const canPause = (phase: DownloadPhase): boolean => phase === "downloading";
export const canResume = (phase: DownloadPhase): boolean => phase === "paused";
/** Cancelar vale até começar a instalar: instalar é rápido e não se interrompe pela metade. */
export const canCancel = (phase: DownloadPhase): boolean =>
  phase === "waiting" || phase === "resolving" || phase === "downloading" || phase === "paused";

export function percentOf(received: number | undefined, total: number | undefined): number {
  if (!total || total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round(((received ?? 0) / total) * 100)));
}

const SPEED_UNITS = ["B/s", "KB/s", "MB/s", "GB/s"] as const;

export function formatSpeed(bytesPerSecond: number | undefined): string {
  if (!bytesPerSecond || bytesPerSecond <= 0) return "";
  let value = bytesPerSecond;
  let unit = 0;
  while (value >= 1024 && unit < SPEED_UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const rounded = value >= 100 || unit === 0 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded.toLocaleString("pt-BR")} ${SPEED_UNITS[unit]}`;
}

/** "45 s", "2 min 05 s", "1 h 03 min". Vazio quando não dá para estimar. */
export function formatEta(received: number | undefined, total: number | undefined, bytesPerSecond: number | undefined): string {
  if (!total || !bytesPerSecond || bytesPerSecond <= 0) return "";
  const remaining = total - (received ?? 0);
  if (remaining <= 0) return "";
  const seconds = Math.ceil(remaining / bytesPerSecond);
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ${String(seconds % 60).padStart(2, "0")} s`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")} min`;
}

/** Tempo que ainda resta ao pedido que espera o link: "14:32". Zero depois de vencer. */
export function formatCountdown(expiresAt: number | undefined, now: number): string {
  if (expiresAt === undefined) return "";
  const seconds = Math.max(0, Math.ceil((expiresAt - now) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export type StepState = "done" | "current" | "todo";

export interface GuidedStep {
  id: "open" | "slow" | "accept" | "download";
  state: StepState;
}

/** Em que passo cada fase está (índice do passo atual; 4 = todos feitos; ausente = sem passos). */
const CURRENT_STEP: Partial<Record<DownloadPhase, number>> = {
  waiting: 1,
  expired: 1,
  resolving: 3,
  downloading: 3,
  paused: 3,
  installing: 4,
  done: 4,
};

/**
 * Os passos da conta grátis: abrir a página da Nexus (já feito quando o pedido existe), clicar em
 * "Download lento", aceitar abrir o Pherielium no navegador e, então, o download. Quando o link
 * chega, os três primeiros estão feitos. Sem passos para erro e cancelamento.
 */
export function guidedSteps(phase: DownloadPhase): GuidedStep[] {
  const current = CURRENT_STEP[phase];
  if (current === undefined) return [];
  const ids: GuidedStep["id"][] = ["open", "slow", "accept", "download"];
  return ids.map((id, index) => ({
    id,
    state: index < current ? "done" : index === current ? "current" : "todo",
  }));
}
