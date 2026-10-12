import { supabase } from "./supabase";
import { getOrCreateChannel } from "./voiceCall/channelLifecycle";
import type { ChatMessage } from "../types/domain";
import type { CallEndPayload, CallInvitePayload } from "./voiceCall/types";
import { presenceDebugLog, shortUid } from "./presenceDebug";
import { recordPeerProtocol } from "./peerProtocol";

export type UserPresenceStatus = "online" | "playing" | "streaming" | "in_call" | "idle" | "dnd" | "offline";

export interface PresencePayload {
  uid: string;
  displayName: string;
  photoURL?: string | null;
  status: UserPresenceStatus;
  playing?: string | null;
  updatedAt: number;
  /** Versão do protocolo do remetente (ausente = protocolo 1, app antigo). Ver src/lib/protocolVersion.ts. */
  pv?: number;
  /** Versão do app do remetente (só informativo). */
  av?: string;
}

export interface U2UEventHandlers {
  onMessage?: (msg: ChatMessage) => void;
  onReadReceipt?: (data: { readerUid: string; chatId: string }) => void;
  onStatusUpdate?: (presence: PresencePayload) => void;
  onTyping?: (data: { senderId: string; typing: boolean }) => void;
  onFriendRequest?: (data: { fromUid: string; fromName: string; fromAvatar?: string | null }) => void;
  onFriendAccepted?: (data: { friendUid: string; friendName: string; friendAvatar?: string | null }) => void;
  onFriendRemoved?: (data: { fromUid: string }) => void;
  onCustomEvent?: (event: string, payload: any) => void;
  onCallInvite?: (invite: CallInvitePayload) => void;
  onCallEnd?: (end: CallEndPayload) => void;
}

let inboxChannel: any = null;
let presenceChannel: any = null;
const globalEventHandlers = new Set<U2UEventHandlers>();
const activeInboxChannels = new Map<string, any>();
const sentMessageIds = new Set<string>();

let presenceAudienceUids = new Set<string>();
let presenceSelfUid: string | null = null;

const PRESENCE_FANOUT_CHUNK = 20;

// Refcount + idle close management for per-user inbox channels created on-demand.
const channelRefCounts = new Map<string, number>();
const channelIdleTimers = new Map<string, ReturnType<typeof setTimeout>>();
const INBOX_CHANNEL_IDLE_MS = 30_000; // close channels after 30s idle

/**
 * Restrict presence delivery to an explicit friend audience (plus self).
 * Replaces the previous audience set with cleaned UIDs.
 */
export const setPresenceAudience = (friendUids: string[]) => {
  presenceAudienceUids = new Set(
    friendUids
      .map((uid) => String(uid || "").trim())
      .filter(Boolean),
  );
};

/**
 * True for self, or for UIDs in the friend audience.
 * When the audience is empty, strangers are ignored (self still allowed).
 */
export const isPresenceAudienceMember = (uid: string): boolean => {
  if (!uid) return false;
  if (presenceSelfUid && uid === presenceSelfUid) return true;
  return presenceAudienceUids.has(uid);
};

/** Snapshot of the current friend audience UIDs (for optional send-side fan-out). */
export const getPresenceAudienceUids = (): string[] => Array.from(presenceAudienceUids);

/** De onde veio a atualização de presença (só para diagnóstico; não altera o comportamento). */
type PresenceSource = "inbox" | "bus-broadcast" | "presence-sync" | "presence-join" | "presence-leave";

const deliverPresenceStatusUpdate = (presence: PresencePayload, source: PresenceSource) => {
  const accepted = Boolean(presence?.uid) && isPresenceAudienceMember(presence.uid);
  presenceDebugLog("presence_received", {
    source,
    uid: shortUid(presence?.uid),
    status: presence?.status,
    playing: presence?.playing ? "yes" : "no",
    accepted,
    // diferença entre o relógio do remetente e o deste cliente; o plano avalia trocar por relógio do servidor
    skewMs: typeof presence?.updatedAt === "number" ? Date.now() - presence.updatedAt : null,
  });
  if (!accepted) return;
  // O app novo anuncia `pv`; é assim que se descobre, por par, quem aceita DM sem texto no fast-path.
  recordPeerProtocol(presence.uid, presence.pv);
  cancelPendingLeave(presence.uid);
  globalEventHandlers.forEach((h) => h.onStatusUpdate?.(presence));
};

