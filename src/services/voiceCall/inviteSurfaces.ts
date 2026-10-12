/**
 * Superfícies do convite de call pendente (N-invite): toast do hub, notch e overlay do jogo.
 * Tudo puro, exceto `isOverlayNotificationAvailable`. O estado em si vive em `inviteState.ts`.
 *
 * Regra de som: UMA fonte sonora por convite. O overlay do jogo toca o próprio aviso ao exibir um `incoming-call`; o notch não toca
 * nada; então, com o overlay disponível, o toast do hub fica mudo. Sem overlay (navegador/dev), o toast toca o som de mensagem.
 */
import { INVITE_TTL_MS, inviteRemainingMs, type PendingInvite } from "./inviteState";

const NOTIFICATION_PREFIX = "invite:";

/** Id usado no toast do hub e no toast do overlay (o mesmo, para fechar um e outro). */
export const inviteNotificationId = (key: string): string => `${NOTIFICATION_PREFIX}${key}`;

/** Chave do convite a partir de um id de notificação; `null` se não for de convite (ex.: toque antigo `incoming-call:...`). */
export function parseInviteNotificationId(id: unknown): string | null {
  if (typeof id !== "string" || !id.startsWith(NOTIFICATION_PREFIX)) return null;
  const key = id.slice(NOTIFICATION_PREFIX.length);
  return key.length > 0 ? key : null;
}

/** O toast do hub deve tocar som? Só quando o overlay (que toca o seu) não está disponível. */
export function inviteToastShouldPlaySound(input: { overlayAvailable: boolean }): boolean {
  return !input.overlayAvailable;
}

export function isOverlayNotificationAvailable(): boolean {
  return typeof window !== "undefined" && typeof window.electronAPI?.showNotificationOverlay === "function";
}

/** Payload do `showNotificationOverlay`: o mesmo formato do toque antigo (`incoming-call`), com duração de 15 min. */
export interface InviteOverlayPayload {
  id: string;
  notificationId: string;
  type: "incoming-call";
  title: string;
  message: string;
  imageUrl?: string;
  friendId: string;
  duration: number;
  metadata: { notificationId: string; callerName: string; senderName: string };
}

export function inviteOverlayPayload(pending: PendingInvite): InviteOverlayPayload {
  const id = inviteNotificationId(pending.key);
  const caller = pending.invite.callerName;
  return {
    id,
    notificationId: id,
    type: "incoming-call",
    title: "Convite de call",
    message: `${caller} está te convidando para uma call`,
    imageUrl: pending.invite.callerAvatar || undefined,
    friendId: pending.invite.callerId,
    duration: INVITE_TTL_MS,
    metadata: { notificationId: id, callerName: caller, senderName: caller },
  };
}

/**
 * O que enviar ao overlay para ficar igual à lista de pendentes.
 * Com a flag desligada nada novo é exibido (e o que sobrou é retirado), o que mantém o caminho antigo (`ringing-in`) intacto.
 */
export function diffInviteOverlay(
  shownIds: ReadonlySet<string>,
  pending: readonly PendingInvite[],
  flagOn: boolean,
): { show: PendingInvite[]; dismiss: string[] } {
  const wanted = flagOn ? pending : [];
  const wantedIds = new Set(wanted.map((p) => inviteNotificationId(p.key)));
  return {
    show: wanted.filter((p) => !shownIds.has(inviteNotificationId(p.key))),
    dismiss: [...shownIds].filter((id) => !wantedIds.has(id)),
  };
}

/** Milissegundos até o próximo convite pendente expirar; `null` se não há. */
export function nextInviteExpiryMs(pending: readonly PendingInvite[], nowMs: number): number | null {
  if (pending.length === 0) return null;
  return Math.min(...pending.map((p) => inviteRemainingMs({ createdAtMs: p.receivedAtMs, nowMs })));
}

/**
 * Como `call:invite` é tratado: "notification" (convite pendente, sem toque) só com a flag ligada e o app ocioso.
 * Qualquer outro caso, flag desligada incluída, segue o fluxo antigo (toque, modal, ocupado, reconexão).
 */
export function inviteHandling(input: { flagOn: boolean; callState: string }): "notification" | "legacy" {
  return input.flagOn && input.callState === "idle" ? "notification" : "legacy";
}

/**
 * De onde `answerCall()` tira o convite. Sem convites pendentes (flag desligada = sempre) é exatamente o comportamento
 * anterior: o argumento, senão o convite tocando, senão nada.
 */
export function resolveAnswerSource(input: {
  hasOverride: boolean;
  hasIncoming: boolean;
  pendingCount: number;
}): "override" | "incoming" | "pending" | "none" {
  if (input.hasOverride) return "override";
  if (input.hasIncoming) return "incoming";
  return input.pendingCount > 0 ? "pending" : "none";
}

/** De onde `rejectCall()` tira o convite (mesma regra: sem pendentes é o comportamento anterior). */
export function resolveRejectSource(input: { hasIncoming: boolean; pendingCount: number }): "incoming" | "pending" | "none" {
  if (input.hasIncoming) return "incoming";
  return input.pendingCount > 0 ? "pending" : "none";
}
