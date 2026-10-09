import { apiFetch } from "./api";
import { supabase } from "./supabase";
import { MAX_CALL_PARTICIPANTS } from "./voiceCall/limits";
import type { PublicVoiceRoom, VoiceRoom, RoomCategory, VoiceRoomParticipant } from "../types/voice-governance";

let roomsChannel: any = null;
let currentTrackedRoom: PublicVoiceRoom | null = null;
let voiceRoomsTableChannel: ReturnType<typeof supabase.channel> | null = null;

const friendlyRoomError = (message?: string): string => {
  const m = (message || "").toLowerCase();
  if (m.includes("nao e o dono")) return "Só o dono da sala pode editá-la.";
  if (m.includes("exige uma senha")) return "Uma sala privada precisa de senha.";
  if (m.includes("descricao muito longa")) return "A descrição pode ter no máximo 200 caracteres.";
  if (m.includes("nome da sala")) return "Dê um nome à sala.";
  return message || "";
};

const parseErrorPayload = async (res: Response, fallback: string) => {
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  return data.error || fallback;
};

type VoiceRoomRow = {
  id: string;
  host_uid: string;
  room_name: string;
  category: RoomCategory;
  is_private: boolean;
  /** coluna gerada (migration 20261009100500): evita trafegar o hash da senha */
  has_password?: boolean | null;
  max_participants: number;
  status: "active" | "ended";
  created_at: string;
  updated_at?: string;
  icon?: string | null;
  avatar_url?: string | null;
  theme_color?: string | null;
  description?: string | null;
  banner_url?: string | null;
  voice_room_members?: Array<{
    user_id: string;
    display_name: string;
    avatar_url?: string | null;
    joined_at?: string;
    removed_at?: string | null;
  }>;
};

const mapVoiceRoomFromDb = (
  row: VoiceRoomRow,
  options?: { hostUid?: string },
): VoiceRoom => {
  const members = (row.voice_room_members || [])
    .filter((member) => !member.removed_at)
    .map((member) => ({
      uid: member.user_id,
      name: member.display_name,
      avatar: member.avatar_url || undefined,
      joinedAt: member.joined_at,
    } satisfies VoiceRoomParticipant));

  return {
    id: row.id,
    hostUid: row.host_uid,
    name: row.room_name,
    category: row.category,
    isPrivate: row.is_private,
    hasPassword: Boolean(row.has_password),
    maxParticipants: row.max_participants,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    participantsCount: members.length,
    participants: members,
    icon: row.icon || undefined,
    avatarUrl: row.avatar_url || undefined,
    themeColor: row.theme_color || undefined,
    description: row.description || undefined,
    bannerUrl: row.banner_url || undefined,
    isHost: options?.hostUid ? row.host_uid === options.hostUid : undefined,
  };
};

const shouldUseSupabaseVoiceFallback = (error: unknown) => {
  const message = String((error as { message?: string })?.message || error || "").toLowerCase();
  if (message.includes("sessao expirada") || message.includes("sessão expirada") || message.includes("auth")) {
    return false;
  }
  return true;
};

const createVoiceRoomViaSupabase = async (config: {
  name: string;
  category: RoomCategory;
  isPrivate: boolean;
  password?: string;
  icon?: string;
  avatarUrl?: string;
  themeColor?: string;
  maxParticipants?: number;
}): Promise<VoiceRoom> => {
  const { data, error } = await supabase.rpc("create_voice_room", {
    p_room_name: config.name,
    p_category: config.category,
    p_is_private: config.isPrivate,
    p_password: config.password || null,
    p_icon: config.icon || "🎮",
    p_avatar_url: config.avatarUrl || null,
    p_theme_color: config.themeColor || "#8B5CF6",
    p_max_participants: config.maxParticipants || MAX_CALL_PARTICIPANTS,
  });

  if (error || !data) {
    throw new Error(error?.message || "Não foi possível criar a sala de voz.");
  }

  const session = await supabase.auth.getSession();
  return mapVoiceRoomFromDb(data as VoiceRoomRow, {
    hostUid: session.data.session?.user.id,
  });
};