/**
 * Canais usados só para ENVIAR. Nunca entram em `subscribe()`: servem apenas
 * como handle para o POST do `httpSend`, então criar um custa um objeto.
 */
type SenderChannel = ReturnType<typeof supabase.channel>;
const senderChannels = new Map<string, SenderChannel>();

/** Teto de handles guardados; além disso descarta o mais antigo (Map é ordenado). */
const MAX_SENDER_CHANNELS = 50;

const getSenderChannel = (channelName: string) => {
  const existing = senderChannels.get(channelName);
  if (existing) {
    // reinsere para virar o mais recente
    senderChannels.delete(channelName);
    senderChannels.set(channelName, existing);
    return existing;
  }
  const channel = supabase.channel(channelName, {
    config: { broadcast: { self: false } },
  });
  senderChannels.set(channelName, channel);
  while (senderChannels.size > MAX_SENDER_CHANNELS) {
    const oldest = senderChannels.keys().next().value as string | undefined;
    if (!oldest) break;
    const stale = senderChannels.get(oldest);
    senderChannels.delete(oldest);
    if (!stale) continue;
    // nunca entrou em subscribe(), então só precisa sair do registro do cliente
    try {
      supabase.removeChannel(stale);
    } catch {
      /* handle já descartado; nada a desfazer */
    }
  }
  return channel;
};

/** Uma vez por processo: servidor Realtime antigo não tem o endpoint HTTP. */
let httpBroadcastUnavailable = false;

/**
 * Entrega um evento na caixa de entrada de outro usuário.
 *
 * Antes isto chamava `getOrCreateChannel`, que faz o handshake de JOIN do
 * WebSocket **no canal do destinatário** antes de poder enviar -- com timeout
 * de 12s e backoff de 1s/2s/4s. Como os canais ociosos fecham em 30s, toda
 * primeira mensagem (e toda mensagem depois de meio minuto de silêncio) pagava
 * o join inteiro antes de o "caminho rápido" começar. Na prática ele chegava
 * depois do INSERT no banco.
 *
 * `httpSend` publica o broadcast por um único POST, sem entrar no canal: uma
 * ida e volta em vez de um handshake. O join só é usado como contingência se o
 * servidor Realtime for antigo demais para o endpoint.
 */
const broadcastToUserInbox = async (
  receiverUid: string,
  event: string,
  payload: unknown,
): Promise<boolean> => {
  const channelName = `user_inbox_${receiverUid}`;

  if (!httpBroadcastUnavailable) {
    try {
      await getSenderChannel(channelName).httpSend(
        event,
        payload as Record<string, unknown>,
      );
      return true;
    } catch (err) {
      // 404 = servidor Realtime sem o endpoint. Qualquer outro erro é
      // pontual (rede), e aí vale tentar o caminho do WebSocket desta vez.
      if (err instanceof Error && err.message.includes("requires Realtime server")) {
        httpBroadcastUnavailable = true;
        console.warn("[realtimeEventBus] httpSend indisponivel; usando WebSocket.", err);
      }
    }
  }

  try {
    const targetChannel = await getOrCreateChannel(channelName);
    if (!targetChannel) return false;

    activeInboxChannels.set(channelName, targetChannel);
    await targetChannel.send({ type: "broadcast" as const, event, payload });
    return true;
  } catch (err) {
    console.warn(`[realtimeEventBus] broadcast ${event} failed for ${channelName}:`, err);
    return false;
  }
};

