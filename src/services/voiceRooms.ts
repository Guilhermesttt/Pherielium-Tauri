import { apiUrl, getAuthHeaders as getApiAuthHeaders } from "./api";
import { supabase } from "./supabase";
import type { PublicVoiceRoom, VoiceRoom, RoomCategory, VoiceRoomParticipant } from "../types/voice-governance";

let roomsChannel: any = null;
let currentTrackedRoom: PublicVoiceRoom | null = null;

const getAuthHeaders = (): Promise<Record<string, string>> => getApiAuthHeaders(true);

/**
 * Cria uma nova sala persistente no backend
 */
export const createVoiceRoom = async (config: {
  name?: string;
  roomName?: string;
  category?: RoomCategory;
  isPrivate?: boolean;
  password?: string;
  icon?: string;
  avatarUrl?: string;
  themeColor?: string;
  maxParticipants?: number;
}): Promise<VoiceRoom> => {
  const finalName = (config.name || config.roomName || "").trim();
  const headers = await getAuthHeaders();
  const res = await fetch(apiUrl("/api/voice/rooms"), {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: finalName,
      category: config.category || "resenha_games",
      isPrivate: Boolean(config.isPrivate),
      password: config.password || "",
      icon: config.icon || "🎮",
      avatarUrl: config.avatarUrl,
      themeColor: config.themeColor || "#8B5CF6",
      maxParticipants: config.maxParticipants || 16,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Não foi possível criar a sala de voz.");
  }

  return data.room as VoiceRoom;
};

/**
 * Atualiza configurações e aparência de uma sala existente
 */
export const updateVoiceRoom = async (
  roomId: string,
  config: {
    name?: string;
    roomName?: string;
    category?: RoomCategory;
    isPrivate?: boolean;
    password?: string;
    icon?: string;
    avatarUrl?: string;
    themeColor?: string;
  },
): Promise<VoiceRoom | null> => {
  try {
    const finalName = (config.name || config.roomName || "").trim();
    const headers = await getAuthHeaders();
    const res = await fetch(apiUrl(`/api/voice/rooms/${roomId}`), {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        name: finalName,
        category: config.category,
        isPrivate: config.isPrivate,
        password: config.password,
        icon: config.icon,
        avatarUrl: config.avatarUrl,
        themeColor: config.themeColor,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return (data.room || null) as VoiceRoom | null;
    }
  } catch (err) {
    console.warn("[voiceRooms] updateVoiceRoom error:", err);
  }
  return null;
};

/**
 * Lista as salas públicas ativas no backend
 */
export const listPublicVoiceRooms = async (filters?: {
  category?: string;
  search?: string;
}): Promise<VoiceRoom[]> => {
  try {
    const headers = await getAuthHeaders();
    const params = new URLSearchParams();
    if (filters?.category && filters.category !== "all") {
      params.set("category", filters.category);
    }
    if (filters?.search && filters.search.trim()) {
      params.set("search", filters.search.trim());
    }

    const query = params.toString() ? `?${params.toString()}` : "";
    const res = await fetch(apiUrl(`/api/voice/rooms/public${query}`), {
      method: "GET",
      headers,
    });

    if (!res.ok) {
      throw new Error(`Erro ao listar salas públicas (Status ${res.status})`);
    }

    const data = await res.json();
    return (data.rooms || []) as VoiceRoom[];
  } catch (err) {
    console.warn("[voiceRooms] listPublicVoiceRooms failed:", err);
    return [];
  }
};

/**
 * Lista as salas do usuário atual (criadas como host ou histórico)
 */
export const getMyVoiceRooms = async (): Promise<VoiceRoom[]> => {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(apiUrl("/api/voice/rooms/my"), {
      method: "GET",
      headers,
    });

    if (!res.ok) {
      throw new Error(`Erro ao buscar minhas salas (Status ${res.status})`);
    }

    const data = await res.json();
    return (data.rooms || []) as VoiceRoom[];
  } catch (err) {
    console.warn("[voiceRooms] getMyVoiceRooms failed:", err);
    return [];
  }
};

/**
 * Busca os dados de uma sala de voz por ID
 */
export const getVoiceRoomById = async (roomId: string): Promise<VoiceRoom | null> => {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(apiUrl(`/api/voice/rooms/${roomId}`), {
      method: "GET",
      headers,
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    return (data.room || null) as VoiceRoom | null;
  } catch (err) {
    console.warn("[voiceRooms] getVoiceRoomById failed:", err);
    return null;
  }
};

/**
 * Ingressa em uma sala com validação server-side de senha e limite de 4 participantes
 */
export const joinVoiceRoom = async (
  roomId: string,
  options?: {
    password?: string;
    displayName?: string;
    avatarUrl?: string;
  },
): Promise<{ success: boolean; room: VoiceRoom; participants: VoiceRoomParticipant[] }> => {
  const headers = await getAuthHeaders();
  const res = await fetch(apiUrl(`/api/voice/rooms/${roomId}/join`), {
    method: "POST",
    headers,
    body: JSON.stringify({
      password: options?.password || "",
      displayName: options?.displayName,
      avatarUrl: options?.avatarUrl,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Não foi possível entrar na sala de voz.");
  }

  return {
    success: true,
    room: data.room,
    participants: data.participants || [],
  };
};

/**
 * Registra saída da sala de voz
 */
export const leaveVoiceRoom = async (roomId: string): Promise<void> => {
  try {
    const headers = await getAuthHeaders();
    await fetch(apiUrl(`/api/voice/rooms/${roomId}/leave`), {
      method: "POST",
      headers,
    });
  } catch (err) {
    console.warn("[voiceRooms] leaveVoiceRoom failed:", err);
  }
};

/**
 * Encerra e deleta a sala de voz (Apenas Host)
 */
export const closeVoiceRoom = async (roomId: string): Promise<void> => {
  const headers = await getAuthHeaders();
  const res = await fetch(apiUrl(`/api/voice/rooms/${roomId}`), {
    method: "DELETE",
    headers,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Não foi possível encerrar a sala.");
  }
};

/**
 * Inscreve-se nas salas públicas ativas via Supabase Presence.
 * Mantido para sincronização instantânea de estado na UI.
 */
export const subscribeToPublicVoiceRooms = (
  onRoomsUpdate: (rooms: PublicVoiceRoom[]) => void,
) => {
  if (!roomsChannel) {
    roomsChannel = supabase.channel("public_voice_rooms", {
      config: {
        presence: {
          key: "voice_room",
        },
      },
    });
  }

  const handleSync = () => {
    const presenceState = roomsChannel.presenceState();
    const activeRooms: PublicVoiceRoom[] = [];
    const seenIds = new Set<string>();

    Object.values(presenceState).forEach((presences: any) => {
      if (Array.isArray(presences)) {
        presences.forEach((p: any) => {
          if (p.room && !p.room.isPrivate && !seenIds.has(p.room.id)) {
            seenIds.add(p.room.id);
            activeRooms.push(p.room as PublicVoiceRoom);
          }
        });
      }
    });

    onRoomsUpdate(activeRooms);
  };

  roomsChannel
    .on("presence", { event: "sync" }, handleSync)
    .on("presence", { event: "join" }, handleSync)
    .on("presence", { event: "leave" }, handleSync);

  roomsChannel.subscribe(async (status: string) => {
    if (status === "SUBSCRIBED") {
      handleSync();
      if (currentTrackedRoom && !currentTrackedRoom.isPrivate) {
        await roomsChannel.track({ room: currentTrackedRoom });
      }
    }
  });

  return () => {
    if (!currentTrackedRoom) {
      supabase.removeChannel(roomsChannel);
      roomsChannel = null;
    }
  };
};

/**
 * Publica uma sala pública no canal Presence
 */
export const publishPublicVoiceRoom = async (room: PublicVoiceRoom) => {
  if (room.isPrivate) {
    await unpublishPublicVoiceRoom();
    return;
  }

  currentTrackedRoom = room;

  if (!roomsChannel) {
    roomsChannel = supabase.channel("public_voice_rooms", {
      config: {
        presence: {
          key: "voice_room",
        },
      },
    });
  }

  if (roomsChannel.state !== "joined") {
    await new Promise<void>((resolve) => {
      roomsChannel.subscribe(async (status: string) => {
        if (status === "SUBSCRIBED") {
          try {
            await roomsChannel.track({ room });
          } catch {}
          resolve();
        }
      });
    });
  } else {
    try {
      await roomsChannel.track({ room });
    } catch {}
  }
};

/**
 * Remove a sala da listagem pública Presence
 */
export const unpublishPublicVoiceRoom = async () => {
  currentTrackedRoom = null;
  if (roomsChannel) {
    try {
      await roomsChannel.untrack();
    } catch (err) {
      console.warn("[voiceRooms] untrack error:", err);
    }
  }
};
