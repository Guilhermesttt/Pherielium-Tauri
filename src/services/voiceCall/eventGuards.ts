/**
 * Filtros do receptor para eventos de chamada que chegam em canais Realtime PÚBLICOS.
 *
 * O `senderId` vem do próprio payload, então estes filtros **não impedem** um atacante que conheça os UIDs envolvidos:
 * só barram abuso casual (UID aleatório, chamada de outra sala, convite de quem não é amigo). A correção definitiva é o
 * protocolo v2 com canais privados (docs/decisions/0001). Por isso o primeiro release roda em modo "log": decide, conta e
 * relata, mas não bloqueia nada. Ver docs/protocol-compat.md.
 *
 * Funções puras: nenhuma toca em React, rede ou armazenamento.
 */
import { readModeFlag, type FlagStorage } from "../../lib/featureFlags";
import type {
  CallAnswerPayload,
  CallEndPayload,
  CallInvitePayload,
  CallKickPayload,
  CallPrivacyPayload,
  CallSignalPayload,
} from "./types";

export type GuardMode = "off" | "log" | "enforce";
export const GUARD_MODES = ["off", "log", "enforce"] as const;

export type GuardEvent = "call:end" | "call:kick" | "call:privacy" | "call:answer" | "call:signal" | "call:invite";

export type GuardReason =
  | "ok"
  | "ok-unknown-context"
  | "wrong-chat"
  | "sender-not-peer"
  | "sender-not-participant"
  | "sender-not-host"
  | "unknown-host"
  | "target-mismatch"
  | "self"
  | "not-a-friend";

export interface GuardDecision {
  accept: boolean;
  reason: GuardReason;
}

/** O que o receptor sabe sobre a chamada em andamento (ou o convite que está tocando). */
export interface GuardContext {
  localUid: string;
  /** chatId da sessão atual, ou do convite em `ringing-in`; `null` fora de chamada. */
  currentChatId: string | null;
  /** Outro lado de uma chamada 1:1 (amigo, ou quem está ligando). */
  peerUid: string | null;
  /** Host conhecido da sala (`hostUid`/`adminId` da sessão); `null` se desconhecido. */
  hostUid: string | null;
  /** UIDs de participantes conhecidos da sala. */
  participantUids: ReadonlySet<string>;
  /** Amigos aceitos; vazio significa "lista ainda não carregada". */
  friendUids: ReadonlySet<string>;
}

const ROOM_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Remove o prefixo `cp-friend:` que alguns pontos do app adicionam ao UID. */
export function cleanUid(value: unknown): string {
  return String(value ?? "").replace(/^cp-friend:/, "").trim();
}

/** Sala de voz tem chatId = UUID puro; chamada 1:1 usa `{uid}_{uid}` (ver getChatId). */
export function isRoomChat(chatId: string | null): boolean {
  return chatId !== null && ROOM_ID.test(chatId);
}

const ok = (): GuardDecision => ({ accept: true, reason: "ok" });
const unknown = (): GuardDecision => ({ accept: true, reason: "ok-unknown-context" });
const no = (reason: GuardReason): GuardDecision => ({ accept: false, reason });

/** O remetente é alguém que pode falar nesta chamada? (1:1: o par; sala: host ou participante conhecido.) */
function senderIsKnown(ctx: GuardContext, sender: string): GuardDecision {
  if (!isRoomChat(ctx.currentChatId)) {
    if (!ctx.peerUid) return unknown();
    return sender === ctx.peerUid ? ok() : no("sender-not-peer");
  }
  if (sender === ctx.hostUid || ctx.participantUids.has(sender) || sender === ctx.peerUid) return ok();
  if (!ctx.hostUid && ctx.participantUids.size === 0) return unknown();
  return no("sender-not-participant");
}

function sameChat(ctx: GuardContext, chatId: string): boolean {
  return ctx.currentChatId !== null && ctx.currentChatId === chatId;
}

export function evaluateCallEnd(ctx: GuardContext, p: Pick<CallEndPayload, "senderId" | "chatId">): GuardDecision {
  const sender = cleanUid(p.senderId);
  if (sender === ctx.localUid) return no("self");
  if (!ctx.currentChatId) return unknown();
  if (!sameChat(ctx, p.chatId)) return no("wrong-chat");
  return senderIsKnown(ctx, sender);
}

export function evaluateCallAnswer(ctx: GuardContext, p: Pick<CallAnswerPayload, "responderId" | "chatId">): GuardDecision {
  const sender = cleanUid(p.responderId);
  if (sender === ctx.localUid) return no("self");
  if (!ctx.currentChatId) return unknown();
  if (!sameChat(ctx, p.chatId)) return no("wrong-chat");
  return senderIsKnown(ctx, sender);
}

export function evaluateCallSignal(ctx: GuardContext, p: Pick<CallSignalPayload, "senderId" | "chatId">): GuardDecision {
  const sender = cleanUid(p.senderId);
  if (sender === ctx.localUid) return no("self");
  if (!ctx.currentChatId) return unknown();
  if (!sameChat(ctx, p.chatId)) return no("wrong-chat");
  return senderIsKnown(ctx, sender);
}

/** Kick só vale se o alvo sou eu e o remetente é o host que ESTE cliente conhece (sem o ramo "host desconhecido aceita tudo"). */
export function evaluateCallKick(
  ctx: GuardContext,
  p: Pick<CallKickPayload, "adminId" | "targetUserId" | "chatId">,
): GuardDecision {
  if (cleanUid(p.targetUserId) !== ctx.localUid) return no("target-mismatch");
  if (!ctx.currentChatId) return unknown();
  if (!sameChat(ctx, p.chatId)) return no("wrong-chat");
  if (!ctx.hostUid) return no("unknown-host");
  return cleanUid(p.adminId) === ctx.hostUid ? ok() : no("sender-not-host");
}

export function evaluateCallPrivacy(ctx: GuardContext, p: Pick<CallPrivacyPayload, "adminId" | "chatId">): GuardDecision {
  if (!ctx.currentChatId) return unknown();
  if (!sameChat(ctx, p.chatId)) return no("wrong-chat");
  if (!ctx.hostUid) return no("unknown-host");
  return cleanUid(p.adminId) === ctx.hostUid ? ok() : no("sender-not-host");
}

/** Convite só de amigo. Lista de amigos vazia = ainda não carregou: aceita, para não descartar convite legítimo no boot. */
export function evaluateCallInvite(ctx: GuardContext, p: Pick<CallInvitePayload, "callerId" | "chatId">): GuardDecision {
  const caller = cleanUid(p.callerId);
  if (!caller || caller === ctx.localUid) return no("self");
  if (ctx.currentChatId === p.chatId && ctx.peerUid && caller !== ctx.peerUid && !isRoomChat(p.chatId)) {
    return no("sender-not-peer"); // reconvite na mesma conversa 1:1 que não vem do par
  }
  if (ctx.friendUids.size === 0) return unknown();
  return ctx.friendUids.has(caller) ? ok() : no("not-a-friend");
}

/** Modo atual: flag `pherielium_event_guards` = off | log | enforce. Padrão `log` nesta release. */
export function getGuardMode(storage?: FlagStorage | null): GuardMode {
  return readModeFlag("event_guards", GUARD_MODES, "log", storage);
}

/**
 * Aplica a decisão segundo o modo e informa se o evento deve ser processado.
 * `off`: ignora tudo e deixa passar. `log`: conta e deixa passar. `enforce`: conta e bloqueia o que foi rejeitado.
 */
export function shouldProcess(mode: GuardMode, decision: GuardDecision): boolean {
  if (mode === "enforce") return decision.accept;
  return true;
}