const sendPresenceToFriendInbox = async (receiverUid: string, presence: PresencePayload) => {
  const channelName = `user_inbox_${receiverUid}`;
  await broadcastToUserInbox(receiverUid, "u2u:status", presence);

  if ((channelRefCounts.get(channelName) || 0) <= 0) {
    const targetChannel = activeInboxChannels.get(channelName);
    if (targetChannel) {
      scheduleChannelIdleClose(channelName, targetChannel);
    }
  }
};

function scheduleChannelIdleClose(channelName: string, channelObj: any) {
  if (channelIdleTimers.has(channelName)) return;
  const t = setTimeout(() => {
    try {
      channelObj?.unsubscribe?.();
    } catch { }
    try {
      supabase.removeChannel(channelObj);
    } catch { }
    activeInboxChannels.delete(channelName);
    channelRefCounts.delete(channelName);
    channelIdleTimers.delete(channelName);
  }, INBOX_CHANNEL_IDLE_MS);
  // @ts-ignore
  channelIdleTimers.set(channelName, t);
}

function cancelChannelIdleClose(channelName: string) {
  const t = channelIdleTimers.get(channelName);
  if (t) {
    clearTimeout(t);
    channelIdleTimers.delete(channelName);
  }
}

const presenceLeaveTimers = new Map<string, ReturnType<typeof setTimeout>>();

function cancelPendingLeave(uid: string) {
  const existingTimer = presenceLeaveTimers.get(uid);
  if (existingTimer) {
    clearTimeout(existingTimer);
    presenceLeaveTimers.delete(uid);
  }
}

/**
 * Inscreve no canal pessoal de eventos U2U (Mensagens rápidas, convites e notificações diretas)
 */
