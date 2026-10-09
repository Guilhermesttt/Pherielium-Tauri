import { SPRINGS } from "../../../design-system/motion";

/**
 * Lógica pura do chat: agrupamento de mensagens consecutivas e a física dos balões (react-spring).
 * Sem React aqui, para testar.
 */

export interface GroupableMessage {
  senderId: string;
  createdAt: string | number | Date;
}

export interface GroupInfo {
  /** primeira do bloco: leva respiro em cima (e o nome, no caso do amigo) */
  startsGroup: boolean;
  /** última do bloco: leva o avatar, a "cauda" e a hora/estado */
  endsGroup: boolean;
}

/** Mensagens do mesmo autor com menos disso entre elas formam um bloco. */
export const GROUP_GAP_MS = 2 * 60 * 1000;

const time = (v: GroupableMessage["createdAt"]) => new Date(v).getTime();

const sameDay = (a: number, b: number) => {
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
};

const joins = (a: GroupableMessage, b: GroupableMessage) => {
  const ta = time(a.createdAt);
  const tb = time(b.createdAt);
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return false;
  return a.senderId === b.senderId && Math.abs(tb - ta) < GROUP_GAP_MS && sameDay(ta, tb);
};

export function groupInfo(messages: readonly GroupableMessage[], index: number): GroupInfo {
  const prev = index > 0 ? messages[index - 1] : null;
  const next = index < messages.length - 1 ? messages[index + 1] : null;
  const cur = messages[index];
  return {
    startsGroup: !prev || !joins(prev, cur),
    endsGroup: !next || !joins(cur, next),
  };
}

/** Estado inicial (antes de "pousar") de um balão novo. Ao enviar, ele sai de perto do campo de texto. */
export function bubbleFrom(isMe: boolean) {
  return isMe
    ? { opacity: 0, x: 14, y: 30, scale: 0.84 }
    : { opacity: 0, x: -10, y: 14, scale: 0.88 };
}

export const BUBBLE_REST = { opacity: 1, x: 0, y: 0, scale: 1 } as const;

/** Enviada: mola solta (passa um pouco do ponto e assenta). Recebida: contida. */
export const SEND_SPRING = SPRINGS.bouncy;
export const RECEIVE_SPRING = SPRINGS.soft;

/** Origem da escala: o balão cresce a partir do canto de onde "saiu". */
export const bubbleOrigin = (isMe: boolean) => (isMe ? "bottom right" : "bottom left");

/**
 * A mensagem ganhou o id real do servidor depois de aparecer como "local-…": a assinatura
 * (autor + texto) evita animar de novo o mesmo balão quando a `key` muda.
 */
export const messageSignature = (m: { senderId: string; text?: string | null; attachmentUrl?: string | null }) =>
  `${m.senderId}|${m.text ?? ""}|${m.attachmentUrl ?? ""}`;
