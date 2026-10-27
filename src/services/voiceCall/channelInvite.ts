import type { RoomCategory } from "../../types/voice-governance";

/** Tipo de "noite" que o convite anuncia; quem convida escolhe, e o amigo vê no aviso. */
export type NightKind = "game" | "movie" | "chat";

const NIGHT_KINDS: readonly NightKind[] = ["game", "movie", "chat"];
export const isNightKind = (value: unknown): value is NightKind =>
  typeof value === "string" && (NIGHT_KINDS as readonly string[]).includes(value);

/**
 * Convite para entrar numa sala de voz, enviado como cartão no chat privado do amigo
 * (o `CallInviteCard` lê este formato). Centralizado aqui para o modal de convidar e a
 * "Noite de jogo" mandarem exatamente o mesmo cartão.
 */
export interface ChannelInviteInput {
  /** id da sala de voz (é o `chatId` do cartão) */
  roomId: string;
  roomName: string;
  category: RoomCategory;
  isPrivate: boolean;
  callerName: string;
  callerAvatar?: string | null;
  /** convite de uma "noite" (jogo, cinema...); ausente nos convites comuns de canal */
  nightKind?: NightKind;
}

export interface ChannelInvitePayload {
  __type: "call_invite";
  chatId: string;
  roomName: string;
  category: RoomCategory;
  callerName: string;
  callerAvatar: string | null;
  isPrivate: boolean;
  createdAt: number;
  nightKind?: NightKind;
}

/** Imagens embutidas (`data:`) são grandes demais para ir numa mensagem; só URLs de verdade. */
const sendableAvatar = (url?: string | null) => (url && !url.startsWith("data:") ? url : null);

export function buildChannelInvitePayload(input: ChannelInviteInput, now = Date.now()): ChannelInvitePayload {
  return {
    __type: "call_invite",
    chatId: input.roomId,
    roomName: input.roomName,
    category: input.category,
    callerName: input.callerName,
    callerAvatar: sendableAvatar(input.callerAvatar),
    isPrivate: input.isPrivate,
    createdAt: now,
    ...(input.nightKind ? { nightKind: input.nightKind } : {}),
  };
}
