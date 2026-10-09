import { supabase } from "./supabase";
import type { ChatMessage } from "../types/domain";
import { apiFetch, getUsableSession } from "./api";
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
    replyToId: typeof value.replyToId === "string" ? value.replyToId : typeof value.reply_to === "string" ? value.reply_to : undefined,
    editedAt: typeof value.editedAt === "string" ? value.editedAt : typeof value.edited_at === "string" ? value.edited_at : undefined,
    deletedAt: typeof value.deletedAt === "string" ? value.deletedAt : typeof value.deleted_at === "string" ? value.deleted_at : undefined,
    mentions: Array.isArray(value.mentions) ? value.mentions.map(String) : undefined,
    reactions: value.reactions && typeof value.reactions === "object" && !Array.isArray(value.reactions)
      ? value.reactions as Record<string, string[]>
      : undefined,
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
      const response = await apiFetch("/api/chat/open", {
        method: "POST",
        authenticated: true,
        headers: { "Content-Type": "application/json" },
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
  const unsubscribe = subscribeToActiveChats(uid);
  activeChatChannels.set(`active_${uid}`, { unsubFast: unsubscribe });
};

const processedMessageKeys = new Map<string, number>();

const isDuplicateIncomingMessage = (msg: ChatMessage): boolean => {
  const now = Date.now();
  processedMessageKeys.forEach((timestamp, key) => {
    if (now - timestamp > 15_000) processedMessageKeys.delete(key);
  });

  if (!msg.id || processedMessageKeys.has(msg.id)) return Boolean(msg.id);
  processedMessageKeys.set(msg.id, now);
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
  activeChatChannels.set(channelKey, { channel, unsubFast: unsubFastBus });

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

export type SendChatOptions = {
  replyToId?: string;
  mentions?: string[];
};

export const sendChatMessage = async (
  receiverUid: string,
  rawText: string,
  attachment?: Pick<
    ChatMessage,
    "attachmentName" | "attachmentUrl" | "attachmentType" | "attachmentSize" | "attachmentPath"
  >,
  options?: SendChatOptions,
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
    replyToId: options?.replyToId,
    mentions: options?.mentions,
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
    ...(options?.replyToId ? { reply_to: options.replyToId } : {}),
    ...(options?.mentions?.length ? { mentions: options.mentions } : {}),
  };

  // Persistência em segundo plano / DB
  const { data, error } = await supabase.from("chat_messages").insert(newMsg).select().single();
  if (error || !data) {
    // Retorna mensagem temporária otimista mesmo se houver delay no banco
    return fastMsg;
  }

  return hydrateAttachmentUrl(normalizeMessage(String(data.id), data as any));
};

const broadcastMessageUpdate = async (message: ChatMessage) => {
  if (message.receiverId) {
    void sendFastU2UMessage(message.receiverId, message);
  }
};

export const editChatMessage = async (message: ChatMessage, rawText: string): Promise<ChatMessage> => {
  const session = await getUsableSession();
  if (!session?.user || session.user.id !== message.senderId) {
    throw new Error("Só é possível editar a própria mensagem.");
  }
  const text = rawText.trim();
  if (!text || !message.id || message.id.startsWith("local-") || message.id.startsWith("fast_")) {
    throw new Error("Mensagem ainda não confirmada.");
  }
  const editedAt = new Date().toISOString();
  const { error } = await supabase.from("chat_messages").update({ text, edited_at: editedAt }).eq("id", message.id);
  if (error) throw new Error(error.message);
  const next = { ...message, text, editedAt };
  await broadcastMessageUpdate(next);
  return next;
};

export const deleteChatMessage = async (message: ChatMessage): Promise<ChatMessage> => {
  const session = await getUsableSession();
  if (!session?.user || session.user.id !== message.senderId) {
    throw new Error("Só é possível apagar a própria mensagem.");
  }
  if (!message.id || message.id.startsWith("local-") || message.id.startsWith("fast_")) {
    throw new Error("Mensagem ainda não confirmada.");
  }
  const deletedAt = new Date().toISOString();
  const { error } = await supabase.from("chat_messages").update({ text: "", deleted_at: deletedAt }).eq("id", message.id);
  if (error) throw new Error(error.message);
  const next = { ...message, text: "", deletedAt };
  await broadcastMessageUpdate(next);
  return next;
};

export const toggleChatReaction = async (message: ChatMessage, emoji: string, userId: string): Promise<ChatMessage> => {
  if (!message.id || message.id.startsWith("local-") || message.id.startsWith("fast_")) {
    throw new Error("Mensagem ainda não confirmada.");
  }
  // RPC atômica (migration 20261009100600): duas reações simultâneas não se sobrescrevem mais.
  // Se o RPC ainda não existir no banco, cai no caminho antigo (ler, mexer e gravar).
  let reactions: Record<string, string[]>;
  const rpc = await supabase.rpc("toggle_chat_reaction", { p_message_id: message.id, p_emoji: emoji });
  if (!rpc.error) {
    reactions = (rpc.data as Record<string, string[]> | null) ?? {};
  } else if (rpc.error.code === "PGRST202" || /does not exist|Could not find the function/i.test(rpc.error.message)) {
    reactions = { ...(message.reactions || {}) };
    const current = new Set(reactions[emoji] || []);
    if (current.has(userId)) current.delete(userId);
    else current.add(userId);
    reactions[emoji] = Array.from(current);
    if (reactions[emoji].length === 0) delete reactions[emoji];
    const { error } = await supabase.from("chat_messages").update({ reactions }).eq("id", message.id);
    if (error) throw new Error(error.message);
  } else {
    throw new Error(rpc.error.message);
  }
  const next = { ...message, reactions };
  await broadcastMessageUpdate(next);
  return next;
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
  onError?: (error: Error) => void,
) => {
  let cancelled = false;
  let latestMessages: ChatMessage[] = [];
  let unsubFast: (() => void) | null = null;
  let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;

  const reportError = (message: string, cause?: unknown) => {
    if (cancelled) return;
    const error = cause instanceof Error ? cause : new Error(message);
    if (!(cause instanceof Error)) {
      error.message = message;
    }
    onError?.(error);
  };

  const deliverMessages = (messages: ChatMessage[]) => {
    if (cancelled) return;
    callback([...messages]);
  };

  void (async () => {
    try {
      const session = await getUsableSession();
      if (cancelled) return;
      if (!session?.user) {
        reportError("Sessao expirada. Entre novamente.");
        return;
      }

      const uid = session.user.id;
      const chatId = await ensureChatSession(uid, friendUid);
      if (cancelled) return;
      if (!chatId) {
        reportError("Sessao de chat invalida.");
        return;
      }

      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("chat_id", chatId)
        .order("sequence_id", { ascending: false })
        .limit(HISTORY_LIMIT);

      if (cancelled) return;
      if (error) {
        reportError(error.message || "Erro ao carregar historico do chat.", error);
        return;
      }

      const historyMessages = await Promise.all(
        (data || []).map((item) =>
          hydrateAttachmentUrl(normalizeMessage(String(item.id), item as any)),
        ),
      );
      if (cancelled) return;

      const mergedById = new Map<string, ChatMessage>();
      [...historyMessages, ...latestMessages].forEach((message) => {
        if (message.id) mergedById.set(message.id, message);
      });
      latestMessages = Array.from(mergedById.values()).sort(compareChatMessages);
      deliverMessages(latestMessages);

      if (cancelled) return;
      unsubFast = subscribeToGlobalEventBus(uid, {
        onMessage: (fastMsg) => {
          if (cancelled) return;
          if (
            (fastMsg.senderId === friendUid && fastMsg.receiverId === uid) ||
            (fastMsg.senderId === uid && fastMsg.receiverId === friendUid) ||
            fastMsg.chatId === chatId
          ) {
            const existingIndex = latestMessages.findIndex((current) => current.id === fastMsg.id);
            if (existingIndex !== -1) {
              latestMessages = latestMessages.map((item, index) => (index === existingIndex ? { ...item, ...fastMsg } : item));
              deliverMessages(latestMessages);
              return;
            }
            const isAlreadyPresent = latestMessages.some(
              (current) =>
                !current.id?.startsWith("fast_") &&
                current.senderId === fastMsg.senderId &&
                current.text.trim() === fastMsg.text.trim() &&
                Math.abs(messageTimestamp(current) - messageTimestamp(fastMsg)) < 15000,
            );
            if (!isAlreadyPresent) {
              latestMessages = [...latestMessages, fastMsg].sort(compareChatMessages);
              deliverMessages(latestMessages);
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
              deliverMessages(latestMessages);
            }
          }
        },
      });

      if (cancelled) {
        unsubFast?.();
        unsubFast = null;
        return;
      }

      const channel = supabase
        .channel(`chat_${chatId}_${Math.random().toString(36).slice(2, 8)}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "chat_messages", filter: `chat_id=eq.${chatId}` },
          async (payload) => {
            const msg = await hydrateAttachmentUrl(
              normalizeMessage(String(payload.new.id), payload.new as any),
            );
            if (cancelled) return;

            const existingFastIndex = latestMessages.findIndex(
              (current) =>
                current.id?.startsWith("fast_") &&
                current.senderId === msg.senderId &&
                current.text.trim() === msg.text.trim() &&
                Math.abs(messageTimestamp(current) - messageTimestamp(msg)) < 15000,
            );

            if (existingFastIndex !== -1) {
              latestMessages = latestMessages.map((item, idx) => (idx === existingFastIndex ? msg : item));
              deliverMessages(latestMessages);
              return;
            }

            if (!latestMessages.some((current) => current.id === msg.id)) {
              latestMessages = [...latestMessages, msg].sort(compareChatMessages);
              deliverMessages(latestMessages);
            }
          },
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
              deliverMessages(latestMessages);
            }
          },
        )
      realtimeChannel = channel;
      if (cancelled) {
        unsubFast?.();
        unsubFast = null;
        supabase.removeChannel(channel);
        realtimeChannel = null;
        return;
      }
      channel.subscribe();
    } catch (err) {
      if (!cancelled) {
        reportError(
          err instanceof Error ? err.message : "Erro ao iniciar conversa.",
          err,
        );
      }
    }
  })();

  return () => {
    cancelled = true;
    if (unsubFast) unsubFast();
    if (realtimeChannel) supabase.removeChannel(realtimeChannel);
    unsubFast = null;
    realtimeChannel = null;
  };
};

const typingSubscriptionMap = new Map<string, {
  channel: ReturnType<typeof supabase.channel>;
  callbacks: Set<(typing: boolean) => void>;
}>();

export const subscribeToFriendTyping = (
  friendUid: string,
  callback: (typing: boolean) => void,
) => {
  let cancelled = false;
  let resolvedChatId: string | null = null;
  const listener = (typing: boolean) => callback(typing);

  const cleanup = () => {
    if (!resolvedChatId) return;
    const sub = typingSubscriptionMap.get(resolvedChatId);
    if (!sub) return;
    sub.callbacks.delete(listener);
    if (sub.callbacks.size === 0) {
      supabase.removeChannel(sub.channel);
      typingSubscriptionMap.delete(resolvedChatId);
      activeChatChannels.delete(`typing_receive_${resolvedChatId}`);
    }
  };

  void getUsableSession().then(async (session) => {
    if (!session?.user || cancelled) return;
    const uid = session.user.id;
    const chatId = await ensureChatSession(uid, friendUid);
    if (!chatId || cancelled) return;
    resolvedChatId = chatId;

    let sub = typingSubscriptionMap.get(chatId);
    if (!sub) {
      const callbacks = new Set<(typing: boolean) => void>();
      const targetFriendUid = String(friendUid).replace(/^cp-friend:/, "");
      const channel = supabase
        .channel(`typing_${chatId}`)
        .on("broadcast", { event: "typing" }, (event) => {
          const payload = event.payload;
          if (!payload) return;
          const senderId = String(payload.senderId || "").replace(/^cp-friend:/, "");
          if (senderId !== targetFriendUid) return;
          typingSubscriptionMap.get(chatId)?.callbacks.forEach((notify) => {
            notify(Boolean(payload.typing));
          });
        })
        .subscribe();
      sub = { channel, callbacks };
      typingSubscriptionMap.set(chatId, sub);
    }
    if (cancelled) {
      cleanup();
      return;
    }
    sub.callbacks.add(listener);
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
