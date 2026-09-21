import { getOrCreateChannel, getVoiceRoomTopic } from "./channelLifecycle";
import type {
  CallKickPayload,
  CallMemberJoinedPayload,
  CallMemberLeftPayload,
  CallPrivacyPayload,
  CallStatePayload,
} from "./types";

/**
 * Envia atualização de estado (mute, deafen, falando, compartilhando tela)
 */
export const sendCallState = async (
  chatId: string,
  state: CallStatePayload,
) => {
  const channel = await getOrCreateChannel(getVoiceRoomTopic(chatId));
  if (channel) {
    await channel.send({
      type: "broadcast",
      event: "call:state",
      payload: state,
    });
  }
};

/**
 * Notifica que um novo membro entrou na sala
 */
export const sendCallMemberJoined = async (
  chatId: string,
  joinedPayload: CallMemberJoinedPayload,
) => {
  const sessionChannel = await getOrCreateChannel(getVoiceRoomTopic(chatId));
  if (sessionChannel) {
    await sessionChannel.send({
      type: "broadcast",
      event: "call:member-joined",
      payload: joinedPayload,
    });
  }
};

/**
 * Notifica que um membro saiu da sala
 */
export const sendCallMemberLeft = async (
  chatId: string,
  leftPayload: CallMemberLeftPayload,
) => {
  const sessionChannel = await getOrCreateChannel(getVoiceRoomTopic(chatId));
  if (sessionChannel) {
    await sessionChannel.send({
      type: "broadcast",
      event: "call:member-left",
      payload: leftPayload,
    });
  }
};

/**
 * Expulsa um participante da chamada (Admin action)
 */
export const sendCallKick = async (
  chatId: string,
  targetUserId: string,
  kickPayload: CallKickPayload,
) => {
  const sessionChannel = await getOrCreateChannel(getVoiceRoomTopic(chatId));
  if (sessionChannel) {
    await sessionChannel.send({
      type: "broadcast",
      event: "call:kick",
      payload: kickPayload,
    });
  }

  const cleanTargetUid = String(targetUserId || "").replace(/^cp-friend:/, "").trim();
  const friendChannel = await getOrCreateChannel(`user_calls_${cleanTargetUid}`);
  if (friendChannel) {
    await friendChannel.send({
      type: "broadcast",
      event: "call:kick",
      payload: kickPayload,
    });
  }
};

/**
 * Envia atualização de privacidade e senha da sala (Admin action)
 */
export const sendCallPrivacyUpdate = async (
  chatId: string,
  privacyPayload: CallPrivacyPayload,
) => {
  const sessionChannel = await getOrCreateChannel(getVoiceRoomTopic(chatId));
  if (sessionChannel) {
    await sessionChannel.send({
      type: "broadcast",
      event: "call:privacy",
      payload: privacyPayload,
    });
  }
};
