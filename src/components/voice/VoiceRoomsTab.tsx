import { Loader2 } from "lucide-react";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HorizontalTabs } from "../ui/HorizontalTabs";
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
import {
  listPublicVoiceRooms,
  getMyVoiceRooms,
  closeVoiceRoom,
  updateVoiceRoom,
  subscribeToVoiceRoomTableChanges,
} from "../../services/voiceRooms";
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

  const fetchRooms = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
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

  useEffect(() => {
    // entrar/sair/editar em tempo real, sem piscar o "carregando"
    const unsubscribe = subscribeToVoiceRoomTableChanges(() => {
      void fetchRooms(true);
    });
    return unsubscribe;
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
      onJoinRoom(room.id).catch(() => {
        /* o hook já avisou o usuário */
      });
    }
  };

  // Entrou na sala (a sessão passou a existir): fecha o modal de senha sem esperar o resto da conexão
  useEffect(() => {
    if (passwordModalRoom && currentRoomId === passwordModalRoom.id) {
      setPasswordModalRoom(null);
      setIsJoiningWithPassword(false);
    }
  }, [currentRoomId, passwordModalRoom]);

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
    <div className="space-y-8 select-none">
      {/* Header with Stats & Actions */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 rounded-[var(--corner-md)] bg-[var(--tone-1)] p-6 md:p-8">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-[var(--corner-sm)] bg-[var(--tone-3)] text-[var(--ink)]">
            <Radio className="h-6 w-6 text-[var(--ink)]" />
          </div>
          <div>
            <h2 className="font-display text-[length:var(--step-3)] font-bold leading-tight text-[var(--ink)]">Canais de voz</h2>
            <p className="text-[length:var(--step-0)] text-[var(--ink-muted)]">
              Entre numa sala para jogar conversando, ou crie a sua. Até 4 pessoas por sala.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <button
            type="button"
            onClick={() => void fetchRooms()}
            disabled={isLoading}
            className="flex h-12 w-12 items-center justify-center rounded-[var(--corner-sm)] bg-[var(--tone-3)] hover:bg-[var(--tone-4)] text-[var(--ink-muted)] hover:text-[var(--ink)] transition cursor-pointer"
            title="Atualizar lista de salas"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin text-[var(--ink)]" : ""}`} />
          </button>

          {/* Test Incoming Call Simulation Button */}
          {onSimulateIncomingCall && (
            <button
              type="button"
              onClick={onSimulateIncomingCall}
              className="flex items-center gap-2 h-12 px-4 rounded-[var(--corner-sm)] bg-[var(--tone-3)] hover:bg-[var(--tone-4)] text-[var(--ink)] font-bold text-xs transition hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              title="Testar modal e toque de chamada recebida"
            >
              <PhoneIncoming className="h-4 w-4 text-[rgb(var(--launcher-accent))] animate-pulse" />
              <span className="hidden sm:inline">Testar chamada</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="flex-1 md:flex-initial flex items-center justify-center gap-2 h-12 px-6 rounded-[var(--corner-sm)] bg-[var(--ink)] text-[var(--tone-0)] font-semibold text-[length:var(--step-0)] hover:opacity-90 transition active:scale-[0.97] cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Criar canal de voz</span>
          </button>
        </div>
      </div>

      {/* Active Call Banner (Monochromatic Glassmorphic) */}
      {currentRoomId && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between p-4 rounded-[var(--corner-md)] bg-[var(--tone-3)]"
        >
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-[var(--corner-sm)] bg-[var(--tone-3)] text-[var(--ink)]">
              <Volume2 className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <div className="text-xs font-bold text-[var(--ink)] flex items-center gap-2">
                <span>Você está conectado em uma sala ativa</span>
                <span className="inline-block h-2 w-2 rounded-full bg-[var(--ink)] shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
              </div>
              <p className="text-[length:var(--step-0)] text-[var(--ink-muted)]">
                O áudio está conectado e ativo em segundo plano.
              </p>
            </div>
          </div>
          {onOpenActiveWindow && (
            <button
              type="button"
              onClick={onOpenActiveWindow}
              className="px-5 h-10 rounded-[var(--corner-sm)] bg-[var(--ink)] text-[var(--tone-0)] font-semibold text-[length:var(--step-0)] hover:opacity-90 transition cursor-pointer active:scale-95"
            >
              Abrir chamada
            </button>
          )}
        </motion.div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--ink-faint)]" />
          <input aria-label="Pesquisar canais de voz"
            type="text"
            placeholder="Pesquisar canais de voz por nome..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-12 pl-11 pr-4 rounded-[var(--corner-sm)] bg-[var(--tone-2)] text-[length:var(--step-0)] text-[var(--ink)] placeholder:text-[var(--ink-faint)] outline-none focus:bg-[var(--tone-3)] transition-colors"
          />
        </div>

        {/* Categorias: abas com o bloco de tinta que desliza */}
        <div className="w-full overflow-x-auto sm:w-auto scrollbar-none">
          <HorizontalTabs
            activeId={selectedCategory}
            onChange={(id) => setSelectedCategory(id)}
            className="t-tabs--squircle"
            tabClassName="flex h-12 items-center gap-2 whitespace-nowrap"
            tabs={[
              { id: "all", label: "Todas" },
              ...Object.entries(CATEGORY_META).map(([key, meta]) => ({
                id: key,
                label: (
                  <span className="flex items-center gap-2">
                    {meta.icon}
                    <span>{meta.label}</span>
                  </span>
                ),
              })),
            ]}
          />
        </div>
      </div>

      {/* Minhas Salas Salvas (Minhas salas só aparecem aqui) */}
      {myRooms.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-[length:var(--step-1)] font-semibold text-[var(--ink-muted)] flex items-center gap-2">
            <span>Minhas salas</span>
            <span className="text-[length:var(--step-0)] px-2 py-0.5 rounded-full bg-[var(--tone-3)] text-[var(--ink)] font-bold">
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
                  className={`group relative flex flex-col justify-between p-4.5 rounded-[var(--corner-md)] border transition-colors duration-200 ${
                    isCurrent
                      ? "bg-[var(--tone-3)] border-transparent"
                      : "bg-[var(--tone-2)] hover:bg-[var(--tone-3)] border-transparent hover:border-transparent"
                  }`}
                >
                  {room.bannerUrl ? (
                    <img src={room.bannerUrl} alt="" loading="lazy" className="-mx-4.5 -mt-4.5 mb-3 aspect-[3/1] w-[calc(100%+2.25rem)] max-w-none rounded-t-[var(--corner-md)] object-cover" />
                  ) : null}
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 font-bold text-sm text-[var(--ink)] truncate min-w-0">
                        <div
                          className="h-8 w-8 rounded-[var(--corner-sm)] flex items-center justify-center text-sm shrink-0 border"
                          style={{ borderColor: `${roomColor}60`, backgroundColor: `${roomColor}20` }}
                        >
                          {room.avatarUrl ? (
                            <img src={room.avatarUrl} alt="" className="h-full w-full rounded-[var(--corner-sm)] object-cover" />
                          ) : (
                            renderVoiceRoomIcon(room.icon, "h-4 w-4", roomColor)
                          )}
                        </div>
                        <span className="truncate">{room.name}</span>
                        {room.isPrivate ? (
                          <Lock className="h-3.5 w-3.5 text-[var(--ink)] shrink-0" />
                        ) : (
                          <Unlock className="h-3.5 w-3.5 text-[var(--ink-muted)] shrink-0" />
                        )}
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingRoom(room);
                          }}
                          className="p-1.5 rounded-lg hover:bg-[var(--tone-4)] text-[var(--ink-muted)] hover:text-[var(--ink)] transition cursor-pointer"
                          title="Editar aparência e configurações da sala"
                        >
                          <Palette className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteRoom(room.id, e)}
                          className="p-1.5 rounded-lg hover:bg-[color-mix(in_srgb,var(--danger)_18%,transparent)] text-[var(--ink-faint)] hover:text-[var(--danger)] transition cursor-pointer"
                          title="Encerrar canal permanentemente"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {room.description ? <p className="line-clamp-2 text-[length:var(--step-0)] leading-snug text-[var(--ink-muted)]">{room.description}</p> : null}
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[length:var(--step-0)] font-bold bg-[var(--tone-3)] text-[var(--ink)]">
                        {meta.icon}
                        <span>{meta.label}</span>
                      </span>

                      <span className="flex items-center gap-1 text-[length:var(--step-0)] font-bold text-[var(--ink-muted)]">
                        <Users className="h-3 w-3" />
                        <span>{room.participantsCount}/{room.maxParticipants}</span>
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-transparent flex items-center justify-between gap-2">
                    <div className="flex -space-x-2 overflow-hidden">
                      {room.participants.map((p, i) => (
                        <div
                          key={p.uid || i}
                          className="h-6 w-6 rounded-full border border-black bg-[var(--tone-3)] flex items-center justify-center text-[length:var(--step-0)] font-bold text-[var(--ink)]"
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
                        <span className="text-[length:var(--step-0)] text-[var(--ink-faint)] italic">Sala aberta (0 conectados)</span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleJoinClick(room)}
                      className={`px-3.5 py-1.5 rounded-[var(--corner-sm)] font-bold text-xs transition cursor-pointer flex items-center gap-1.5 ${
                        isCurrent
                          ? "bg-[var(--ink)] text-[var(--tone-0)] shadow-sm"
                          : "bg-[var(--tone-4)] text-[var(--ink)] hover:opacity-90 hover:text-[var(--tone-0)] shadow-sm"
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
        <h3 className="text-[length:var(--step-1)] font-semibold text-[var(--ink-muted)] flex items-center gap-2">
          <span>Salas Públicas Globais</span>
          <span className="text-[length:var(--step-0)] px-2 py-0.5 rounded-full bg-[var(--tone-3)] text-[var(--ink)] font-bold">
            {globalOtherRooms.length}
          </span>
        </h3>

        {globalOtherRooms.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center p-10 rounded-[var(--corner-md)] bg-[var(--tone-2)]  text-center space-y-3">
            <Radio className="h-8 w-8 text-[var(--ink-faint)]" />
            <div>
              <p className="text-sm font-bold text-[var(--ink)]">Nenhuma outra sala pública ativa no momento</p>
              <p className="text-xs text-[var(--ink-faint)] mt-0.5">As salas criadas por outros amigos aparecerão aqui.</p>
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
                className={`flex flex-col justify-between p-4.5 rounded-[var(--corner-md)] border transition-colors duration-200 ${
                  isCurrent
                    ? "bg-[var(--tone-3)] border-transparent"
                    : isFull
                    ? "bg-[var(--tone-3)] border-transparent opacity-70"
                    : "bg-[var(--tone-2)] hover:bg-[var(--tone-3)] border-transparent hover:border-transparent"
                }`}
              >
                {room.bannerUrl ? (
                    <img src={room.bannerUrl} alt="" loading="lazy" className="-mx-4.5 -mt-4.5 mb-3 aspect-[3/1] w-[calc(100%+2.25rem)] max-w-none rounded-t-[var(--corner-md)] object-cover" />
                  ) : null}
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 font-bold text-sm text-[var(--ink)] truncate min-w-0">
                      <div
                        className="h-8 w-8 rounded-[var(--corner-sm)] flex items-center justify-center text-sm shrink-0 border"
                        style={{ borderColor: `${roomColor}60`, backgroundColor: `${roomColor}20` }}
                      >
                        {room.avatarUrl ? (
                          <img src={room.avatarUrl} alt="" className="h-full w-full rounded-[var(--corner-sm)] object-cover" />
                        ) : (
                          renderVoiceRoomIcon(room.icon, "h-4 w-4", roomColor)
                        )}
                      </div>
                      <h4 className="font-bold text-sm text-[var(--ink)] truncate">{room.name}</h4>
                    </div>

                    {isFull && (
                      <span className="px-2 py-0.5 rounded-md bg-[color-mix(in_srgb,var(--danger)_18%,transparent)] text-[var(--danger)] text-[length:var(--step-0)] font-bold shrink-0">
                        Lotada
                      </span>
                    )}
                  </div>

                  {room.description ? <p className="line-clamp-2 text-[length:var(--step-0)] leading-snug text-[var(--ink-muted)]">{room.description}</p> : null}
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[length:var(--step-0)] font-bold bg-[var(--tone-3)] text-[var(--ink)]">
                      {meta.icon}
                      <span>{meta.label}</span>
                    </span>

                    <span className={`flex items-center gap-1 text-[length:var(--step-0)] font-bold ${isFull ? "text-[var(--danger)]" : "text-[var(--ink-muted)]"}`}>
                      <Users className="h-3 w-3" />
                      <span>{room.participantsCount}/{room.maxParticipants}</span>
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-transparent flex items-center justify-between gap-2">
                  <div className="flex -space-x-2 overflow-hidden">
                    {room.participants.slice(0, 4).map((p, i) => (
                      <div
                        key={p.uid || i}
                        className="h-6 w-6 rounded-full border border-black bg-[var(--tone-3)] flex items-center justify-center text-[length:var(--step-0)] font-bold text-[var(--ink)]"
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
                      <span className="text-[length:var(--step-0)] text-[var(--ink-faint)] italic">Sala aberta (0 conectados)</span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleJoinClick(room)}
                    disabled={isFull && !isCurrent}
                    className={`px-4 py-1.5 rounded-[var(--corner-sm)] font-bold text-xs transition cursor-pointer flex items-center gap-1.5 ${
                      isCurrent
                        ? "bg-[var(--ink)] text-[var(--tone-0)] shadow-sm"
                        : isFull
                        ? "bg-[var(--tone-3)] text-[var(--ink-faint)] cursor-not-allowed"
                        : "bg-[var(--ink)] text-[var(--tone-0)] hover:opacity-90 shadow-sm hover:scale-[1.02] active:scale-[0.98]"
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
          try {
            await onCreateRoom(config);
            void fetchRooms();
          } catch (err) {
            // createAndJoinRoom já notifica; rethrow deixa o modal mostrar o erro
            throw err;
          }
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
            description: editingRoom.description,
            bannerUrl: editingRoom.bannerUrl,
            isPrivate: editingRoom.isPrivate,
            password: editingRoom.hasPassword ? "" : undefined,
          }}
          onCreateChannel={async (config) => {
            try {
              await updateVoiceRoom(editingRoom.id, config);
              notify("Sala atualizada.", "success");
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
              className="relative w-full max-w-sm overflow-hidden rounded-[var(--corner-lg)] bg-[var(--tone-2)] p-6 shadow-2xl z-10 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[var(--ink)] font-bold text-xs">
                  <KeyRound className="h-4 w-4" />
                  <span>Sala Protegida por Senha</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPasswordModalRoom(null)}
                  className="text-[var(--ink-faint)] hover:text-[var(--ink)] transition cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div>
                <h3 className="font-bold text-sm text-[var(--ink)]">{passwordModalRoom.name}</h3>
                <p className="text-xs text-[var(--ink-muted)] mt-0.5">
                  Digite a senha configurada pelo host para ingressar.
                </p>
              </div>

              <div className="space-y-2">
                <input aria-label="Senha da sala"
                  type="password"
                  placeholder="Senha da sala"
                  value={inputPassword}
                  onChange={(e) => {
                    setInputPassword(e.target.value);
                    setPasswordError(null);
                  }}
                  autoFocus
                  className="w-full h-10 px-3.5 rounded-[var(--corner-sm)] bg-[var(--tone-3)] text-xs font-semibold text-[var(--ink)] placeholder-white/30 focus:outline-none focus:border-transparent transition"
                />
                {passwordError && (
                  <p className="text-xs text-[var(--danger)] font-medium">{passwordError}</p>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPasswordModalRoom(null)}
                  className="flex-1 py-2 rounded-[var(--corner-sm)] bg-[var(--tone-3)] hover:bg-[var(--tone-4)] text-[var(--ink)] font-bold text-xs transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handlePasswordSubmit}
                  disabled={isJoiningWithPassword}
                  className="flex-1 py-2 rounded-[var(--corner-sm)] bg-[var(--ink)] text-[var(--tone-0)] font-bold text-xs hover:opacity-90 transition shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {isJoiningWithPassword ? (
                    <span className="inline-flex items-center justify-center gap-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                      Conectando…
                    </span>
                  ) : (
                    "Entrar"
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        </AnimatePresence>
      )}
    </div>
  );
};