const joinVoiceRoomViaSupabase = async (
  roomId: string,
  options?: {
    password?: string;
    displayName?: string;
    avatarUrl?: string;
  },
): Promise<{ success: boolean; room: VoiceRoom; participants: VoiceRoomParticipant[] }> => {
  const { data, error } = await supabase.rpc("join_voice_room", {
    p_room_id: roomId,
    p_password: options?.password || "",
    p_display_name: options?.displayName || null,
    p_avatar_url: options?.avatarUrl || null,
  });

  if (error || !data) {
    throw new Error(error?.message || "Não foi possível entrar na sala de voz.");
  }

  const payload = data as { room?: VoiceRoomRow; participants?: VoiceRoomParticipant[] };
  if (!payload.room) {
    throw new Error("Resposta inválida ao entrar na sala.");
  }

  const session = await supabase.auth.getSession();
  const room = mapVoiceRoomFromDb(payload.room, {
    hostUid: session.data.session?.user.id,
  });

  return {
    success: true,
    room,
    participants: payload.participants || room.participants,
  };
};

const listPublicVoiceRoomsViaSupabase = async (filters?: {
  category?: string;
  search?: string;
}): Promise<VoiceRoom[]> => {
  let query = supabase
    .from("voice_rooms")
    .select(`
      id, host_uid, room_name, category, is_private, has_password,
      max_participants, status, created_at, updated_at, icon, avatar_url, theme_color, description, banner_url,
      voice_room_members ( user_id, display_name, avatar_url, joined_at, removed_at )
    `)
    .eq("status", "active")
    .eq("is_private", false)
    .order("created_at", { ascending: false });

  if (filters?.category && filters.category !== "all") {
    query = query.eq("category", filters.category);
  }
  if (filters?.search?.trim()) {
    query = query.ilike("room_name", `%${filters.search.trim()}%`);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return (data || []).map((row) => mapVoiceRoomFromDb(row as VoiceRoomRow));
};

const getMyVoiceRoomsViaSupabase = async (): Promise<VoiceRoom[]> => {
  const session = await supabase.auth.getSession();
  const uid = session.data.session?.user.id;
  if (!uid) return [];

  const { data, error } = await supabase
    .from("voice_rooms")
    .select(`
      id, host_uid, room_name, category, is_private, has_password,
      max_participants, status, created_at, updated_at, icon, avatar_url, theme_color, description, banner_url,
      voice_room_members ( user_id, display_name, avatar_url, joined_at, removed_at )
    `)
    .eq("host_uid", uid)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data || []).map((row) => mapVoiceRoomFromDb(row as VoiceRoomRow, { hostUid: uid }));
};

/**
 * Cria uma nova sala persistente no backend
 */
