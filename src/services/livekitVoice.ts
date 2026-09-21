/**
 * livekitVoice.ts
 * High-performance, low-latency WebRTC SFU client powered by LiveKit Cloud.
 */
import {
  Room,
  RoomEvent,
  Track,
  VideoQuality,
  AudioPresets,
  LocalTrackPublication,
  RemoteTrackPublication,
  Participant,
  RemoteParticipant,
  LocalAudioTrack,
  LocalVideoTrack,
  createLocalAudioTrack,
  createLocalVideoTrack,
  createLocalScreenTracks,
} from "livekit-client";
import { apiUrl, getUsableSession } from "./api";

export interface LiveKitTokenResponse {
  token: string;
  serverUrl: string;
}

/**
 * Obtém token JWT assinado para ingressar na sala do LiveKit SFU
 */
const LIVEKIT_ROOM_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Voice-room UUID or 1:1 `{uuid}_{uuid}` — the only room names the token API accepts. */
export const isLiveKitCompatibleRoom = (roomName: string): boolean => {
  const name = String(roomName || "").trim();
  if (LIVEKIT_ROOM_UUID_RE.test(name)) return true;
  const parts = name.split("_");
  return parts.length === 2 && parts.every((part) => LIVEKIT_ROOM_UUID_RE.test(part));
};

export const fetchLiveKitToken = async (
  roomName: string,
  identity: string,
  name?: string,
  metadata?: any,
): Promise<LiveKitTokenResponse> => {
  if (!isLiveKitCompatibleRoom(roomName)) {
    throw new Error("Identificador de sala inválido.");
  }

  const session = await getUsableSession();
  const token = session?.access_token;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(apiUrl("/api/voice/livekit-token"), {
    method: "POST",
    headers,
    body: JSON.stringify({
      roomName: String(roomName).trim(),
      identity: String(identity).trim(),
      name: String(name || identity).trim(),
      metadata,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Erro ao obter token do LiveKit (${response.status})`);
  }

  const payload = (await response.json()) as (LiveKitTokenResponse & { disabled?: boolean; error?: string });
  if (payload.disabled) {
    throw new Error("LiveKit não habilitado no backend. Usando WebRTC P2P.");
  }
  const serverUrl =
    String(payload.serverUrl || import.meta.env.VITE_LIVEKIT_URL || "").trim();
  if (!serverUrl) {
    throw new Error("URL do servidor LiveKit não configurada.");
  }
  if (!payload.token) {
    throw new Error("Token LiveKit inválido.");
  }

  return { token: payload.token, serverUrl };
};

export {
  Room,
  RoomEvent,
  Track,
  VideoQuality,
  AudioPresets,
  LocalTrackPublication,
  RemoteTrackPublication,
  Participant,
  RemoteParticipant,
  LocalAudioTrack,
  LocalVideoTrack,
  createLocalAudioTrack,
  createLocalVideoTrack,
  createLocalScreenTracks,
};
