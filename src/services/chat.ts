import { supabase } from "./supabase";
import type { ChatMessage } from "../types/domain";
import { apiUrl, getUsableSession } from "./api";
import { sendFastReadReceipt, sendFastU2UMessage, subscribeToGlobalEventBus } from "./realtimeEventBus";

const HISTORY_LIMIT = 50;
const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export const validateChatImage = (file: File) => {
  if (!ALLOWED_IMAGE_TYPES.has(file.type) || file.size <= 0 || file.size > MAX_IMAGE_SIZE) {
    throw new Error("Use uma imagem JPG, PNG, WEBP ou GIF de ate 8 MB.");
  }
};

const messageListeners = new Set<(message: ChatMessage) => void>();
const unreadListeners = new Set<(messages: ChatMessage[]) => void>();
const unreadMessages: ChatMessage[] = [];

const activeChatChannels = new Map<string, any>();
const openedChatIds = new Map<string, string>();
const openingChats = new Map<string, Promise<string>>();

export const getChatId = (uid1: string, uid2: string) =>
  [uid1, uid2].sort().join("_");

const messageTimestamp = (message: Pick<ChatMessage, "createdAt">) => {
  const timestamp = Date.parse(String(message.createdAt || ""));
  return Number.isFinite(timestamp) ? timestamp : 0;
};

export const compareChatMessages = (a: ChatMessage, b: ChatMessage) => {
  const firstSequence = Number(a.sequenceId);
  const secondSequence = Number(b.sequenceId);
  const firstHasSequence = Number.isSafeInteger(firstSequence) && firstSequence > 0;
  const secondHasSequence = Number.isSafeInteger(secondSequence) && secondSequence > 0;

  if (firstHasSequence && secondHasSequence && firstSequence !== secondSequence) {
    return firstSequence - secondSequence;
  }
  // Mensagens otimistas ainda não possuem a sequência do banco e ficam depois
  // de todas as mensagens já confirmadas.
  if (firstHasSequence !== secondHasSequence) return firstHasSequence ? -1 : 1;

  const timeDifference = messageTimestamp(a) - messageTimestamp(b);
  if (timeDifference !== 0) return timeDifference;
  return String(a.id || "").localeCompare(String(b.id || ""));
};

const emitUnread = () => {
  unreadMessages.sort(compareChatMessages);
  unreadListeners.forEach((listener) => listener([...unreadMessages]));
};

// Agrupa múltiplas notificações de "unread" em um único frame de renderização,
// evitando re-renders consecutivos quando mensagens chegam em burst.
let _emitUnreadScheduled = false;
const scheduleEmitUnread = () => {
  if (_emitUnreadScheduled) return;
  _emitUnreadScheduled = true;
  const dispatch = () => {
    _emitUnreadScheduled = false;
    emitUnread();
  };
  if (typeof requestAnimationFrame !== "undefined") {
    requestAnimationFrame(dispatch);
  } else {
    setTimeout(dispatch, 0);
  }
};

export const normalizeMessage = (
  id: string,
  value: Record<string, unknown>,
): ChatMessage => {
  let createdAtIso: string;
  if (typeof value.createdAt === "number") {
    createdAtIso = new Date(value.createdAt).toISOString();
  } else if (typeof value.created_at === "string" && value.created_at) {
    createdAtIso = value.created_at;
  } else {
    createdAtIso = new Date().toISOString();
  }

  return {
    id: id || String(value.id || ""),
    chatId: String(value.chatId || value.chat_id || ""),
    sequenceId: Number.isSafeInteger(Number(value.sequenceId ?? value.sequence_id))
      ? Number(value.sequenceId ?? value.sequence_id)
      : undefined,
    senderId: String(value.senderId || value.sender_id || ""),
    receiverId: String(value.receiverId || value.receiver_id || ""),
    text: String(value.text || ""),
    createdAt: createdAtIso,
    read: Boolean(value.read),
    attachmentName: typeof value.attachmentName === "string" ? value.attachmentName : typeof value.attachment_name === "string" ? value.attachment_name : undefined,
    attachmentUrl: typeof value.attachmentUrl === "string" ? value.attachmentUrl : typeof value.attachment_url === "string" ? value.attachment_url : undefined,
    attachmentType: typeof value.attachmentType === "string" ? value.attachmentType : typeof value.attachment_type === "string" ? value.attachment_type : undefined,
    attachmentSize: typeof value.attachmentSize === "number" ? value.attachmentSize : typeof value.attachment_size === "number" ? value.attachment_size : undefined,
    attachmentPath: typeof value.attachmentPath === "string" ? value.attachmentPath : typeof value.attachment_path === "string" ? value.attachment_path : undefined,
  };
};

