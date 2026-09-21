/**
 * turnCredentials.ts
 * Fetches dynamic, temporary TURN credentials from the authenticated Render backend endpoint.
 * Keeps a client-side memory cache for 10 minutes.
 * Falls back to public Google STUN servers if the backend is unreachable or offline.
 */
import { apiUrl, getUsableSession } from "./api";

const FALLBACK_STUN_ONLY: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun3.l.google.com:19302" },
  { urls: "stun:stun4.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
  { urls: "stun:global.stun.twilio.com:3478" },
  { urls: "stun:relay.metered.ca:80" },
  {
    urls: "turn:openrelay.metered.ca:80",
    username: "openrelay",
    credential: "openrelay",
  },
  {
    urls: "turn:openrelay.metered.ca:443",
    username: "openrelay",
    credential: "openrelay",
  },
  {
    urls: "turn:openrelay.metered.ca:443?transport=tcp",
    username: "openrelay",
    credential: "openrelay",
  },
  {
    urls: "turns:openrelay.metered.ca:443?transport=tcp",
    username: "openrelay",
    credential: "openrelay",
  },
];

let cachedServers: RTCIceServer[] | null = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 min cache

export const getTurnServers = async (): Promise<RTCIceServer[]> => {
  if (cachedServers && Date.now() < cacheExpiry) {
    return cachedServers;
  }

  try {
    const session = await getUsableSession();
    const token = session?.access_token;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(apiUrl("/api/voice/turn-credentials"), {
      headers,
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`Endpoint retornou status ${response.status}`);
    }

    const data = (await response.json()) as { iceServers?: RTCIceServer[] };
    if (Array.isArray(data.iceServers) && data.iceServers.length > 0) {
      cachedServers = data.iceServers;
      cacheExpiry = Date.now() + CACHE_TTL_MS;
      return data.iceServers;
    }

    return FALLBACK_STUN_ONLY;
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn("[TURN] Não foi possível obter credenciais TURN do backend, usando STUN fallback:", err);
    }
    return FALLBACK_STUN_ONLY;
  }
};
