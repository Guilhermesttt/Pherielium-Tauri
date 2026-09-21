import { supabase } from "../supabase";
import type {
  ChannelConnectionStatus,
  ChannelStatusEvent,
  ChannelStatusListener,
} from "./types";

const activeChannels = new Map<string, any>();
const channelPromises = new Map<string, Promise<any>>();
const channelStatuses = new Map<string, ChannelConnectionStatus>();
const statusListeners = new Set<ChannelStatusListener>();

export const getVoiceRoomTopic = (chatId: string): string => {
  const cleanId = String(chatId || "").trim();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanId);
  return isUuid ? `voice:room:${cleanId}` : `call_session_${cleanId}`;
};

export const addChannelStatusListener = (listener: ChannelStatusListener): (() => void) => {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
};

export const getChannelStatus = (channelName: string): ChannelConnectionStatus => {
  const clean = String(channelName || "").trim();
  return channelStatuses.get(clean) || "idle";
};

const notifyStatus = (
  channelName: string,
  status: ChannelConnectionStatus,
  attempt: number,
  error?: unknown,
) => {
  channelStatuses.set(channelName, status);
  const event: ChannelStatusEvent = {
    channelName,
    status,
    attempt,
    error,
    timestamp: Date.now(),
  };
  for (const listener of statusListeners) {
    try {
      listener(event);
    } catch (err) {
      console.error("[voiceCall/lifecycle] Listener threw error:", err);
    }
  }
};

const MAX_SUB_ATTEMPTS = 3;
const BACKOFF_DELAYS = [1000, 2000, 4000];

export const getOrCreateChannel = async (
  channelName: string,
  options?: { maxAttempts?: number },
): Promise<any> => {
  const cleanChannelName = String(channelName || "").trim();
  const channel = activeChannels.get(cleanChannelName);

  if (channel && (channel.state === "joined" || channel.status === "SUBSCRIBED")) {
    return channel;
  }

  if (channelPromises.has(cleanChannelName)) {
    return channelPromises.get(cleanChannelName);
  }

  const maxAttempts = options?.maxAttempts ?? MAX_SUB_ATTEMPTS;

  const subPromise = (async () => {
    let attempt = 0;

    while (attempt < maxAttempts) {
      attempt++;
      notifyStatus(
        cleanChannelName,
        attempt === 1 ? "connecting" : "reconnecting",
        attempt,
      );

      // Remove canal antigo se falhou na tentativa anterior
      const existing = activeChannels.get(cleanChannelName);
      if (existing) {
        try {
          supabase.removeChannel(existing);
        } catch { }
        activeChannels.delete(cleanChannelName);
      }

      const newChannel = supabase.channel(cleanChannelName, {
        config: { broadcast: { self: false } },
      });

      try {
        (newChannel as any).__createdAt = Date.now();
      } catch { }
      activeChannels.set(cleanChannelName, newChannel);

      const attemptResult = await new Promise<{ ok: boolean; status: string; channel: any }>((resolve) => {
        let finished = false;
        const timeoutMs = 4500;
        const timer = setTimeout(() => {
          if (!finished) {
            finished = true;
            resolve({ ok: false, status: "TIMED_OUT", channel: newChannel });
          }
        }, timeoutMs);

        try {
          newChannel.subscribe((status: string) => {
            if (finished) return;
            if (status === "SUBSCRIBED") {
              finished = true;
              clearTimeout(timer);
              resolve({ ok: true, status, channel: newChannel });
            } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
              finished = true;
              clearTimeout(timer);
              resolve({ ok: false, status, channel: newChannel });
            }
          });
        } catch (err) {
          clearTimeout(timer);
          finished = true;
          resolve({ ok: false, status: "EXCEPTION", channel: newChannel });
        }
      });

      if (attemptResult.ok) {
        try {
          (attemptResult.channel as any).__subscribed = true;
        } catch { }
        notifyStatus(cleanChannelName, "subscribed", attempt);
        return attemptResult.channel;
      }

      console.warn(
        `[voiceCall/lifecycle] Subscrição falhou para ${cleanChannelName} (tentativa ${attempt}/${maxAttempts}, status: ${attemptResult.status})`,
      );

      if (attempt < maxAttempts) {
        const delay = BACKOFF_DELAYS[attempt - 1] ?? 3000;
        notifyStatus(cleanChannelName, "degraded", attempt, attemptResult.status);
        await new Promise((res) => setTimeout(res, delay));
      }
    }

    // Se esgotou as tentativas
    notifyStatus(cleanChannelName, "failed", maxAttempts, "Max retries exceeded");
    const fallbackChannel = activeChannels.get(cleanChannelName);
    try {
      if (fallbackChannel) (fallbackChannel as any).__subscribed = false;
    } catch { }
    return fallbackChannel;
  })();

  channelPromises.set(cleanChannelName, subPromise);

  try {
    return await subPromise;
  } finally {
    channelPromises.delete(cleanChannelName);
  }
};

export const removeChannel = (channelName: string) => {
  const cleanChannelName = String(channelName || "").trim();
  const channel = activeChannels.get(cleanChannelName);
  if (channel) {
    try {
      supabase.removeChannel(channel);
    } catch (e) {
      console.warn("[voiceCall/lifecycle] removeChannel error:", e);
    }
    activeChannels.delete(cleanChannelName);
  }
  channelPromises.delete(cleanChannelName);
  channelStatuses.delete(cleanChannelName);
};

export const cleanupAllChannels = () => {
  activeChannels.forEach((channel) => {
    try {
      supabase.removeChannel(channel);
    } catch (e) {
      console.warn("[voiceCall/lifecycle] cleanupAllChannels error:", e);
    }
  });
  activeChannels.clear();
  channelPromises.clear();
  channelStatuses.clear();
};