const createVoiceRoomCore = async (config: {
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
  if (!finalName) {
    throw new Error("Informe um nome para o canal de voz.");
  }

  const payload = {
    name: finalName,
    category: config.category || "resenha_games",
    isPrivate: Boolean(config.isPrivate),
    password: config.password || "",
    icon: config.icon || "🎮",
    avatarUrl: config.avatarUrl,
    themeColor: config.themeColor || "#8B5CF6",
    maxParticipants: config.maxParticipants || MAX_CALL_PARTICIPANTS,
  };

  try {
    const res = await apiFetch("/api/voice/rooms", {
      method: "POST",
      authenticated: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = (await res.json().catch(() => ({}))) as { error?: string; room?: VoiceRoom };
    if (!res.ok) {
      throw new Error(data.error || `Não foi possível criar a sala de voz (HTTP ${res.status}).`);
    }
    if (!data.room) {
      throw new Error("Resposta inválida do servidor ao criar a sala.");
    }

    return data.room;
  } catch (err) {
    if (!shouldUseSupabaseVoiceFallback(err)) {
      throw err;
    }
    console.warn("[voiceRooms] API create failed; using Supabase RPC fallback:", err);
    return createVoiceRoomViaSupabase({
      name: finalName,
      category: payload.category as RoomCategory,
      isPrivate: payload.isPrivate,
      password: payload.password,
      icon: payload.icon,
      avatarUrl: payload.avatarUrl,
      themeColor: payload.themeColor,
      maxParticipants: payload.maxParticipants,
    });
  }
};

/**
 * Atualiza configurações e aparência de uma sala existente
 */
/** Cria a sala; descrição e banner (que a API não conhece) entram logo depois, pelo RPC do host. */
export const createVoiceRoom = async (
  config: Parameters<typeof createVoiceRoomCore>[0] & { description?: string; bannerUrl?: string },
): Promise<VoiceRoom> => {
  const room = await createVoiceRoomCore(config);
  if (config.description?.trim() || config.bannerUrl) {
    try {
      return await updateVoiceRoom(room.id, { description: config.description, bannerUrl: config.bannerUrl });
    } catch (err) {
      console.warn("[voiceRooms] sala criada, mas descrição/banner não foram salvos:", err);
    }
  }
  return room;
};

export const updateVoiceRoom = async (
  roomId: string,
  config: {
    name?: string;
    roomName?: string;
    category?: RoomCategory;
    isPrivate?: boolean;
    password?: string;
    /** remove a senha atual (a sala deixa de exigir senha) */
    clearPassword?: boolean;
    icon?: string;
    avatarUrl?: string;
    themeColor?: string;
    description?: string;
    bannerUrl?: string;
    clearBanner?: boolean;
  },
): Promise<VoiceRoom> => {
  // Edição direto no banco (RPC do host): é a fonte de verdade e devolve o erro real. A API do
  // Render falhava com "Validação falhou" e o app dizia que tinha salvo.
  const { data, error } = await supabase.rpc("update_voice_room", {
    p_room_id: roomId,
    p_name: (config.name || config.roomName || "").trim() || null,
    p_category: config.category ?? null,
    p_is_private: config.isPrivate ?? null,
    p_password: config.password?.trim() || null,
    p_clear_password: Boolean(config.clearPassword),
    p_icon: config.icon ?? null,
    p_avatar_url: config.avatarUrl ?? null,
    p_theme_color: config.themeColor ?? null,
    p_description: config.description ?? null,
    p_banner_url: config.bannerUrl ?? null,
    p_clear_banner: Boolean(config.clearBanner),
  });
  if (error || !data) throw new Error(friendlyRoomError(error?.message) || "Não foi possível salvar a sala.");
  const session = await supabase.auth.getSession();
  return mapVoiceRoomFromDb(data as VoiceRoomRow, { hostUid: session.data.session?.user.id });
};

/**
 * Lista as salas públicas ativas no backend
 */
/**
 * A API do Render não conhece descrição/banner: completa as salas com esses campos direto do
 * Supabase (uma consulta por lista). Se falhar, devolve as salas como vieram.
 */
const withRoomExtras = async (rooms: VoiceRoom[]): Promise<VoiceRoom[]> => {
  const ids = rooms.map((r) => r.id).filter(Boolean);
  if (ids.length === 0) return rooms;
  try {
    const { data } = await supabase.from("voice_rooms").select("id, description, banner_url").in("id", ids);
    const byId = new Map((data ?? []).map((d) => [d.id as string, d as { description?: string | null; banner_url?: string | null }]));
    return rooms.map((r) => {
      const extra = byId.get(r.id);
      return extra ? { ...r, description: extra.description || undefined, bannerUrl: extra.banner_url || undefined } : r;
    });
  } catch {
    return rooms;
  }
};

export const listPublicVoiceRooms = async (filters?: {
  category?: string;
  search?: string;
}): Promise<VoiceRoom[]> => {
  try {
    const params = new URLSearchParams();
    if (filters?.category && filters.category !== "all") {
      params.set("category", filters.category);
    }
    if (filters?.search && filters.search.trim()) {
      params.set("search", filters.search.trim());
    }

    const query = params.toString() ? `?${params.toString()}` : "";
    try {
      const res = await apiFetch(`/api/voice/rooms/public${query}`, {
        method: "GET",
        authenticated: true,
      });

      if (!res.ok) {
        throw new Error(`Erro ao listar salas públicas (Status ${res.status})`);
      }

      const data = (await res.json()) as { rooms?: VoiceRoom[] };
      return withRoomExtras((data.rooms || []) as VoiceRoom[]);
    } catch (err) {
      if (!shouldUseSupabaseVoiceFallback(err)) {
        throw err;
      }
      console.warn("[voiceRooms] API public list failed; using Supabase fallback:", err);
      return listPublicVoiceRoomsViaSupabase(filters);
    }
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
    try {
      const res = await apiFetch("/api/voice/rooms/my", {
        method: "GET",
        authenticated: true,
      });

      if (!res.ok) {
        throw new Error(`Erro ao buscar minhas salas (Status ${res.status})`);
      }

      const data = (await res.json()) as { rooms?: VoiceRoom[] };
      return withRoomExtras((data.rooms || []) as VoiceRoom[]);
    } catch (err) {
      if (!shouldUseSupabaseVoiceFallback(err)) {
        throw err;
      }
      console.warn("[voiceRooms] API my rooms failed; using Supabase fallback:", err);
      return getMyVoiceRoomsViaSupabase();
    }
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
    const res = await apiFetch(`/api/voice/rooms/${roomId}`, {
      method: "GET",
      authenticated: true,
    });

    if (!res.ok) {
      return null;
    }

    const data = (await res.json()) as { room?: VoiceRoom };
    return (data.room || null) as VoiceRoom | null;
  } catch (err) {
    console.warn("[voiceRooms] getVoiceRoomById failed:", err);
    return null;
  }
};

/**
 * Ingressa em uma sala com validação server-side de senha e limite de participantes
 */
export const joinVoiceRoom = async (
  roomId: string,
  options?: {
    password?: string;
    displayName?: string;
    avatarUrl?: string;
  },
): Promise<{ success: boolean; room: VoiceRoom; participants: VoiceRoomParticipant[] }> => {
  try {
    const res = await apiFetch(`/api/voice/rooms/${roomId}/join`, {
      method: "POST",
      authenticated: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        password: options?.password || "",
        displayName: options?.displayName,
        avatarUrl: options?.avatarUrl,
      }),
    });

    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      room?: VoiceRoom;
      participants?: VoiceRoomParticipant[];
    };
    if (!res.ok) {
      throw new Error(data.error || "Não foi possível entrar na sala de voz.");
    }

    return {
      success: true,
      room: data.room as VoiceRoom,
      participants: data.participants || [],
    };
  } catch (err) {
    if (!shouldUseSupabaseVoiceFallback(err)) {
      throw err;
    }
    console.warn("[voiceRooms] API join failed; using Supabase RPC fallback:", err);
    return joinVoiceRoomViaSupabase(roomId, options);
  }
};

