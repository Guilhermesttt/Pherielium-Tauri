import { supabase } from "../supabase";
import { getOrCreateChannel, getVoiceRoomTopic, removeChannel } from "./channelLifecycle";
import type {
  CallAnswerPayload,
  CallEndPayload,
  CallKickPayload,
  CallMemberJoinedPayload,
  CallMemberLeftPayload,
  CallPrivacyPayload,
  CallSignalPayload,
  CallStatePayload,
} from "./types";

/**
 * Inscreve-se no canal da sessão ativa de chamada (chatId) para troca de sinais WebRTC e eventos
 */
export const subscribeToCallSession = (
  chatId: string,
  myUid: string,
  callbacks: {
    onAnswer?: (answer: CallAnswerPayload) => void;
    onSignal?: (signal: CallSignalPayload) => void;
    onState?: (state: CallStatePayload) => void;
    onEnd?: (end: CallEndPayload) => void;
    onKicked?: (kick: CallKickPayload) => void;
    onPrivacy?: (privacy: CallPrivacyPayload) => void;
    onMemberJoined?: (joined: CallMemberJoinedPayload) => void;
    onMemberLeft?: (left: CallMemberLeftPayload) => void;
  },
) => {
  const channelName = getVoiceRoomTopic(chatId);
  removeChannel(channelName);

  const channel = supabase.channel(channelName)
    .on("broadcast", { event: "call:answer" }, (e) => {
      if (e.payload && typeof e.payload === "object" && e.payload.responderId !== myUid) {
        callbacks.onAnswer?.(e.payload as CallAnswerPayload);
      }
    })
    .on("broadcast", { event: "call:signal" }, (e) => {
      if (e.payload && typeof e.payload === "object" && e.payload.senderId !== myUid) {
        const payload = e.payload as CallSignalPayload;
        // Se houver targetUid, entrega apenas se for destinado ao usuário atual
        if (!payload.targetUid || payload.targetUid === myUid) {
          callbacks.onSignal?.(payload);
        }
      }
    })
    .on("broadcast", { event: "call:state" }, (e) => {
      if (e.payload && typeof e.payload === "object" && e.payload.senderId !== myUid) {
        callbacks.onState?.(e.payload as CallStatePayload);
      }
    })
    .on("broadcast", { event: "call:kick" }, (e) => {
      if (e.payload && typeof e.payload === "object" && e.payload.targetUserId === myUid) {
        callbacks.onKicked?.(e.payload as CallKickPayload);
      }
    })
    .on("broadcast", { event: "call:privacy" }, (e) => {
      if (e.payload && typeof e.payload === "object") {
        callbacks.onPrivacy?.(e.payload as CallPrivacyPayload);
      }
    })
    .on("broadcast", { event: "call:member-joined" }, (e) => {
      if (e.payload && typeof e.payload === "object" && e.payload.uid !== myUid) {
        callbacks.onMemberJoined?.(e.payload as CallMemberJoinedPayload);
      }
    })
    .on("broadcast", { event: "call:member-left" }, (e) => {
      if (e.payload && typeof e.payload === "object" && e.payload.uid !== myUid) {
        callbacks.onMemberLeft?.(e.payload as CallMemberLeftPayload);
      }
    })
    .on("broadcast", { event: "call:end" }, (e) => {
      if (e.payload && typeof e.payload === "object" && e.payload.senderId !== myUid) {
        callbacks.onEnd?.(e.payload as CallEndPayload);
      }
    });

  channel.subscribe((status: string) => {
    if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
      console.warn("[voiceCall/signaling] Call session subscription issue:", status, "for", channelName);
    }
  });

  return () => {
    try {
      supabase.removeChannel(channel);
    } catch { }
    removeChannel(channelName);
  };
};

/**
 * Envia sinal WebRTC (SDP Offer / Answer ou ICE Candidate) com suporte a targetUid para Mesh
 */
export const sendCallSignal = async (
  chatId: string,
  signal: CallSignalPayload,
) => {
  const channel = await getOrCreateChannel(getVoiceRoomTopic(chatId));
  if (channel) {
    await channel.send({
      type: "broadcast",
      event: "call:signal",
      payload: signal,
    });
  }
};

/**
 * Encerra a chamada
 */
export const sendCallEnd = async (
  chatId: string,
  friendUid: string,
  endPayload: CallEndPayload,
) => {
  try {
    const sessionChannel = await getOrCreateChannel(getVoiceRoomTopic(chatId));
    if (sessionChannel) {
      await sessionChannel.send({
        type: "broadcast",
        event: "call:end",
        payload: endPayload,
      });
    }
  } catch (err) {
    console.warn("[voiceCall/signaling] sendCallEnd session error:", err);
  }

  if (friendUid && friendUid !== "room-all") {
    try {
      const cleanFriendUid = String(friendUid || "").replace(/^cp-friend:/, "").trim();
      const friendChannel = await getOrCreateChannel(`user_calls_${cleanFriendUid}`);
      if (friendChannel) {
        await friendChannel.send({
          type: "broadcast",
          event: "call:end",
          payload: endPayload,
        });
      }
    } catch (err) {
      console.warn("[voiceCall/signaling] sendCallEnd direct friend error:", err);
    }
  }
};