const hydrateAttachmentUrl = async (message: ChatMessage): Promise<ChatMessage> => {
  if (!message.attachmentPath) return message;
  const { data, error } = await supabase.storage
    .from("attachments")
    .createSignedUrl(message.attachmentPath, 60 * 60);
  return {
    ...message,
    attachmentUrl: error ? undefined : data.signedUrl,
  };
};

export const ensureChatSession = async (
  currentUid: string,
  friendUid: string,
): Promise<string> => {
  const chatId = getChatId(currentUid, friendUid);
  const openedChatId = openedChatIds.get(chatId);
  if (openedChatId) return openedChatId;

  const pending = openingChats.get(chatId);
  if (pending) return pending;

  const sessionPromise = (async () => {
    try {
      const session = await getUsableSession();
      if (!session?.access_token || session.user.id !== currentUid) {
        throw new Error("Sessao expirada. Entre novamente.");
      }
      const response = await fetch(apiUrl("/api/chat/open"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ friendUid }),
      });
      const payload = await response.json().catch(() => ({})) as {
        chatId?: string;
        error?: string;
      };
      if (payload.chatId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.chatId)) {
        openedChatIds.set(chatId, payload.chatId);
        return payload.chatId;
      }
      throw new Error(payload.error || "Sessão de chat inválida.");
    } catch (err) {
      // Fallback: tentar recuperar chat compartilhado diretamente pelo Supabase
      try {
        const { data: myChats } = await supabase
          .from("chat_participants")
          .select("chat_id")
          .eq("user_id", currentUid);
        if (myChats && myChats.length > 0) {
          const myIds = myChats.map((c) => c.chat_id).filter(Boolean);
          const { data: shared } = await supabase
            .from("chat_participants")
            .select("chat_id")
            .eq("user_id", friendUid)
            .in("chat_id", myIds)
            .limit(1)
            .maybeSingle();
          if (shared?.chat_id) {
            openedChatIds.set(chatId, shared.chat_id);
            return shared.chat_id;
          }
        }
      } catch {}
      console.warn("[ensureChatSession] Não foi possível resolver UUID do chat:", err);
      return "";
    } finally {
      openingChats.delete(chatId);
    }
  })();

  openingChats.set(chatId, sessionPromise);
  return sessionPromise;
};

export const establishChatConnection = async () => {
  const session = await getUsableSession();
  if (!session?.user) return;
  const uid = session.user.id;
  subscribeToActiveChats(uid);
};

const processedMessageKeys = new Map<string, number>();

const isDuplicateIncomingMessage = (msg: ChatMessage): boolean => {
  const now = Date.now();
  processedMessageKeys.forEach((timestamp, key) => {
    if (now - timestamp > 15_000) processedMessageKeys.delete(key);
  });

  if (msg.id && processedMessageKeys.has(msg.id)) return true;

  const timeWindow = Math.floor(messageTimestamp(msg) / 6000);
  const signature = `${msg.senderId}_${msg.receiverId}_${msg.text.trim()}_${timeWindow}`;

  if (processedMessageKeys.has(signature)) return true;

  if (msg.id) processedMessageKeys.set(msg.id, now);
  processedMessageKeys.set(signature, now);
  return false;
};

export const subscribeToNewMessages = (callback: (message: ChatMessage) => void) => {
  messageListeners.add(callback);
  return () => {
    messageListeners.delete(callback);
  };
};