export const subscribeToGlobalEventBus = (
  myUid: string,
  handlers: U2UEventHandlers,
) => {
  globalEventHandlers.add(handlers);
  if (myUid) {
    presenceSelfUid = myUid;
  }

  if (!inboxChannel && myUid) {
    const channelName = `user_inbox_${myUid}`;
    inboxChannel = supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    });

    inboxChannel
      .on("broadcast", { event: "u2u:message" }, (e: any) => {
        if (e.payload && typeof e.payload === "object") {
          const msg = e.payload as ChatMessage;
          globalEventHandlers.forEach((h) => h.onMessage?.(msg));
        }
      })
      .on("broadcast", { event: "u2u:read_receipt" }, (e: any) => {
        if (e.payload && typeof e.payload === "object") {
          globalEventHandlers.forEach((h) => h.onReadReceipt?.(e.payload));
        }
      })
      .on("broadcast", { event: "u2u:status" }, (e: any) => {
        if (e.payload && typeof e.payload === "object") {
          deliverPresenceStatusUpdate(e.payload as PresencePayload, "inbox");
        }
      })
      .on("broadcast", { event: "u2u:typing" }, (e: any) => {
        if (e.payload && typeof e.payload === "object") {
          globalEventHandlers.forEach((h) => h.onTyping?.(e.payload));
        }
      })
      .on("broadcast", { event: "u2u:friend_request" }, (e: any) => {
        if (e.payload && typeof e.payload === "object") {
          globalEventHandlers.forEach((h) => h.onFriendRequest?.(e.payload));
        }
      })
      .on("broadcast", { event: "u2u:friend_accepted" }, (e: any) => {
        if (e.payload && typeof e.payload === "object") {
          globalEventHandlers.forEach((h) => h.onFriendAccepted?.(e.payload));
        }
      })
      .on("broadcast", { event: "u2u:friend_removed" }, (e: any) => {
        if (e.payload && typeof e.payload === "object") {
          globalEventHandlers.forEach((h) => h.onFriendRemoved?.(e.payload));
        }
      })
      .on("broadcast", { event: "u2u:custom" }, (e: any) => {
        if (e.payload && typeof e.payload === "object") {
          globalEventHandlers.forEach((h) => h.onCustomEvent?.(e.payload.event, e.payload.data));
        }
      })
      .on("broadcast", { event: "call:invite" }, (e: any) => {
        if (e.payload && typeof e.payload === "object") {
          globalEventHandlers.forEach((h) => h.onCallInvite?.(e.payload as CallInvitePayload));
        }
      })
      .on("broadcast", { event: "call:end" }, (e: any) => {
        if (e.payload && typeof e.payload === "object") {
          globalEventHandlers.forEach((h) => h.onCallEnd?.(e.payload as CallEndPayload));
        }
      });

    // non-blocking subscribe (do not await SUBSCRIBED here to avoid blocking callers)
    try {
      inboxChannel.subscribe((status: string) => {
        if (status === "SUBSCRIBED") {
          // connected to personal inbox
        }
      });
    } catch (err) {
      // ignore subscribe errors silently — presence of the channel object is sufficient
    }
  }

  // Inscreve também no canal global de Presence para sincronização instantânea de status de amigos
  if (!presenceChannel) {
    presenceChannel = supabase.channel("checkpoint_presence_bus", {
      config: {
        presence: {
          key: myUid || "guest",
        },
      },
    });

    presenceDebugLog("presence_key", { key: shortUid(myUid), channel: "checkpoint_presence_bus" });

    presenceChannel
      .on("broadcast", { event: "presence:status_update" }, (e: any) => {
        if (e.payload && typeof e.payload === "object") {
          deliverPresenceStatusUpdate(e.payload as PresencePayload, "bus-broadcast");
        }
      })
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel.presenceState();
        Object.values(state).forEach((presences: any) => {
          if (Array.isArray(presences)) {
            presences.forEach((p: any) => {
              if (p.presence && p.presence.uid) {
                deliverPresenceStatusUpdate(p.presence, "presence-sync");
              }
            });
          }
        });
      })
      .on("presence", { event: "join" }, ({ newPresences }: any) => {
        if (Array.isArray(newPresences)) {
          newPresences.forEach((p: any) => {
            if (p.presence && p.presence.uid) {
              deliverPresenceStatusUpdate(p.presence, "presence-join");
            }
          });
        }
      })
      .on("presence", { event: "leave" }, ({ key, leftPresences }: any) => {
        // Diagnóstico: o `leave` abaixo vira OFFLINE imediato para quem assiste. Registra a chave e quantas
        // presenças saíram, para separar "saiu de verdade" de "uma de duas instâncias da mesma conta saiu".
        presenceDebugLog("presence_leave_raw", {
          key: shortUid(key),
          leftCount: Array.isArray(leftPresences) ? leftPresences.length : 0,
        });
        const presences = Array.isArray(leftPresences) && leftPresences.length > 0 ? leftPresences : [{}];
        presences.forEach((p: any) => {
          const uid = p?.presence?.uid || p?.uid || (key && key !== "guest" ? key : null);
          if (uid) {
            // Notifica imediatamente em tempo real sem atraso
            deliverPresenceStatusUpdate({
              uid,
              displayName: p?.presence?.displayName || p?.displayName || "Jogador",
              photoURL: p?.presence?.photoURL || p?.photoURL || null,
              status: "offline",
              playing: null,
              updatedAt: Date.now(),
            }, "presence-leave");
          }
        });
      });

    try {
      presenceChannel.subscribe((status: string) => {
        presenceDebugLog("presence_channel_status", { status });
      });
    } catch (error) {
      console.warn("[realtimeEventBus] subscribe do canal de presença falhou:", error);
    }
  }

  const unsubscribe = () => {
    globalEventHandlers.delete(handlers);
    // If no more handlers remain, clean up inbox/presence channels to free resources
    if (globalEventHandlers.size === 0) {
      try {
        inboxChannel?.unsubscribe?.();
      } catch { }
      try {
        if (inboxChannel) supabase.removeChannel(inboxChannel);
      } catch { }
      inboxChannel = null;

      try {
        presenceChannel?.unsubscribe?.();
      } catch { }
      try {
        if (presenceChannel) supabase.removeChannel(presenceChannel);
      } catch { }
      presenceChannel = null;
    }
  };

  return unsubscribe;
};

