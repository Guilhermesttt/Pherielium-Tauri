import React, { useState, useMemo, useCallback } from "react";
import { isManualDnd, setManualDnd } from "../services/presenceStatus";
import {
  Search,
  User,
  Users,
  X,
} from "lucide-react";
import { SystemPageShell } from "../components/ui/SystemPageShell";
import ModalShell from "../components/ui/ModalShell";
import { StandardEmptyState } from "../components/ui/StateViews";
import { usePreferences, type LauncherLanguage } from "../context/PreferencesContext";
import { searchCheckpointFriends } from "../services/checkpointFriends";
import type { CheckpointFriendRequest, Game, SocialFriend, UserProfile } from "../types/domain";
import type { SoundEffectType } from "../hooks/useSoundEffects";
import { VoiceRoomsTab } from "../components/voice/VoiceRoomsTab";
import { useVoiceCallContext } from "../context/VoiceCallContext";
import { useAuth } from "../auth/AuthProvider";
import { useNotification } from "../components/NotificationCenter";
import { useGamepadButton } from "../context/GamepadContext";
import { FriendsSubTabs } from "@/components/social/FriendsSubTabs";

type TranslationFn = ReturnType<typeof usePreferences>["t"];
type BrandIcon = React.ComponentType<{ className?: string; style?: React.CSSProperties }>;

import { FriendsRoster } from "../components/friends/FriendsRoster";
import { ChatsPanel } from "../components/friends/ChatsPanel";
import { RequestsPanel } from "../components/friends/RequestsPanel";

export type SocialSubTab = "AMIGOS" | "CHAT" | "SALAS" | "SOLICITAÇÕES";

export interface FriendsPageProps {
  t: TranslationFn;
  language: LauncherLanguage;
  discordConnected: boolean;
  userDisplay: string;
  discordUsername?: string;
  discordAvatar?: string;
  DiscordIcon: BrandIcon;
  friends: SocialFriend[];
  unreadMessagesByFriend: Record<string, number>;
  incomingRequests: CheckpointFriendRequest[];
  currentPresenceGame?: string | null;
  onConnectDiscord: () => void;
  onRemoveFriend: (friend: SocialFriend) => void;
  onViewFriendProfile: (friend: SocialFriend) => void;
  friendProfileLoadingId?: string | null;
  onAcceptRequest: (uid: string) => void;
  onRejectRequest: (uid: string) => void;
  onAddFriendClick: () => void;
  onOpenChat: (friend: SocialFriend) => void;
  onStartVoiceCall?: (friend: SocialFriend, withVideo?: boolean) => void;
  onStartTestCall?: () => void;
  playSound?: (type: SoundEffectType) => void;
  /** biblioteca de quem está vendo (arte dos jogos que os amigos estão jogando) */
  games?: Game[];
}

// ============================================================
// SUBCOMPONENTES MEMOIZADOS DE AMIGOS
// ============================================================

