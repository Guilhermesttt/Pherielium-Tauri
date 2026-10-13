/**
 * Estado local de convites de call (fatia I0). NÃO é autoritativo.
 *
 * Relógios (limitação conhecida): convite AO VIVO expira em (instante de recebimento no relógio do receptor + 15 min), então
 * não depende do relógio de quem convidou. Cartão HISTÓRICO (mensagem no chat) usa o `created_at` do servidor, com tolerância de
 * 2 min a favor do usuário (INVITE_CARD_TOLERANCE_MS). Mesmo assim o relógio do receptor ainda decide "agora": um PC com a hora
 * errada vê convites expirarem cedo ou tarde. A correção real é o `server_now` da fatia I. O cancelamento vem de um `call:end` recebido. A versão autoritativa (expiração e cancelamento no
 * servidor, `server_now`) é a fatia I (docs/backend-audit/PLAN.md §17); até lá isto só evita tocar como ligação e deixa o
 * convite visível como notificação.
 *
 * Tudo aqui é puro (sem React, sem relógio): o chamador informa `nowMs`.
 */
import { isFlagOn, type FlagStorage } from "../../lib/featureFlags";
import type { CallInvitePayload } from "./types";

/** Validade de um convite (espelha o valor planejado para o servidor: 15 min). */
export const INVITE_TTL_MS = 15 * 60 * 1000;
/** Tolerância (a favor do usuário) para cartões históricos e para casar cartão com aviso ao vivo. */
export const INVITE_CARD_TOLERANCE_MS = 2 * 60 * 1000;
/** Janela em que o mesmo convite (mesma chave) é ignorado depois de processado. */
export const INVITE_DEDUPE_WINDOW_MS = 10_000;

/** `pherielium_invite_notifications`: **ligada por padrão desde o rc.4** (`0` desliga). Ligada, o convite vira notificação e não toca como ligação. */
export const isInviteNotificationsOn = (): boolean => isFlagOn("invite_notifications", true);

/**
 * `pherielium_channel_invite_ring`: o remetente de um convite de CANAL também dispara o aviso de ligação em tempo real
 * (`call:invite`), que no app do receptor toca e abre o modal de atender. Padrão **desligado**: o convite vai só como cartão no chat
 * (e a notificação de mensagem). Vale para qualquer receptor, inclusive o 1.0.2. A ligação 1:1 não é afetada.
 */
export const isChannelInviteRingOn = (storage?: FlagStorage | null): boolean => isFlagOn("channel_invite_ring", false, storage);

export type InviteStatus = "pending" | "expired" | "cancelled";

export function inviteState(input: {
  createdAtMs: number;
  nowMs: number;
  ttlMs?: number;
  cancelled?: boolean;
}): InviteStatus {
  if (input.cancelled) return "cancelled";
  const ttl = input.ttlMs ?? INVITE_TTL_MS;
  return input.nowMs - input.createdAtMs >= ttl ? "expired" : "pending";
}

/** Milissegundos que faltam para expirar (0 se já expirou). */
export function inviteRemainingMs(input: { createdAtMs: number; nowMs: number; ttlMs?: number }): number {
  const ttl = input.ttlMs ?? INVITE_TTL_MS;
  return Math.max(0, input.createdAtMs + ttl - input.nowMs);
}

/** Chave de deduplicação: conversa + quem convida + canal. Para o convite 1:1 antigo o canal é a própria conversa. */
export function inviteKey(input: { chatId: string; inviterId: string; channelId?: string | null }): string {
  return `${input.chatId}|${input.inviterId}|${input.channelId || input.chatId}`;
}

export interface PendingInvite {
  key: string;
  invite: CallInvitePayload;
  receivedAtMs: number;
}

export interface InviteStoreState {
  /** Convites ao vivo: expiram em `receivedAtMs` (relógio do receptor) + 15 min. */
  pending: readonly PendingInvite[];
  /** chave -> quando foi processada (janela anti-duplicata, mesmo depois de aceitar/dispensar). */
  seen: Readonly<Record<string, number>>;
  /**
   * chatId -> `timestamp` (relógio de quem convidou) do convite cancelado por um `call:end` do convidante.
   * Fica no relógio do convidante de propósito: comparar com o relógio local misturaria dois relógios.
   */
  cancelledAt: Readonly<Record<string, number>>;
}

export const EMPTY_INVITE_STATE: InviteStoreState = { pending: [], seen: {}, cancelledAt: {} };

export type InviteAction =
  | { type: "received"; invite: CallInvitePayload; nowMs: number }
  | { type: "cancelled"; chatId: string; inviterId: string; nowMs: number }
  | { type: "dismissed"; key: string }
  | { type: "prune"; nowMs: number };

const keyOf = (invite: CallInvitePayload): string => inviteKey({ chatId: invite.chatId, inviterId: invite.callerId });

/** Reducer puro. Devolve o MESMO objeto quando nada muda, para o chamador detectar "convite repetido". */
export function reduceInvites(state: InviteStoreState, action: InviteAction): InviteStoreState {
  switch (action.type) {
    case "received": {
      const key = keyOf(action.invite);
      const seenAt = state.seen[key];
      if (seenAt !== undefined && action.nowMs - seenAt < INVITE_DEDUPE_WINDOW_MS) return state;
      if (state.pending.some((p) => p.key === key)) return state;
      return {
        ...state,
        pending: [...state.pending, { key, invite: action.invite, receivedAtMs: action.nowMs }],
        seen: { ...state.seen, [key]: action.nowMs },
      };
    }
    case "cancelled": {
      const matching = state.pending.filter(
        (p) => p.invite.chatId === action.chatId && p.invite.callerId === action.inviterId,
      );
      if (matching.length === 0) return state;
      return {
        ...state,
        pending: state.pending.filter((p) => !matching.includes(p)),
        cancelledAt: {
          ...state.cancelledAt,
          [action.chatId]: Math.max(...matching.map((p) => p.invite.timestamp)),
        },
      };
    }
    case "dismissed": {
      if (!state.pending.some((p) => p.key === action.key)) return state;
      return { ...state, pending: state.pending.filter((p) => p.key !== action.key) };
    }
    case "prune": {
      const pending = state.pending.filter(
        (p) => inviteState({ createdAtMs: p.receivedAtMs, nowMs: action.nowMs }) === "pending",
      );
      const seenEntries = Object.entries(state.seen).filter(([, at]) => action.nowMs - at < INVITE_DEDUPE_WINDOW_MS);
      if (pending.length === state.pending.length && seenEntries.length === Object.keys(state.seen).length) return state;
      return { ...state, pending, seen: Object.fromEntries(seenEntries) };
    }
  }
}

/**
 * O cartão criado em `createdAtMs` para `chatId` foi cancelado? O cartão (mensagem) e o aviso em tempo real são criados pelo
 * mesmo convidante com alguns instantes de diferença; a tolerância cobre isso sem alcançar um convite novo, reenviado depois.
 */
export const INVITE_MATCH_TOLERANCE_MS = INVITE_CARD_TOLERANCE_MS;
export function isInviteCancelled(state: InviteStoreState, chatId: string, createdAtMs: number): boolean {
  const cancelledInviteAt = state.cancelledAt[chatId];
  return cancelledInviteAt !== undefined && createdAtMs <= cancelledInviteAt + INVITE_MATCH_TOLERANCE_MS;
}