/**
 * Registra saída da sala de voz
 */
export const leaveVoiceRoom = async (roomId: string): Promise<void> => {
  try {
    await apiFetch(`/api/voice/rooms/${roomId}/leave`, {
      method: "POST",
      authenticated: true,
    });
  } catch (err) {
    console.warn("[voiceRooms] leaveVoiceRoom failed:", err);
  }
};

/**
 * Encerra e deleta a sala de voz (Apenas Host)
 */
export const closeVoiceRoom = async (roomId: string): Promise<void> => {
  const res = await apiFetch(`/api/voice/rooms/${roomId}`, {
    method: "DELETE",
    authenticated: true,
  });

  if (!res.ok) {
    throw new Error(await parseErrorPayload(res, "Não foi possível encerrar a sala."));
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

/**
 * Refreshes voice room lists when voice_rooms / voice_room_members change in Postgres.
 */
export const subscribeToVoiceRoomTableChanges = (onChange: () => void) => {
  if (voiceRoomsTableChannel) {
    return () => undefined;
  }

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  const schedule = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => onChange(), 250);
  };

  voiceRoomsTableChannel = supabase
    .channel("voice_rooms_table_sync")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "voice_rooms" },
      schedule,
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "voice_room_members" },
      schedule,
    )
    .subscribe();

  return () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    if (voiceRoomsTableChannel) {
      supabase.removeChannel(voiceRoomsTableChannel);
      voiceRoomsTableChannel = null;
    }
  };
};