export const subscribeToActiveChats = (uid: string) => {
  const channelKey = `unread_${uid}`;
  if (activeChatChannels.has(channelKey)) {
    return () => undefined;
  }

  // 1. Fast-path WebSocket Event Bus listener (Sub-50ms instant delivery)
  const unsubFastBus = subscribeToGlobalEventBus(uid, {
    onMessage: (fastMsg) => {
      if (fastMsg.receiverId === uid) {
        if (isDuplicateIncomingMessage(fastMsg)) return;
        if (!unreadMessages.some((m) => m.id === fastMsg.id)) {
          unreadMessages.push(fastMsg);
          scheduleEmitUnread();
        }
        messageListeners.forEach((listener) => listener(fastMsg));
      }
    },
  });

  // 2. Inscreve no canal de tempo real postgres_changes como garantia de persistência
  const channel = supabase
    .channel(`user_chats_${uid}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "chat_messages", filter: `receiver_id=eq.${uid}` },
      async (payload) => {
        const msg = await hydrateAttachmentUrl(
          normalizeMessage(String(payload.new.id), payload.new as any),
        );
        if (isDuplicateIncomingMessage(msg)) return;
        if (!unreadMessages.some((m) => m.id === msg.id)) {
          unreadMessages.push(msg);
          scheduleEmitUnread();
        }
        messageListeners.forEach((listener) => listener(msg));
      }
    )
    .subscribe();
  activeChatChannels.set(channelKey, channel);

  void supabase
    .from("chat_messages")
    .select("*")
    .eq("receiver_id", uid)
    .eq("read", false)
    .order("sequence_id", { ascending: true })
    .limit(100)
    .then(async ({ data }) => {
      const messages = await Promise.all(
        (data || []).map((item) =>
          hydrateAttachmentUrl(normalizeMessage(String(item.id), item as any)),
        ),
      );
      messages.forEach((message) => {
        if (!unreadMessages.some((current) => current.id === message.id)) {
          unreadMessages.push(message);
        }
      });
      scheduleEmitUnread();
    });

  return () => {
    unsubFastBus();
    supabase.removeChannel(channel);
    activeChatChannels.delete(channelKey);
  };
};

export const closeChatConnection = () => {
  activeChatChannels.forEach((item) => {
    try {
      if (item) {
        if (typeof item.unsubFast === "function") item.unsubFast();
        if (item.channel && typeof item.channel.unsubscribe === "function") {
          supabase.removeChannel(item.channel);
        } else if (typeof item.unsubscribe === "function") {
          supabase.removeChannel(item);
        }
      }
    } catch {}
  });
  activeChatChannels.clear();
  unreadMessages.splice(0, unreadMessages.length);
  openedChatIds.clear();
  openingChats.clear();
  emitUnread();
};

export const sendChatMessage = async (
  receiverUid: string,
  rawText: string,
  attachment?: Pick<
    ChatMessage,
    "attachmentName" | "attachmentUrl" | "attachmentType" | "attachmentSize" | "attachmentPath"
  >,
): Promise<ChatMessage> => {
  const session = await getUsableSession();
  const senderId = session?.user?.id;
  const receiverId = String(receiverUid || "").trim();
  const text = String(rawText || "").trim();
  if (!senderId) throw new Error("Sessao expirada. Entre novamente.");
  if (!receiverId || receiverId === senderId) throw new Error("Destinatario invalido.");
  if ((!text && !attachment?.attachmentPath) || text.length > 50_000) {
    throw new Error("Mensagem invalida.");
  }

  const chatId = await ensureChatSession(senderId, receiverId);

  // Fast-Path via WebSocket (Instantâneo / Sub-50ms para o destinatário)
  const tempMsgId = `fast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const fastMsg: ChatMessage = {
    id: tempMsgId,
    chatId,
    senderId,
    receiverId,
    text,
    createdAt: new Date().toISOString(),
    read: false,
    attachmentName: attachment?.attachmentName,
    attachmentUrl: attachment?.attachmentUrl,
    attachmentType: attachment?.attachmentType,
    attachmentSize: attachment?.attachmentSize,
    attachmentPath: attachment?.attachmentPath,
  };

  void sendFastU2UMessage(receiverId, fastMsg);

  const newMsg = {
    chat_id: chatId,
    sender_id: senderId,
    receiver_id: receiverId,
    text,
    read: false,
    attachment_name: attachment?.attachmentName || null,
    attachment_url: attachment?.attachmentUrl || null,
    attachment_type: attachment?.attachmentType || null,
    attachment_size: attachment?.attachmentSize || null,
    attachment_path: attachment?.attachmentPath || null,
  };

  // Persistência em segundo plano / DB
  const { data, error } = await supabase.from("chat_messages").insert(newMsg).select().single();
  if (error || !data) {
    // Retorna mensagem temporária otimista mesmo se houver delay no banco
    return fastMsg;
  }

  return hydrateAttachmentUrl(normalizeMessage(String(data.id), data as any));
};

export const sendChatImage = async (
  receiverUid: string,
  file: File,
  caption = "",
): Promise<ChatMessage> => {
  const session = await getUsableSession();
  const senderId = session?.user?.id;
  if (!senderId) throw new Error("Sessao expirada. Entre novamente.");
  validateChatImage(file);

  const chatId = await ensureChatSession(senderId, receiverUid);
  const ext = file.name.split(".").pop() || "png";
  const path = `${chatId}/${Date.now()}_${crypto.randomUUID()}.${ext}`;

  const { data, error } = await supabase.storage.from("attachments").upload(path, file);
  if (error || !data) {
    throw new Error(error?.message || "Falha ao enviar a imagem.");
  }

  return sendChatMessage(receiverUid, caption.trim(), {
    attachmentName: file.name,
    attachmentType: file.type,
    attachmentSize: file.size,
    attachmentPath: data.path,
  });
};

const typingThrottleMap = new Map<string, { lastSentTime: number; isCurrentlyTyping: boolean; timeoutId: number | null }>();

const sendTypingPayload = async (friendUid: string, typing: boolean) => {
  try {
    const session = await getUsableSession();
    if (!session?.user) return;
    const uid = session.user.id;
    const chatId = await ensureChatSession(uid, friendUid);
    const channelKey = `typing_send_${chatId}`;
    let channel = activeChatChannels.get(channelKey);
    if (!channel || typeof channel.send !== "function") {
      channel = supabase.channel(`typing_${chatId}`);
      await new Promise<void>((resolve) => {
        const timeoutId = window.setTimeout(() => {
          resolve();
        }, 3000);
        channel.subscribe((status: string) => {
          if (status === "SUBSCRIBED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            window.clearTimeout(timeoutId);
            resolve();
          }
        });
      });
      activeChatChannels.set(channelKey, channel);
    }
    await channel.send({
      type: "broadcast",
      event: "typing",
      payload: { senderId: uid, typing },
    });
  } catch {}
};

export const setChatTyping = async (friendUid: string, typing: boolean) => {
  const now = Date.now();
  const state = typingThrottleMap.get(friendUid);

  if (!typing) {
    if (state?.timeoutId) {
      window.clearTimeout(state.timeoutId);
    }
    if (state?.isCurrentlyTyping) {
      typingThrottleMap.set(friendUid, { lastSentTime: now, isCurrentlyTyping: false, timeoutId: null });
      await sendTypingPayload(friendUid, false);
    }
    return;
  }

  // Throttle de ~2s: não reenvia se já foi enviado há menos de 2000ms
  if (state?.isCurrentlyTyping && now - state.lastSentTime < 2000) {
    if (state.timeoutId) window.clearTimeout(state.timeoutId);
    const timeoutId = window.setTimeout(() => {
      void setChatTyping(friendUid, false);
    }, 3500);
    typingThrottleMap.set(friendUid, { ...state, timeoutId });
    return;
  }

  if (state?.timeoutId) window.clearTimeout(state.timeoutId);
  const timeoutId = window.setTimeout(() => {
    void setChatTyping(friendUid, false);
  }, 3500);

  typingThrottleMap.set(friendUid, { lastSentTime: now, isCurrentlyTyping: true, timeoutId });
  await sendTypingPayload(friendUid, true);
};

export const cleanupExpiredChatMessages = async (friendUid: string) => {
  void friendUid;
};

export const markMessagesAsRead = async (friendUid: string) => {
  const session = await getUsableSession();
  if (!session?.user) return;
  const uid = session.user.id;
  const chatId = await ensureChatSession(uid, friendUid);

  await supabase
    .from("chat_messages")
    .update({ read: true })
    .eq("chat_id", chatId)
    .eq("receiver_id", uid)
    .eq("read", false);

  void sendFastReadReceipt(friendUid, uid, chatId);

  for (let index = unreadMessages.length - 1; index >= 0; index -= 1) {
    if (unreadMessages[index].senderId === friendUid) unreadMessages.splice(index, 1);
  }
  scheduleEmitUnread();
};

export const subscribeToChatMessages = (
  friendUid: string,
  callback: (messages: ChatMessage[]) => void,
) => {
  let cancelled = false;
  let latestMessages: ChatMessage[] = [];
  let activeKey = "";

  void getUsableSession().then(async (session) => {
    if (!session?.user || cancelled) return;
    const uid = session.user.id;
    const chatId = await ensureChatSession(uid, friendUid);
    if (cancelled) return;
    activeKey = chatId;

    supabase
      .from("chat_messages")
      .select("*")
      .eq("chat_id", chatId)
      .order("sequence_id", { ascending: false })
      .limit(HISTORY_LIMIT)
      .then(async ({ data }) => {
        if (data && !cancelled) {
          const historyMessages = await Promise.all(data.map((item) =>
            hydrateAttachmentUrl(normalizeMessage(String(item.id), item as any)),
          ));
          const mergedById = new Map<string, ChatMessage>();
          [...historyMessages, ...latestMessages].forEach((message) => {
            if (message.id) mergedById.set(message.id, message);
          });
          latestMessages = Array.from(mergedById.values()).sort(compareChatMessages);
          callback([...latestMessages]);
        }
      });

    // Fast-path WebSocket Event Bus listener for open chat window
    const unsubFast = subscribeToGlobalEventBus(uid, {
      onMessage: (fastMsg) => {
        if (cancelled) return;
        if (
          (fastMsg.senderId === friendUid && fastMsg.receiverId === uid) ||
          (fastMsg.senderId === uid && fastMsg.receiverId === friendUid) ||
          fastMsg.chatId === chatId
        ) {
          // Verify if already present by ID or already confirmed by Postgres
          const isAlreadyPresent = latestMessages.some(
            (current) =>
              current.id === fastMsg.id ||
              (!current.id?.startsWith("fast_") &&
                current.senderId === fastMsg.senderId &&
                current.text.trim() === fastMsg.text.trim() &&
                Math.abs(messageTimestamp(current) - messageTimestamp(fastMsg)) < 15000)
          );
          if (!isAlreadyPresent) {
            latestMessages = [...latestMessages, fastMsg].sort(compareChatMessages);
            callback([...latestMessages]);
          }
        }
      },
      onReadReceipt: (data) => {
        if (cancelled) return;
        if (data.chatId === chatId || data.readerUid === friendUid) {
          let changed = false;
          latestMessages = latestMessages.map((m) => {
            if (m.senderId === uid && !m.read) {
              changed = true;
              return { ...m, read: true };
            }
            return m;
          });
          if (changed) {
            callback([...latestMessages]);
          }
        }
      },
    });

    const channel = supabase
      .channel(`chat_${chatId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `chat_id=eq.${chatId}` },
        async (payload) => {
          const msg = await hydrateAttachmentUrl(
            normalizeMessage(String(payload.new.id), payload.new as any),
          );
          if (cancelled) return;

          // Check if there is a matching fast_ temporary message to replace
          const existingFastIndex = latestMessages.findIndex(
            (current) =>
              current.id?.startsWith("fast_") &&
              current.senderId === msg.senderId &&
              current.text.trim() === msg.text.trim() &&
              Math.abs(messageTimestamp(current) - messageTimestamp(msg)) < 15000
          );

          if (existingFastIndex !== -1) {
            latestMessages = latestMessages.map((item, idx) => (idx === existingFastIndex ? msg : item));
            callback([...latestMessages]);
            return;
          }

          if (!latestMessages.some((current) => current.id === msg.id)) {
            latestMessages = [...latestMessages, msg].sort(compareChatMessages);
            callback([...latestMessages]);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "chat_messages", filter: `chat_id=eq.${chatId}` },
        async (payload) => {
          const updatedMsg = await hydrateAttachmentUrl(
            normalizeMessage(String(payload.new.id), payload.new as any),
          );
          if (cancelled) return;
          let changed = false;
          latestMessages = latestMessages.map((m) => {
            if (m.id === updatedMsg.id) {
              changed = true;
              return { ...m, ...updatedMsg };
            }
            return m;
          });
          if (changed) {
            callback([...latestMessages]);
          }
        }
      )
      .subscribe();

    activeChatChannels.set(chatId, { channel, unsubFast });
  });

  return () => {
    cancelled = true;
    const item = activeChatChannels.get(activeKey);
    if (item) {
      if (typeof item.unsubFast === "function") item.unsubFast();
      if (item.channel) supabase.removeChannel(item.channel);
      else if (typeof item === "object") supabase.removeChannel(item);
      activeChatChannels.delete(activeKey);
    }
  };
};

const typingSubscriptionMap = new Map<string, { channel: any; count: number }>();

export const subscribeToFriendTyping = (
  friendUid: string,
  callback: (typing: boolean) => void,
) => {
  let cancelled = false;
  let resolvedChatId: string | null = null;

  const cleanup = () => {
    if (resolvedChatId) {
      const sub = typingSubscriptionMap.get(resolvedChatId);
      if (sub) {
        sub.count--;
        if (sub.count <= 0) {
          supabase.removeChannel(sub.channel);
          typingSubscriptionMap.delete(resolvedChatId);
        }
      }
    }
  };

  void getUsableSession().then(async (session) => {
    if (!session?.user || cancelled) return;
    const uid = session.user.id;
    const chatId = await ensureChatSession(uid, friendUid);
    if (cancelled) return;
    resolvedChatId = chatId;

    // Reuse existing channel if already subscribed for this chat
    let sub = typingSubscriptionMap.get(chatId);
    if (!sub) {
      const channel = supabase
        .channel(`typing_${chatId}`)
        .on("broadcast", { event: "typing" }, (event) => {
          const payload = event.payload;
          if (!payload) return;
          const senderId = String(payload.senderId || "").replace(/^cp-friend:/, "");
          const targetFriendUid = String(friendUid).replace(/^cp-friend:/, "");
          if (senderId === targetFriendUid) {
            callback(Boolean(payload.typing));
          }
        })
        .subscribe();
      sub = { channel, count: 0 };
      typingSubscriptionMap.set(chatId, sub);
    }
    sub.count++;
    activeChatChannels.set(`typing_receive_${chatId}`, sub.channel);
  });

  return () => {
    cancelled = true;
    cleanup();
  };
};

export const subscribeToUnreadMessages = (
  callback: (messages: ChatMessage[]) => void,
) => {
  unreadListeners.add(callback);
  callback([...unreadMessages]);
  return () => {
    unreadListeners.delete(callback);
  };
};

export const clearUnreadForFriend = (friendUid: string) => {
  let changed = false;
  for (let i = unreadMessages.length - 1; i >= 0; i -= 1) {
    if (unreadMessages[i].senderId === friendUid) {
      unreadMessages.splice(i, 1);
      changed = true;
    }
  }
  if (changed) emitUnread();
};
