import { supabase } from "../supabase";
import { getOrCreateChannel, getVoiceRoomTopic, removeChannel } from "./channelLifecycle";
import type { CallAnswerPayload, CallEndPayload, CallInvitePayload } from "./types";

/**
 * Escuta chamadas recebidas direcionadas para o UID do usuário atual
 */
export const subscribeToUserIncomingCalls = (
  myUid: string,
  callbacks: {
    onInvite: (invite: CallInvitePayload) => void;
    onEnd: (end: CallEndPayload) => void;
  },
) => {
  const cleanUid = String(myUid || "").replace(/^cp-friend:/, "").trim();
  const channelName = `user_calls_${cleanUid}`;
  removeChannel(channelName);

  const channel = supabase.channel(channelName, {
    config: { broadcast: { self: false } },
  })
    .on("broadcast", { event: "call:invite" }, (e) => {
      if (e.payload && typeof e.payload === "object" && e.payload.callerId && e.payload.callerId !== cleanUid) {
        callbacks.onInvite(e.payload as CallInvitePayload);
      }
    })
    .on("broadcast", { event: "call:end" }, (e) => {
      if (e.payload && typeof e.payload === "object") {
        callbacks.onEnd(e.payload as CallEndPayload);
      }
    })
    .subscribe();

  // Also listen on inbox channel as fallback
  const inboxChannelName = `user_inbox_${cleanUid}`;
  const inboxChannel = supabase.channel(inboxChannelName, {
    config: { broadcast: { self: false } },
  })
    .on("broadcast", { event: "call:invite" }, (e) => {
      if (e.payload && typeof e.payload === "object" && e.payload.callerId && e.payload.callerId !== cleanUid) {
        callbacks.onInvite(e.payload as CallInvitePayload);
      }
    })
    .on("broadcast", { event: "call:end" }, (e) => {
      if (e.payload && typeof e.payload === "object") {
        callbacks.onEnd(e.payload as CallEndPayload);
      }
    })
    .subscribe();

  return () => {
    try {
      supabase.removeChannel(channel);
      supabase.removeChannel(inboxChannel);
    } catch { }
    removeChannel(channelName);
    removeChannel(inboxChannelName);
  };
};

/**
 * Envia um convite de chamada para o amigo por múltiplos canais para entrega garantida
 */
export const sendCallInvite = async (
  targetFriendUid: string,
  invite: CallInvitePayload,
) => {
  const cleanUid = String(targetFriendUid || "").replace(/^cp-friend:/, "").trim();
  let delivered = false;

  try {
    const channelCalls = await getOrCreateChannel(`user_calls_${cleanUid}`);
    if (channelCalls) {
      await channelCalls.send({
        type: "broadcast",
        event: "call:invite",
        payload: invite,
      });
      delivered = true;
    }
  } catch (err) {
    console.warn("[voiceCall/invite] send to user_calls failed:", cleanUid, err);
  }

  try {
    const channelInbox = await getOrCreateChannel(`user_inbox_${cleanUid}`);
    if (channelInbox) {
      await channelInbox.send({
        type: "broadcast",
        event: "call:invite",
        payload: invite,
      });
      delivered = true;
    }
  } catch (err) {
    console.warn("[voiceCall/invite] send to user_inbox failed:", cleanUid, err);
  }

  return delivered;
};

/**
 * Responde a uma chamada (aceitar ou rejeitar)
 */
export const sendCallAnswer = async (
  chatId: string,
  callerUid: string,
  answer: CallAnswerPayload,
) => {
  try {
    const sessionChannel = await getOrCreateChannel(getVoiceRoomTopic(chatId));
    if (sessionChannel) {
      await sessionChannel.send({
        type: "broadcast",
        event: "call:answer",
        payload: answer,
      });
    }
  } catch (err) {
    console.warn("[voiceCall/invite] sendCallAnswer session channel error:", err);
  }

  try {
    const cleanCallerUid = String(callerUid || "").replace(/^cp-friend:/, "").trim();
    const callerChannel = await getOrCreateChannel(`user_calls_${cleanCallerUid}`);
    if (callerChannel) {
      await callerChannel.send({
        type: "broadcast",
        event: "call:answer",
        payload: answer,
      });
    }
  } catch (err) {
    console.warn("[voiceCall/invite] sendCallAnswer direct channel error:", err);
  }
};
