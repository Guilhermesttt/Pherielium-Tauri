/**
 * Instrumentação SOMENTE LEITURA da presença (heartbeat, leave/offline, payloads recebidos).
 *
 * Existe para decidir com medição, e não por palpite, por que um amigo aparece offline enquanto a
 * pessoa joga (testes P-1 a P-3 do plano). Não muda nenhum comportamento: quando a flag está
 * desligada, `presenceDebugLog` não faz nada.
 *
 * Ligar:  localStorage.setItem("pherielium_presence_debug", "1")  e recarregar.
 * Relatório para colar:  await window.pherieliumPresenceReport()
 *
 * Privacidade: UIDs entram truncados (4 primeiros caracteres) e nenhum token é registrado.
 */

const FLAG_KEY = "pherielium_presence_debug";
const MAX_EVENTS = 800;

export type PresenceDebugKind =
  | "heartbeat_tick"
  | "heartbeat_sent"
  | "heartbeat_ack"
  | "offline_trigger"
  | "visibility"
  | "window_focus"
  | "network"
  | "game_watch"
  | "presence_channel_status"
  | "presence_key"
  | "presence_broadcast"
  | "presence_received"
  | "presence_leave_raw"
  | "friend_poll";

export interface PresenceDebugEvent {
  /** Milissegundos desde o epoch (relógio local). */
  t: number;
  kind: PresenceDebugKind;
  data: Record<string, unknown>;
}

/** Identifica esta instância do app (muda a cada carga); serve para detectar duas instâncias da mesma conta. */
export const PRESENCE_INSTANCE_ID: string = (() => {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID().slice(0, 8);
  return Math.random().toString(36).slice(2, 10);
})();

const events: PresenceDebugEvent[] = [];

export function isPresenceDebugEnabled(): boolean {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(FLAG_KEY) === "1";
  } catch (error) {
    // Armazenamento pode lançar em WebViews com dados de site bloqueados: tratar como "flag desligada".
    console.warn("[presenceDebug] localStorage indisponível:", error);
    return false;
  }
}

/** Encurta um UID para os 4 primeiros caracteres (o relatório é colado em canais públicos). */
export function shortUid(uid: unknown): string {
  const value = typeof uid === "string" ? uid.trim() : "";
  return value ? value.slice(0, 4) : "?";
}

export function presenceDebugLog(kind: PresenceDebugKind, data: Record<string, unknown> = {}): void {
  if (!isPresenceDebugEnabled()) return;
  const event: PresenceDebugEvent = {
    t: Date.now(),
    kind,
    data: { ...data, instance: PRESENCE_INSTANCE_ID, visible: currentVisibility() },
  };
  events.push(event);
  if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
  console.info(`[presence-debug:${kind}]`, event.data);
}

function currentVisibility(): string {
  return typeof document === "undefined" ? "n/a" : document.visibilityState;
}

// ---- análise e relatório (funções puras, testáveis) -------------------------------------

export interface GapStats {
  count: number;
  minMs: number | null;
  medianMs: number | null;
  maxMs: number | null;
  /** Quantos intervalos passaram de `slowThresholdMs`. */
  slowCount: number;
}

/** Estatísticas dos intervalos entre instantes consecutivos (heartbeats). */
export function summarizeGaps(timestamps: number[], slowThresholdMs = 45_000): GapStats {
  const sorted = [...timestamps].sort((a, b) => a - b);
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i += 1) gaps.push(sorted[i] - sorted[i - 1]);
  if (gaps.length === 0) {
    return { count: 0, minMs: null, medianMs: null, maxMs: null, slowCount: 0 };
  }
  const ordered = [...gaps].sort((a, b) => a - b);
  return {
    count: gaps.length,
    minMs: ordered[0],
    medianMs: ordered[Math.floor((ordered.length - 1) / 2)],
    maxMs: ordered[ordered.length - 1],
    slowCount: gaps.filter((gap) => gap > slowThresholdMs).length,
  };
}

const pad = (value: number): string => String(value).padStart(2, "0");

