import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Radio,
  Plus,
  Lock,
  Unlock,
  Users,
  Search,
  Gamepad2,
  Swords,
  BookOpen,
  MessageSquare,
  KeyRound,
  Trash2,
  PhoneCall,
  PhoneIncoming,
  Palette,
  Volume2,
  RefreshCw,
  X,
} from "lucide-react";
import type { VoiceRoom, RoomCategory, CallRoomConfig } from "../../types/voice-governance";
import type { UserProfile } from "../../types/domain";
import { listPublicVoiceRooms, getMyVoiceRooms, closeVoiceRoom, updateVoiceRoom } from "../../services/voiceRooms";
import { CreateChannelModal, renderVoiceRoomIcon } from "./CreateChannelModal";

interface VoiceRoomsTabProps {
  userProfile: UserProfile | null;
  currentRoomId?: string | null;
  onJoinRoom: (roomId: string, password?: string) => Promise<void>;
  onCreateRoom: (config: CallRoomConfig) => Promise<void>;
  onOpenActiveWindow?: () => void;
  onSimulateIncomingCall?: () => void;
  notify: (msg: string, type: "success" | "error" | "info") => void;
}

const CATEGORY_META: Record<RoomCategory, { label: string; icon: React.ReactNode }> = {
  resenha_games: {
    label: "Resenha & Games",
    icon: <Gamepad2 className="h-3.5 w-3.5" />,
  },
  gameplay_foco: {
    label: "Só Gameplay",
    icon: <Swords className="h-3.5 w-3.5" />,
  },
  estudos_foco: {
    label: "Foco & Estudos",
    icon: <BookOpen className="h-3.5 w-3.5" />,
  },
  casual_chat: {
    label: "Conversa Livre",
    icon: <MessageSquare className="h-3.5 w-3.5" />,
  },
};