/**
 * Emite uma mudança de status / jogo em tempo real via WebSocket para amigos conectados.
 * Prefers per-friend inbox fan-out; skips global presence:status_update when an audience is known.
 */
export const broadcastPresenceStatus = async (
  presence: PresencePayload,
  friendUids?: string[],
) => {
  try {
    if (!presenceChannel) {
      presenceChannel = supabase.channel("checkpoint_presence_bus", {
        config: {
          presence: {
            key: presence.uid || "guest",
          },
        },
      });
      // Diagnóstico: este canal foi criado AQUI, sem os ouvintes de join/leave/sync (que só são ligados em
      // subscribeToGlobalEventBus e somente quando `presenceChannel` ainda é nulo).
      presenceDebugLog("presence_key", {
        key: shortUid(presence.uid),
        channel: "checkpoint_presence_bus",
        createdWithoutListeners: true,
      });
      try {
        presenceChannel.subscribe((status: string) => {
          presenceDebugLog("presence_channel_status", { status, createdBy: "broadcastPresenceStatus" });
        });
      } catch (error) {
        console.warn("[realtimeEventBus] subscribe do canal de presença falhou:", error);
      }
    }

    const audience =
      friendUids !== undefined
        ? friendUids.map((uid) => String(uid || "").trim()).filter(Boolean)
        : Array.from(presenceAudienceUids);
    const hasAudience = friendUids !== undefined || presenceAudienceUids.size > 0;
    presenceDebugLog("presence_broadcast", {
      status: presence.status,
      audience: audience.length,
      hasAudience,
      action: presence.status === "offline" ? "untrack" : "track",
    });

    // 1. Fan-out to each friend's personal inbox (capped concurrency)
    if (audience.length > 0) {
      for (let i = 0; i < audience.length; i += PRESENCE_FANOUT_CHUNK) {
        const chunk = audience.slice(i, i + PRESENCE_FANOUT_CHUNK);
        await Promise.allSettled(
          chunk.map((uid) => sendPresenceToFriendInbox(uid, presence)),
        );
      }
    }

    // 2. Global broadcast only when no friend audience is available (legacy fallback)
    if (!hasAudience) {
      await presenceChannel.send({
        type: "broadcast",
        event: "presence:status_update",
        payload: presence,
      });
    }

    // 3. Track/Untrack no estado Presence do canal (join/leave semantics)
    if (presence.status === "offline") {
      try {
        await presenceChannel.untrack();
      } catch {}
    } else {
      await presenceChannel.track({
        presence,
      });
    }
  } catch (err) {
    presenceDebugLog("presence_broadcast", { status: presence.status, failed: String(err) });
    console.warn("[realtimeEventBus] broadcastPresenceStatus error:", err);
  }
};

/**
 * Envia uma mensagem direta de entrega instantânea (Fast-Path via WebSocket)
 */
export const sendFastU2UMessage = async (receiverUid: string, message: ChatMessage) => {
  try {
    const channelName = `user_inbox_${receiverUid}`;
    channelRefCounts.set(channelName, (channelRefCounts.get(channelName) || 0) + 1);
    cancelChannelIdleClose(channelName);
    sentMessageIds.add(message.id || "");
    await broadcastToUserInbox(receiverUid, "u2u:message", message);
    channelRefCounts.set(channelName, (channelRefCounts.get(channelName) || 1) - 1);
    if ((channelRefCounts.get(channelName) || 0) <= 0) {
      const targetChannel = activeInboxChannels.get(channelName);
      if (targetChannel) {
        scheduleChannelIdleClose(channelName, targetChannel);
      }
    }
  } catch (err) {
    console.warn("[realtimeEventBus] sendFastU2UMessage error:", err);
  }
};