function clock(t: number): string {
  const d = new Date(t);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * Texto compacto para colar numa conversa. Mostra o resumo dos heartbeats, a contagem por tipo e a linha do
 * tempo dos eventos que importam (offline, leave, visibilidade, jogo, falhas de heartbeat).
 */
export function formatPresenceReport(
  list: PresenceDebugEvent[],
  context: { appVersion: string; uid: string; now: number },
): string {
  const counts = new Map<string, number>();
  for (const event of list) counts.set(event.kind, (counts.get(event.kind) ?? 0) + 1);

  const sentTimes = list.filter((e) => e.kind === "heartbeat_sent").map((e) => e.t);
  const gaps = summarizeGaps(sentTimes);
  const acks = list.filter((e) => e.kind === "heartbeat_ack");
  const failedAcks = acks.filter((e) => e.data.ok === false);
  const hiddenSent = list.filter((e) => e.kind === "heartbeat_sent" && e.data.visible === "hidden").length;
  const instances = new Set(list.map((e) => String(e.data.instance ?? "?")));

  const lines: string[] = [];
  lines.push("=== Pherielium presence report ===");
  lines.push(`app=${context.appVersion} uid=${shortUid(context.uid)} generated=${clock(context.now)} events=${list.length}`);
  lines.push(`instances_seen=${Array.from(instances).join(",")} (mais de uma = duas instâncias neste log)`);
  lines.push(
    `heartbeat: sent=${sentTimes.length} (hidden=${hiddenSent}) ack_ok=${acks.length - failedAcks.length} ack_fail=${failedAcks.length}` +
      ` gap_ms[min/med/max]=${gaps.minMs ?? "-"}/${gaps.medianMs ?? "-"}/${gaps.maxMs ?? "-"} slow(>45s)=${gaps.slowCount}`,
  );
  lines.push(
    "counts: " +
      Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([kind, n]) => `${kind}=${n}`)
        .join(" "),
  );

  const interesting = new Set<string>([
    "offline_trigger",
    "presence_leave_raw",
    "visibility",
    "window_focus",
    "game_watch",
    "network",
    "presence_channel_status",
    "presence_key",
  ]);
  lines.push("--- timeline (eventos relevantes e falhas) ---");
  for (const event of list) {
    const isFailedAck = event.kind === "heartbeat_ack" && event.data.ok === false;
    const isOfflineReceived = event.kind === "presence_received" && event.data.status === "offline";
    if (!interesting.has(event.kind) && !isFailedAck && !isOfflineReceived) continue;
    const rest: Record<string, unknown> = { ...event.data };
    delete rest.instance; // já resumido em `instances_seen`
    lines.push(`${clock(event.t)} ${event.kind} ${JSON.stringify(rest)}`);
  }
  return lines.join("\n");
}

// ---- instalação (efeitos colaterais, só com a flag) -------------------------------------

let installed = false;

/** Registra ouvintes passivos de visibilidade, foco, rede e eventos do watcher de jogo. Idempotente. */
export function installPresenceDebugListeners(context: { appVersion: () => Promise<string>; uid: () => string }): void {
  if (installed || !isPresenceDebugEnabled() || typeof window === "undefined") return;
  installed = true;

  document.addEventListener("visibilitychange", () => {
    presenceDebugLog("visibility", { state: document.visibilityState });
  });
  window.addEventListener("focus", () => presenceDebugLog("window_focus", { focused: true }));
  window.addEventListener("blur", () => presenceDebugLog("window_focus", { focused: false }));
  window.addEventListener("online", () => presenceDebugLog("network", { online: true }));
  window.addEventListener("offline", () => presenceDebugLog("network", { online: false }));

  // Eventos do watcher de jogo do Rust (o Rust esconde a janela principal ao detectar o jogo).
  void import("@tauri-apps/api/event")
    .then(({ listen }) => {
      void listen("game-watch:started", () => presenceDebugLog("game_watch", { event: "started" }));
      void listen("game-watch:ended", () => presenceDebugLog("game_watch", { event: "ended" }));
    })
    .catch((error) => {
      console.warn("[presenceDebug] sem eventos do Tauri (fora do app?):", error);
    });

  (window as unknown as { pherieliumPresenceReport?: () => Promise<string> }).pherieliumPresenceReport = async () => {
    const appVersion = await context.appVersion().catch(() => "unknown");
    const text = formatPresenceReport(events, { appVersion, uid: context.uid(), now: Date.now() });
    console.info(text);
    try {
      await navigator.clipboard.writeText(text);
      console.info("[presence-debug] relatório copiado para a área de transferência.");
    } catch (error) {
      console.warn("[presence-debug] não foi possível copiar; copie o texto acima.", error);
    }
    return text;
  };
  presenceDebugLog("presence_key", { note: "debug ligado", instanceId: PRESENCE_INSTANCE_ID });
}