export const FriendsPage: React.FC<FriendsPageProps> = React.memo(({
  discordConnected,
  friends,
  unreadMessagesByFriend,
  incomingRequests,
  onConnectDiscord,
  onRemoveFriend,
  onViewFriendProfile,
  friendProfileLoadingId,
  onAcceptRequest,
  onRejectRequest,
  onAddFriendClick,
  onOpenChat,
  onStartVoiceCall,
  playSound,
  games,
}) => {
  const [friendSearch, setFriendSearch] = useState("");
  const [dnd, setDnd] = useState(isManualDnd);
  const [activeSubTab, setActiveSubTab] = useState<SocialSubTab>("AMIGOS");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ONLINE" | "PLAYING" | "OFFLINE">("ALL");
  const voiceCall = useVoiceCallContext();
  const { userProfile } = useAuth();
  const { notify } = useNotification();

  const totalUnreadCount = useMemo(
    () => Object.values(unreadMessagesByFriend).reduce((acc, count) => acc + (count || 0), 0),
    [unreadMessagesByFriend],
  );

  const onlineCount = useMemo(() => friends.filter((f) => f.status !== "offline").length, [friends]);
  const playingCount = useMemo(() => friends.filter((f) => f.status === "playing").length, [friends]);

  const checkpointFriends = useMemo(
    () => friends.filter((f) => f.source === "checkpoint"),
    [friends],
  );


  // Controller: Tab switching
  const switchTab = useCallback(
    (direction: 1 | -1) => {
      const tabs: SocialSubTab[] = ["AMIGOS", "CHAT", "SALAS", "SOLICITAÇÕES"];
      const currentIdx = tabs.indexOf(activeSubTab);
      const nextIdx = (currentIdx + direction + tabs.length) % tabs.length;
      playSound?.("select");
      setActiveSubTab(tabs[nextIdx]);
    },
    [activeSubTab, playSound],
  );

  useGamepadButton("R1", () => switchTab(1), true, 10);
  useGamepadButton("L1", () => switchTab(-1), true, 10);

  return (
    <SystemPageShell
      title="Amigos"
      description={friends.length > 0 ? `${friends.length} amigos · ${onlineCount} online · ${playingCount} jogando` : "Conecte-se e jogue junto."}
      actions={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const next = !dnd;
              setDnd(next);
              setManualDnd(next);
            }}
            className={`cursor-pointer rounded-full px-4 py-2.5 text-xs font-bold tracking-wide ${
              dnd ? "bg-rose-500/20 text-rose-200" : "bg-white/10 text-white/80"
            }`}
          >
            {dnd ? "Não perturbe" : "Disponível"}
          </button>
          <button
            type="button"
            onMouseEnter={() => playSound?.("hover")}
            onClick={onAddFriendClick}
            className="cursor-pointer flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-black font-body font-bold text-xs tracking-wide shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:bg-white/90 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <span>+ ADICIONAR AMIGO</span>
          </button>
        </div>
      }
    >
      <FriendsSubTabs
        activeTab={activeSubTab}
        onTabChange={(id) => setActiveSubTab(id)}
        incomingRequestsCount={incomingRequests.length}
        totalFriendsCount={friends.length}
        onlineCount={onlineCount}
        unreadCount={totalUnreadCount}
        playSound={playSound}
      />

      {/* Estado vazio de página inteira: sem nenhum amigo ainda, evita mostrar
          o layout de 2 colunas totalmente vazio (identidade + busca + grade). */}
      {activeSubTab === "AMIGOS" && friends.length === 0 && (
        <div className="py-6 flex justify-center w-full">
          <StandardEmptyState
            icon={Users}
            illustrated="friends"
            title="Sua lista de amigos está vazia"
            description="Adicione amigos para ver o status deles, conversar e jogar junto por aqui."
            actionLabel="Adicionar amigo"
            onAction={onAddFriendClick}
          />
        </div>
      )}

      {/* Lista + painel do amigo (estilo Steam/Xbox) */}
      {activeSubTab === "AMIGOS" && friends.length > 0 && (
        <FriendsRoster
          friends={friends}
          games={games}
          unreadByFriend={unreadMessagesByFriend}
          search={friendSearch}
          onSearchChange={setFriendSearch}
          filter={statusFilter}
          onFilterChange={setStatusFilter}
          isCallActiveWith={(id) => voiceCall.isCallActiveWithFriend(id)}
          loadingProfileId={friendProfileLoadingId}
          onOpenChat={onOpenChat}
          onStartVoiceCall={onStartVoiceCall}
          onViewProfile={onViewFriendProfile}
          onRemoveFriend={onRemoveFriend}
          playSound={playSound}
          discord={{
            connected: discordConnected || Boolean(userProfile?.discordUsername),
            onConnect: onConnectDiscord,
          }}
        />
      )}

      {/* SubTab: CHATS */}
      {activeSubTab === "CHAT" && (
        <ChatsPanel
          friends={checkpointFriends}
          unreadByFriend={unreadMessagesByFriend}
          onOpenChat={onOpenChat}
          onStartVoiceCall={onStartVoiceCall}
          onAddFriend={onAddFriendClick}
          playSound={playSound}
        />
      )}

      {/* SubTab: CANAIS DE VOZ */}
      {activeSubTab === "SALAS" && (
        <VoiceRoomsTab
          userProfile={userProfile}
          currentRoomId={voiceCall.session?.chatId}
          onJoinRoom={async (roomId, password) => {
            await voiceCall.joinRoom(roomId, password);
          }}
          onCreateRoom={async (config) => {
            await voiceCall.createAndJoinRoom(config);
          }}
          onOpenActiveWindow={() => {
            voiceCall.setIsVoiceWindowOpen(true);
          }}
          onSimulateIncomingCall={
            import.meta.env.DEV && typeof voiceCall.simulateIncomingCall === "function"
              ? () => voiceCall.simulateIncomingCall(false)
              : undefined
          }
          notify={notify}
        />
      )}

      {/* SubTab: SOLICITAÇÕES */}
      {activeSubTab === "SOLICITAÇÕES" && (
        <RequestsPanel
          requests={incomingRequests}
          onAccept={onAcceptRequest}
          onReject={onRejectRequest}
          onAddFriend={onAddFriendClick}
          playSound={playSound}
        />
      )}
    </SystemPageShell>
  );
});