/**
 * Envia indicador rápido de digitação via WebSocket
 */
export const sendFastU2UTyping = async (receiverUid: string, senderId: string, typing: boolean) => {
  try {
    const channelName = `user_inbox_${receiverUid}`;
    await broadcastToUserInbox(receiverUid, "u2u:typing", { senderId, typing });
    if ((channelRefCounts.get(channelName) || 0) <= 0) {
      const targetChannel = activeInboxChannels.get(channelName);
      if (targetChannel) {
        scheduleChannelIdleClose(channelName, targetChannel);
      }
    }
  } catch {
    // Ignore typing throttle errors
  }
};

/**
 * Notifica solicitação de amizade recebida instantaneamente via WebSocket
 */
export const sendFastFriendRequestNotification = async (
  targetUid: string,
  fromUser: { uid: string; displayName: string; photoURL?: string | null },
) => {
  try {
    const channelName = `user_inbox_${targetUid}`;
    await broadcastToUserInbox(targetUid, "u2u:friend_request", {
      fromUid: fromUser.uid,
      fromName: fromUser.displayName,
      fromAvatar: fromUser.photoURL || null,
    });
    if ((channelRefCounts.get(channelName) || 0) <= 0) {
      const targetChannel = activeInboxChannels.get(channelName);
      if (targetChannel) {
        scheduleChannelIdleClose(channelName, targetChannel);
      }
    }
  } catch (err) {
    console.warn("[realtimeEventBus] sendFastFriendRequestNotification error:", err);
  }
};

/**
 * Notifica que uma solicitação de amizade foi aceita instantaneamente via WebSocket
 */
export const sendFastFriendAcceptedNotification = async (
  targetUid: string,
  fromUser: { uid: string; displayName: string; photoURL?: string | null },
) => {
  try {
    const channelName = `user_inbox_${targetUid}`;
    await broadcastToUserInbox(targetUid, "u2u:friend_accepted", {
      friendUid: fromUser.uid,
      friendName: fromUser.displayName,
      friendAvatar: fromUser.photoURL || null,
    });
    if ((channelRefCounts.get(channelName) || 0) <= 0) {
      const targetChannel = activeInboxChannels.get(channelName);
      if (targetChannel) {
        scheduleChannelIdleClose(channelName, targetChannel);
      }
    }
  } catch (err) {
    console.warn("[realtimeEventBus] sendFastFriendAcceptedNotification error:", err);
  }
};

/**
 * Notifica que uma amizade foi desfeita/removida instantaneamente via WebSocket
 */
export const sendFastFriendRemovedNotification = async (
  targetUid: string,
  myUid: string,
) => {
  try {
    const channelName = `user_inbox_${targetUid}`;
    await broadcastToUserInbox(targetUid, "u2u:friend_removed", { fromUid: myUid });
    if ((channelRefCounts.get(channelName) || 0) <= 0) {
      const targetChannel = activeInboxChannels.get(channelName);
      if (targetChannel) {
        scheduleChannelIdleClose(channelName, targetChannel);
      }
    }
  } catch (err) {
    console.warn("[realtimeEventBus] sendFastFriendRemovedNotification error:", err);
  }
};

/**
 * Notifica que mensagens foram lidas instantaneamente via WebSocket
 */
export const sendFastReadReceipt = async (
  targetUid: string,
  readerUid: string,
  chatId: string,
) => {
  try {
    const channelName = `user_inbox_${targetUid}`;
    await broadcastToUserInbox(targetUid, "u2u:read_receipt", { readerUid, chatId });
    if ((channelRefCounts.get(channelName) || 0) <= 0) {
      const targetChannel = activeInboxChannels.get(channelName);
      if (targetChannel) {
        scheduleChannelIdleClose(channelName, targetChannel);
      }
    }
  } catch (err) {
    console.warn("[realtimeEventBus] sendFastReadReceipt error:", err);
  }
};