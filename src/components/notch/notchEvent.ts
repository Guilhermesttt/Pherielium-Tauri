import type { MascotMood } from "../../mascot/moods";
import { TIER_STYLES } from "./achievementTier";

/**
 * Eventos do ecossistema que o notch encena (pedido de amizade, mensagem, conquista...).
 * O hub e o overlay são janelas diferentes no Tauri: o aviso viaja por evento do Tauri
 * (um `emit` chega às duas janelas) e, na mesma janela, por CustomEvent. Sem React, para
 * ser testável; a fila e a regra de agrupamento são funções puras.
 */
export type NotchEventKind = "friend-request" | "friend-accepted" | "message" | "achievement" | "level-up" | "welcome";

const KINDS: readonly NotchEventKind[] = ["friend-request", "friend-accepted", "message", "achievement", "level-up", "welcome"];

export type AchievementTier = "iron" | "bronze" | "silver" | "gold" | "platinum";
const TIERS: readonly AchievementTier[] = ["iron", "bronze", "silver", "gold", "platinum"];

export interface NotchEvent {
  /** identifica o evento: a mesma janela recebe CustomEvent + Tauri emit, o id evita mostrar duas vezes */
  id: string;
  kind: NotchEventKind;
  title: string;
  subtitle?: string;
  avatar?: string | null;
  /** conquista: descrição, jogo e XP ganho */
  description?: string;
  gameTitle?: string;
  xp?: number;
  tier?: AchievementTier;
  /** agrupa mensagens do mesmo amigo (uma barra com a última, em vez de uma fila de barras) */
  friendId?: string;
  /** quantas mensagens foram agrupadas */
  count?: number;
  at: number;
}

export const NOTCH_EVENT_WINDOW_EVENT = "pherielium:notch-event";
export const NOTCH_EVENT_TAURI_EVENT = "overlay:notch-event";
export const NOTCH_EVENT_WIDTH = 328;
export const NOTCH_EVENT_QUEUE_MAX = 4;

const DURATION_MS: Record<NotchEventKind, number> = {
  "friend-request": 4800,
  "friend-accepted": 3800,
  message: 3800,
  achievement: 4600,
  "level-up": 4600,
  welcome: 4200,
};

export const notchEventDuration = (kind: NotchEventKind, tier?: AchievementTier) =>
  kind === "achievement" ? TIER_STYLES[tier ?? "bronze"].durationMs : DURATION_MS[kind];

/** Conquista abre o notch inteiro (mascote + imagem + nome + descrição) em vez da barra compacta. */
export const notchEventIsExpanded = (kind: NotchEventKind) => kind === "achievement";

/** Humor da Pherie para cada evento. */
export const NOTCH_EVENT_MOOD: Record<NotchEventKind, MascotMood> = {
  "friend-request": "excited",
  "friend-accepted": "happy",
  message: "curious",
  achievement: "excited",
  "level-up": "proud",
  welcome: "happy",
};

/** Eventos em que a Pherie acena. */
export const notchEventWaves = (kind: NotchEventKind) => kind === "friend-request" || kind === "friend-accepted" || kind === "welcome";

const isTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const str = (v: unknown, max = 80): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;

export function parseNotchEvent(raw: unknown): NotchEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const v = raw as Record<string, unknown>;
  if (!KINDS.includes(v.kind as NotchEventKind)) return null;
  const title = str(v.title);
  if (!title) return null;
  const tier = TIERS.includes(v.tier as AchievementTier) ? (v.tier as AchievementTier) : undefined;
  const count = typeof v.count === "number" && v.count > 1 ? Math.min(99, Math.floor(v.count)) : undefined;
  return {
    id: str(v.id, 64) ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind: v.kind as NotchEventKind,
    title,
    subtitle: str(v.subtitle, 120),
    avatar: typeof v.avatar === "string" && v.avatar ? v.avatar : null,
    description: str(v.description, 160),
    gameTitle: str(v.gameTitle, 80),
    xp: typeof v.xp === "number" && Number.isFinite(v.xp) && v.xp > 0 ? Math.round(v.xp) : undefined,
    tier,
    friendId: str(v.friendId, 80),
    count,
    at: typeof v.at === "number" ? v.at : Date.now(),
  };
}

/**
 * Coloca o evento na fila. Mensagens do mesmo amigo viram uma só barra (a última, com a
 * contagem); a fila é limitada e descarta os mais antigos que ainda não apareceram.
 * O primeiro item da fila é o que está na tela.
 */
export function enqueueNotchEvent(queue: readonly NotchEvent[], event: NotchEvent, max = NOTCH_EVENT_QUEUE_MAX): NotchEvent[] {
  if (queue.some((q) => q.id === event.id)) return [...queue];
  if (event.kind === "message" && event.friendId) {
    const i = queue.findIndex((q) => q.kind === "message" && q.friendId === event.friendId);
    if (i >= 0) {
      const merged: NotchEvent = { ...event, count: (queue[i].count ?? 1) + 1 };
      const next = [...queue];
      next[i] = merged;
      return next;
    }
  }
  const next = [...queue, event];
  // mantém a barra atual (índice 0) e corta os mais antigos da espera
  while (next.length > max) next.splice(1, 1);
  return next;
}

/** Texto das mensagens agrupadas: "3 mensagens novas" em vez de só a última. */
export function notchEventSubtitle(event: NotchEvent): string {
  if (event.kind === "message" && (event.count ?? 1) > 1) return `${event.count} mensagens novas`;
  return event.subtitle ?? "";
}

/** Chamado pelo hub/overlay: avisa o notch (nesta janela e, no Tauri, nas demais). */
export function announceNotchEvent(input: Omit<NotchEvent, "id" | "at"> & { id?: string }): void {
  const payload: NotchEvent = {
    ...input,
    id: input.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: Date.now(),
  };
  try {
    window.dispatchEvent(new CustomEvent(NOTCH_EVENT_WINDOW_EVENT, { detail: payload }));
  } catch {
    /* sem janela: ignora */
  }
  if (isTauri()) {
    void import("@tauri-apps/api/event")
      .then(({ emit }) => emit(NOTCH_EVENT_TAURI_EVENT, payload))
      .catch(() => undefined);
  }
}