export interface AddFriendModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddFriend: (friendProfile: UserProfile) => void;
  onViewProfile?: (profile: UserProfile) => void;
  currentUserUid?: string;
  friendIds: Set<string>;
  outgoingRequestIds: Set<string>;
  incomingRequestIds: Set<string>;
  playSound?: (type: SoundEffectType) => void;
  t: TranslationFn;
}

export const AddFriendModal: React.FC<AddFriendModalProps> = ({
  isOpen,
  onClose,
  onAddFriend,
  onViewProfile,
  currentUserUid,
  friendIds,
  outgoingRequestIds,
  incomingRequestIds,
  playSound,
  t,
}) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("checkpoint_recent_searched_users") || "[]");
    } catch {
      return [];
    }
  });

  const saveRecentSearch = (name: string) => {
    if (!name.trim()) return;
    const updated = Array.from(new Set([name.trim(), ...recentSearches])).slice(0, 5);
    setRecentSearches(updated);
    try {
      localStorage.setItem("checkpoint_recent_searched_users", JSON.stringify(updated));
    } catch {
      // Ignora erro de localStorage
    }
  };

  const handleQueryChange = (val: string) => {
    setQuery(val);
    if (!val.trim()) {
      setResults([]);
      setHasSearched(false);
    }
  };

  const handleClearQuery = () => {
    setQuery("");
    setResults([]);
    setHasSearched(false);
    playSound?.("back");
  };

  const handleSearch = async (e?: React.FormEvent, directQuery?: string) => {
    if (e) e.preventDefault();
    const targetQuery = (directQuery ?? query).trim();
    if (!targetQuery) return;
    playSound?.("select");
    setSearching(true);
    setHasSearched(true);
    saveRecentSearch(targetQuery);
    try {
      const users = await searchCheckpointFriends(targetQuery);
      setResults(users.filter((u) => u.uid !== currentUserUid));
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleCloseModal = () => {
    playSound?.("back");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={handleCloseModal}
      title={t("addFriendTitle") || "Adicionar amigo"}
      maxWidthClassName="max-w-xl"
    >
      <div className="space-y-5 p-6">
        <div className="flex items-center justify-between gap-3 border-b border-white/8 pb-4">
          <h2 className="text-sm font-bold text-white">
            {t("addFriendTitle") || "Adicionar amigo"}
          </h2>
          <button
            type="button"
            onClick={handleCloseModal}
            aria-label="Fechar"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/8 text-white/60 transition-colors hover:bg-white/10 hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div>
          <label className="text-xs font-body font-medium text-white/70 block mb-2">
            Busque por nome de usuário ou email
          </label>
          <form onSubmit={handleSearch} className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35" />
              <input
                type="text"
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                placeholder={t("addFriendSearchPlaceholder") || "Digite o nome ou email do usuário..."}
                className="w-full h-12 pl-11 pr-11 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-ui-detail)] text-xs font-body text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 shadow-inner transition-all "
                autoFocus
              />
              {query && (
                <button
                  type="button"
                  onClick={handleClearQuery}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                  title="Limpar campo"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <button
              type="submit"
              disabled={searching}
              onMouseEnter={() => playSound?.("hover")}
              className="cursor-pointer h-12 px-7 rounded-2xl bg-white text-black font-body font-bold text-xs hover:bg-white/90 disabled:opacity-50 transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)] active:scale-98"
            >
              {searching ? "Buscando..." : (t("addFriendSearchButton") || "Buscar")}
            </button>
          </form>
        </div>

        {/* Recent Search Chips */}
        {recentSearches.length > 0 && (!query.trim() || !hasSearched) && (
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] font-body uppercase tracking-wider text-white/40 block">
                Pesquisados recentemente
              </span>
              <button
                type="button"
                onClick={() => {
                  setRecentSearches([]);
                  localStorage.removeItem("checkpoint_recent_searched_users");
                }}
                className="text-[10px] text-white/30 hover:text-white/70 transition-colors cursor-pointer"
              >
                Limpar histórico
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {recentSearches.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    setQuery(item);
                    void handleSearch(undefined, item);
                  }}
                  onMouseEnter={() => playSound?.("hover")}
                  className="px-3 py-1 rounded-xl bg-[var(--color-surface)] border border-[var(--color-ui-detail)] hover:border-white/20 text-xs font-body text-white/70 hover:text-white transition-all cursor-pointer"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Results List */}
        <div className="space-y-3 max-h-80 overflow-y-auto no-scrollbar pt-1">
          {results.map((user) => {
            const isFriend = friendIds.has(user.uid);
            const isOutgoing = outgoingRequestIds.has(user.uid);
            const isIncoming = incomingRequestIds.has(user.uid);

            return (
              <div
                key={user.uid}
                className="flex items-center justify-between p-4 rounded-2xl bg-[var(--color-surface)] hover:bg-[#222222] border border-[var(--color-ui-detail)] hover:border-white/20 transition-all shadow-md "
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl overflow-hidden bg-[var(--color-surface)] border border-white/10 flex items-center justify-center shrink-0">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-6 h-6 text-white/40" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-display font-bold text-white tracking-tight">
                      {user.displayName || "Jogador"}
                    </p>
                    <p className="text-[10px] font-body text-white/40 uppercase tracking-wider mt-0.5">
                      NÍVEL {user.level || 1}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  {onViewProfile && (
                    <button
                      type="button"
                      onMouseEnter={() => playSound?.("hover")}
                      onClick={() => {
                        playSound?.("select");
                        onViewProfile(user);
                      }}
                      className="cursor-pointer px-4 py-2 rounded-xl bg-[var(--color-surface)] border border-white/10 hover:bg-white/10 text-white font-body font-semibold text-xs transition-all active:scale-95"
                    >
                      {t("addFriendViewProfile") || "Ver perfil"}
                    </button>
                  )}
                  {isFriend ? (
                    <span className="px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
                      Amigo
                    </span>
                  ) : isOutgoing ? (
                    <span className="px-4 py-2 rounded-xl bg-white/10 text-white/60 text-xs font-medium">
                      Pendente
                    </span>
                  ) : isIncoming ? (
                    <span className="px-4 py-2 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 text-xs font-semibold">
                      Solicitou
                    </span>
                  ) : (
                    <button
                      type="button"
                      onMouseEnter={() => playSound?.("hover")}
                      onClick={() => {
                        playSound?.("select");
                        onAddFriend(user);
                      }}
                      className="cursor-pointer px-5 py-2 rounded-xl bg-white text-black font-body font-bold text-xs hover:bg-white/90 shadow-[0_0_15px_rgba(255,255,255,0.2)] transition-all active:scale-95"
                    >
                      {t("addFriendSend") || "Enviar"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {hasSearched && results.length === 0 && !searching && (
            <div className="text-center py-8 rounded-2xl bg-[var(--color-surface)] border border-dashed border-[var(--color-ui-detail)]">
              <p className="text-xs font-body text-white/40">Nenhum jogador encontrado para essa busca.</p>
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  );
};

export default FriendsPage;