export const VoiceRoomsTab: React.FC<VoiceRoomsTabProps> = ({
  userProfile,
  currentRoomId,
  onJoinRoom,
  onCreateRoom,
  onOpenActiveWindow,
  onSimulateIncomingCall,
  notify,
}) => {
  const [publicRooms, setPublicRooms] = useState<VoiceRoom[]>([]);
  const [myRooms, setMyRooms] = useState<VoiceRoom[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<VoiceRoom | null>(null);

  // Password Modal State for entering private/password-protected rooms
  const [passwordModalRoom, setPasswordModalRoom] = useState<VoiceRoom | null>(null);
  const [inputPassword, setInputPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isJoiningWithPassword, setIsJoiningWithPassword] = useState(false);

  const fetchRooms = useCallback(async () => {
    setIsLoading(true);
    try {
      const [pub, mine] = await Promise.all([
        listPublicVoiceRooms({
          category: selectedCategory !== "all" ? selectedCategory : undefined,
          search: searchQuery.trim() || undefined,
        }),
        getMyVoiceRooms(),
      ]);
      setPublicRooms(pub);
      setMyRooms(mine);
    } catch {
      // Ignored in offline / test mode
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, selectedCategory]);

  useEffect(() => {
    void fetchRooms();
  }, [fetchRooms]);

  // 1. Filtrar as salas públicas globais para NÃO duplicar salas onde o usuário já é o dono
  const globalOtherRooms = useMemo(() => {
    return publicRooms.filter((room) => {
      const isOwner = (userProfile?.uid && room.hostUid === userProfile.uid) || room.isHost;
      return !isOwner;
    });
  }, [publicRooms, userProfile?.uid]);

  const handleJoinClick = (room: VoiceRoom) => {
    if (room.participantsCount >= room.maxParticipants) {
      notify(`A sala "${room.name}" está cheia (${room.maxParticipants}/${room.maxParticipants}).`, "info");
      return;
    }

    if (room.hasPassword || room.isPrivate) {
      setPasswordModalRoom(room);
      setInputPassword("");
      setPasswordError(null);
    } else {
      void onJoinRoom(room.id);
    }
  };

  const handlePasswordSubmit = async () => {
    if (!passwordModalRoom) return;
    setIsJoiningWithPassword(true);
    setPasswordError(null);
    try {
      await onJoinRoom(passwordModalRoom.id, inputPassword);
      setPasswordModalRoom(null);
    } catch (err: any) {
      setPasswordError(err?.message || "Senha incorreta.");
    } finally {
      setIsJoiningWithPassword(false);
    }
  };

  const handleDeleteRoom = async (roomId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await closeVoiceRoom(roomId);
      notify("Canal de voz encerrado com sucesso.", "success");
      void fetchRooms();
    } catch (err: any) {
      notify(err?.message || "Erro ao encerrar sala.", "error");
    }
  };

  return (
    <div className="space-y-6 select-none">
      {/* Header with Stats & Actions */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 rounded-3xl border border-white/8 bg-white/3 p-5 md:p-6 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.4)]">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-white border border-white/15 shadow-inner">
            <Radio className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-base font-black uppercase tracking-wider text-white flex items-center gap-2">
              <span>Canais de Voz</span>
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-white/10 text-white/80 border border-white/15">
                P2P Mesh (4 Max)
              </span>
            </h2>
            <p className="text-xs text-white/50">
              Salas públicas permanentes e canais de conversa para jogar com a galera
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <button
            type="button"
            onClick={fetchRooms}
            disabled={isLoading}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition cursor-pointer"
            title="Atualizar lista de salas"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin text-white" : ""}`} />
          </button>

          {/* Test Incoming Call Simulation Button */}
          {onSimulateIncomingCall && (
            <button
              type="button"
              onClick={onSimulateIncomingCall}
              className="flex items-center gap-2 h-10 px-3.5 rounded-xl bg-white/5 hover:bg-white/12 border border-white/10 text-white font-bold text-xs transition hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              title="Testar modal e toque de chamada recebida"
            >
              <PhoneIncoming className="h-4 w-4 text-emerald-400 animate-pulse" />
              <span className="hidden sm:inline">Testar Chamada</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="flex-1 md:flex-initial flex items-center justify-center gap-2 h-10 px-5 rounded-xl bg-white text-black font-black text-xs uppercase tracking-wider hover:bg-white/90 shadow-[0_4px_20px_rgba(255,255,255,0.15)] transition hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Criar Canal de Voz</span>
          </button>
        </div>
      </div>

      {/* Active Call Banner (Monochromatic Glassmorphic) */}
      {currentRoomId && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between p-4.5 rounded-2xl border border-white/15 bg-white/4 backdrop-blur-2xl shadow-xl"
        >
          <div className="flex items-center gap-3.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white border border-white/15">
              <Volume2 className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <div className="text-xs font-black text-white flex items-center gap-2">
                <span>Você está conectado em uma sala ativa</span>
                <span className="inline-block h-2 w-2 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
              </div>
              <p className="text-[11px] text-white/50">
                O áudio está conectado e ativo em segundo plano.
              </p>
            </div>
          </div>
          {onOpenActiveWindow && (
            <button
              type="button"
              onClick={onOpenActiveWindow}
              className="px-4 py-2 rounded-xl bg-white text-black font-black text-xs uppercase tracking-wider hover:bg-white/90 transition shadow-md cursor-pointer hover:scale-105 active:scale-95"
            >
              Abrir Painel
            </button>
          )}
        </motion.div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
          <input
            type="text"
            placeholder="Pesquisar canais de voz por nome..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-xl bg-white/4 border border-white/8 backdrop-blur-xl text-xs font-semibold text-white placeholder-white/40 focus:outline-none focus:border-white/30 focus:bg-white/8 transition"
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedCategory("all")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              selectedCategory === "all"
                ? "bg-white text-black font-black shadow-sm"
                : "bg-white/5 hover:bg-white/10 text-white/60 hover:text-white border border-white/5"
            }`}
          >
            Todas
          </button>
          {Object.entries(CATEGORY_META).map(([key, meta]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedCategory(key)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer border ${
                selectedCategory === key
                  ? "bg-white text-black font-black shadow-sm border-white"
                  : "bg-white/5 hover:bg-white/10 text-white/60 hover:text-white border-white/5"
              }`}
            >
              {meta.icon}
              <span>{meta.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Minhas Salas Salvas (Minhas salas só aparecem aqui) */}
      {myRooms.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-white/60 flex items-center gap-2">
            <span>Minhas Salas Salvas</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/80 font-black">
              {myRooms.length}
            </span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {myRooms.map((room) => {
              const meta = CATEGORY_META[room.category] || CATEGORY_META.resenha_games;
              const isCurrent = currentRoomId === room.id;
              const roomColor = room.themeColor || "#8B5CF6";

              return (
                <div
                  key={room.id}
                  className={`group relative flex flex-col justify-between p-4.5 rounded-2xl border transition-all duration-200 backdrop-blur-xl ${
                    isCurrent
                      ? "bg-white/8 border-white/40 shadow-xl"
                      : "bg-white/3 hover:bg-white/6 border-white/8 hover:border-white/20 shadow-[0_15px_35px_rgba(0,0,0,0.3)]"
                  }`}
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 font-black text-sm text-white truncate min-w-0">
                        <div
                          className="h-8 w-8 rounded-xl flex items-center justify-center text-sm shrink-0 border"
                          style={{ borderColor: `${roomColor}60`, backgroundColor: `${roomColor}20` }}
                        >
                          {room.avatarUrl ? (
                            <img src={room.avatarUrl} alt="" className="h-full w-full rounded-xl object-cover" />
                          ) : (
                            renderVoiceRoomIcon(room.icon, "h-4 w-4", roomColor)
                          )}
                        </div>
                        <span className="truncate">{room.name}</span>
                        {room.isPrivate ? (
                          <Lock className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                        ) : (
                          <Unlock className="h-3.5 w-3.5 text-white/50 shrink-0" />
                        )}
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingRoom(room);
                          }}
                          className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition cursor-pointer"
                          title="Editar aparência e configurações da sala"
                        >
                          <Palette className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteRoom(room.id, e)}
                          className="p-1.5 rounded-lg hover:bg-rose-500/20 text-white/40 hover:text-rose-400 transition cursor-pointer"
                          title="Encerrar canal permanentemente"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border border-white/10 bg-white/5 text-white/80">
                        {meta.icon}
                        <span>{meta.label}</span>
                      </span>

                      <span className="flex items-center gap-1 text-[11px] font-bold text-white/50">
                        <Users className="h-3 w-3" />
                        <span>{room.participantsCount}/{room.maxParticipants}</span>
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between gap-2">
                    <div className="flex -space-x-2 overflow-hidden">
                      {room.participants.map((p, i) => (
                        <div
                          key={p.uid || i}
                          className="h-6 w-6 rounded-full border border-black bg-white/10 flex items-center justify-center text-[9px] font-black text-white"
                          title={p.name}
                        >
                          {p.avatar ? (
                            <img src={p.avatar} alt={p.name} className="h-full w-full rounded-full object-cover" />
                          ) : (
                            p.name.charAt(0).toUpperCase()
                          )}
                        </div>
                      ))}
                      {room.participants.length === 0 && (
                        <span className="text-[10px] text-white/40 italic">Sala aberta (0 conectados)</span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleJoinClick(room)}
                      className={`px-3.5 py-1.5 rounded-xl font-black text-xs transition cursor-pointer flex items-center gap-1.5 ${
                        isCurrent
                          ? "bg-white text-black shadow-sm"
                          : "bg-white/15 text-white hover:bg-white hover:text-black border border-white/15 shadow-sm"
                      }`}
                    >
                      <PhoneCall className="h-3.5 w-3.5" />
                      <span>{isCurrent ? "Conectado" : "Entrar / Reabrir"}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Grid de Salas Públicas Globais (Apenas salas de outros usuários) */}
      <div className="space-y-3">
        <h3 className="text-xs font-black uppercase tracking-wider text-white/60 flex items-center gap-2">
          <span>Salas Públicas Globais</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/80 font-black">
            {globalOtherRooms.length}
          </span>
        </h3>

        {globalOtherRooms.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center p-10 rounded-3xl border border-white/5 bg-black/20 text-center space-y-3">
            <Radio className="h-8 w-8 text-white/20" />
            <div>
              <p className="text-sm font-bold text-white/80">Nenhuma outra sala pública ativa no momento</p>
              <p className="text-xs text-white/40 mt-0.5">As salas criadas por outros amigos aparecerão aqui.</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {globalOtherRooms.map((room) => {
            const meta = CATEGORY_META[room.category] || CATEGORY_META.resenha_games;
            const isFull = room.participantsCount >= room.maxParticipants;
            const isCurrent = currentRoomId === room.id;
            const roomColor = room.themeColor || "#8B5CF6";

            return (
              <div
                key={room.id}
                className={`flex flex-col justify-between p-4.5 rounded-2xl border transition-all duration-200 backdrop-blur-xl ${
                  isCurrent
                    ? "bg-white/8 border-white/40 shadow-xl"
                    : isFull
                    ? "bg-white/1 border-white/5 opacity-70"
                    : "bg-white/3 hover:bg-white/6 border-white/8 hover:border-white/20 shadow-[0_15px_35px_rgba(0,0,0,0.3)]"
                }`}
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 font-black text-sm text-white truncate min-w-0">
                      <div
                        className="h-8 w-8 rounded-xl flex items-center justify-center text-sm shrink-0 border"
                        style={{ borderColor: `${roomColor}60`, backgroundColor: `${roomColor}20` }}
                      >
                        {room.avatarUrl ? (
                          <img src={room.avatarUrl} alt="" className="h-full w-full rounded-xl object-cover" />
                        ) : (
                          renderVoiceRoomIcon(room.icon, "h-4 w-4", roomColor)
                        )}
                      </div>
                      <h4 className="font-black text-sm text-white truncate">{room.name}</h4>
                    </div>

                    {isFull && (
                      <span className="px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[9px] font-black uppercase shrink-0">
                        Lotada
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border border-white/10 bg-white/5 text-white/80">
                      {meta.icon}
                      <span>{meta.label}</span>
                    </span>

                    <span className={`flex items-center gap-1 text-[11px] font-bold ${isFull ? "text-rose-400" : "text-white/50"}`}>
                      <Users className="h-3 w-3" />
                      <span>{room.participantsCount}/{room.maxParticipants}</span>
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between gap-2">
                  <div className="flex -space-x-2 overflow-hidden">
                    {room.participants.slice(0, 4).map((p, i) => (
                      <div
                        key={p.uid || i}
                        className="h-6 w-6 rounded-full border border-black bg-white/10 flex items-center justify-center text-[9px] font-black text-white"
                        title={p.name}
                      >
                        {p.avatar ? (
                          <img src={p.avatar} alt={p.name} className="h-full w-full rounded-full object-cover" />
                        ) : (
                          p.name.charAt(0).toUpperCase()
                        )}
                      </div>
                    ))}
                    {room.participants.length === 0 && (
                      <span className="text-[10px] text-white/40 italic">Sala aberta (0 conectados)</span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleJoinClick(room)}
                    disabled={isFull && !isCurrent}
                    className={`px-4 py-1.5 rounded-xl font-black text-xs transition cursor-pointer flex items-center gap-1.5 ${
                      isCurrent
                        ? "bg-white text-black shadow-sm"
                        : isFull
                        ? "bg-white/5 text-white/30 cursor-not-allowed border border-white/5"
                        : "bg-white text-black hover:bg-white/90 shadow-sm hover:scale-[1.02] active:scale-[0.98]"
                    }`}
                  >
                    <PhoneCall className="h-3.5 w-3.5" />
                    <span>{isCurrent ? "Conectado" : isFull ? "Cheia" : "Entrar"}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal de Criação de Canal */}
      <CreateChannelModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        userProfile={userProfile}
        onCreateChannel={async (config) => {
          await onCreateRoom(config);
          void fetchRooms();
        }}
      />

      {/* Modal de Edição de Canal */}
      {editingRoom && (
        <CreateChannelModal
          isOpen={Boolean(editingRoom)}
          onClose={() => setEditingRoom(null)}
          userProfile={userProfile}
          isEditing={true}
          initialConfig={{
            roomName: editingRoom.name,
            category: editingRoom.category,
            icon: editingRoom.icon,
            avatarUrl: editingRoom.avatarUrl,
            themeColor: editingRoom.themeColor,
            isPrivate: editingRoom.isPrivate,
            password: editingRoom.hasPassword ? "" : undefined,
          }}
          onCreateChannel={async (config) => {
            try {
              await updateVoiceRoom(editingRoom.id, config);
              notify("Aparência e configurações da sala atualizadas!", "success");
              void fetchRooms();
            } catch (err: any) {
              notify(err?.message || "Erro ao atualizar sala.", "error");
            } finally {
              setEditingRoom(null);
            }
          }}
        />
      )}

      {/* Modal de Senha para Salas Protegidas */}
      {passwordModalRoom && (
        <AnimatePresence>
          <div className="fixed inset-0 z-99999 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl select-none">
            <div className="absolute inset-0" onClick={() => setPasswordModalRoom(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/10 bg-[#12131a] p-6 shadow-2xl z-10 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
                  <KeyRound className="h-4 w-4" />
                  <span>Sala Protegida por Senha</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPasswordModalRoom(null)}
                  className="text-white/40 hover:text-white transition cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div>
                <h3 className="font-black text-sm text-white">{passwordModalRoom.name}</h3>
                <p className="text-xs text-white/50 mt-0.5">
                  Digite a senha configurada pelo host para ingressar.
                </p>
              </div>

              <div className="space-y-2">
                <input
                  type="password"
                  placeholder="Senha da sala"
                  value={inputPassword}
                  onChange={(e) => {
                    setInputPassword(e.target.value);
                    setPasswordError(null);
                  }}
                  autoFocus
                  className="w-full h-10 px-3.5 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-white placeholder-white/30 focus:outline-none focus:border-white/30 transition"
                />
                {passwordError && (
                  <p className="text-xs text-rose-400 font-medium">{passwordError}</p>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPasswordModalRoom(null)}
                  className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handlePasswordSubmit}
                  disabled={isJoiningWithPassword}
                  className="flex-1 py-2 rounded-xl bg-white text-black font-black text-xs hover:bg-white/90 transition shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {isJoiningWithPassword ? "Entrando..." : "Entrar"}
                </button>
              </div>
            </motion.div>
          </div>
        </AnimatePresence>
      )}
    </div>
  );
};
