import React, { useState, useMemo, useCallback } from "react";
import { SectionTransition } from "../components/ui/SectionTransition";
import { isManualDnd, setManualDnd } from "../services/presenceStatus";
import {
  BellOff,
  Search,
  User,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { ConsolePageLayout } from "../components/ui/ConsolePageLayout";
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
import { useDiscordFriendMatches } from "../hooks/useDiscordFriendMatches";
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

/**
 * Ações do cabeçalho: o modo "Não perturbe" (um interruptor, não um rótulo que troca) e a ação
 * principal da página. Uma só ação preenchida por tela.
 */
export const FriendsPageActions: React.FC<{
  dnd: boolean;
  onToggleDnd: () => void;
  onAddFriendClick: () => void;
  playSound?: (type: SoundEffectType) => void;
}> = ({ dnd, onToggleDnd, onAddFriendClick, playSound }) => (
  <>
    <button
      type="button"
      aria-pressed={dnd}
      onClick={onToggleDnd}
      title="Não perturbe"
      className={`inline-flex h-12 cursor-pointer items-center gap-2.5 rounded-[var(--corner-sm)] px-5 text-[length:var(--step-0)] font-semibold transition-colors ${
        dnd ? "bg-[var(--danger)] text-[var(--tone-0)]" : "bg-[var(--tone-3)] text-[var(--ink)] hover:bg-[var(--tone-4)]"
      }`}
    >
      <BellOff className="h-4 w-4" aria-hidden />
      Não perturbe
    </button>
    <button
      type="button"
      onMouseEnter={() => playSound?.("hover")}
      onClick={onAddFriendClick}
      className="inline-flex h-12 cursor-pointer items-center gap-2.5 rounded-[var(--corner-sm)] bg-[var(--ink)] px-6 text-[length:var(--fs-label)] font-bold uppercase tracking-[0.06em] text-[var(--tone-0)] transition active:scale-[0.97] hover:opacity-90"
    >
      <UserPlus className="h-4 w-4" aria-hidden />
      Adicionar amigo
    </button>
  </>
);

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

  const discordMatch = useDiscordFriendMatches(friends);

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
      playSound?.("tabSwitch");
      setActiveSubTab(tabs[nextIdx]);
    },
    [activeSubTab, playSound],
  );

  useGamepadButton("R1", () => switchTab(1), true, 10);
  useGamepadButton("L1", () => switchTab(-1), true, 10);

  return (
    <ConsolePageLayout
      title="Amigos"
      systemPage=""
      emptyLine="Conecte-se e jogue junto."
      readings={
        friends.length > 0
          ? [
              { label: "Amigos", value: friends.length },
              { label: "Online", value: onlineCount },
              { label: "Jogando", value: playingCount, live: true },
            ]
          : null
      }
      actions={
        <FriendsPageActions
          dnd={dnd}
          onToggleDnd={() => {
            const next = !dnd;
            setDnd(next);
            setManualDnd(next);
          }}
          onAddFriendClick={onAddFriendClick}
          playSound={playSound}
        />
      }
      tabs={
        <FriendsSubTabs
          activeTab={activeSubTab}
          onTabChange={(id) => setActiveSubTab(id)}
          incomingRequestsCount={incomingRequests.length}
          totalFriendsCount={friends.length}
          unreadCount={totalUnreadCount}
          playSound={playSound}
        />
      }
    >
      <SectionTransition id={activeSubTab}>
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
          discordMatch={discordMatch}
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
      </SectionTransition>
    </ConsolePageLayout>
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
        <div className="flex items-center justify-between gap-3 border-b border-[color:var(--border-subtle)] pb-4">
          <h2 className="text-[length:var(--step-1)] font-bold text-[var(--ink)]">
            {t("addFriendTitle") || "Adicionar amigo"}
          </h2>
          <button
            type="button"
            onClick={handleCloseModal}
            aria-label="Fechar"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--tone-3)] text-[var(--ink-muted)] transition-colors hover:bg-[var(--tone-4)] hover:text-[var(--ink)] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div>
          <label htmlFor="add-friend-query" className="text-[length:var(--step-0)] font-body font-medium text-[var(--ink-muted)] block mb-2">
            Busque por nome de usuário ou email
          </label>
          <form onSubmit={handleSearch} className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ink-faint)]" />
              <input
                id="add-friend-query"
                type="text"
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                placeholder={t("addFriendSearchPlaceholder") || "Digite o nome ou email do usuário..."}
                className="w-full h-12 pl-11 pr-11 rounded-full bg-[var(--surface-raised)] ring-1 ring-[color:var(--border-subtle)] text-[length:var(--step-1)] font-body text-[var(--ink)] placeholder:text-[var(--ink-faint)] transition-colors"
                autoFocus
              />
              {query && (
                <button
                  type="button"
                  onClick={handleClearQuery}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-[var(--ink-faint)] hover:text-[var(--ink)] hover:bg-[var(--tone-3)] transition-colors cursor-pointer"
                  aria-label="Limpar campo"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <button
              type="submit"
              disabled={searching}
              onMouseEnter={() => playSound?.("hover")}
              className="cursor-pointer h-12 px-7 rounded-full bg-[var(--ink)] text-[var(--tone-0)] font-body font-semibold text-[length:var(--step-0)] disabled:opacity-50 transition-transform active:scale-[0.98]"
            >
              {searching ? "Buscando..." : (t("addFriendSearchButton") || "Buscar")}
            </button>
          </form>
        </div>

        {/* Recent Search Chips */}
        {recentSearches.length > 0 && (!query.trim() || !hasSearched) && (
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-[length:var(--step-0)] font-body uppercase tracking-wider text-[var(--ink-faint)] block">
                Pesquisados recentemente
              </span>
              <button
                type="button"
                onClick={() => {
                  setRecentSearches([]);
                  localStorage.removeItem("checkpoint_recent_searched_users");
                }}
                className="text-[length:var(--step-0)] text-[var(--ink-faint)] hover:text-[var(--ink-muted)] transition-colors cursor-pointer"
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
                  className="px-3 py-1.5 rounded-full bg-[var(--surface-raised)] ring-1 ring-[color:var(--border-subtle)] hover:bg-[var(--tone-3)] text-[length:var(--step-0)] font-body text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors cursor-pointer"
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
                className="flex items-center justify-between p-4 rounded-[var(--corner-md)] bg-[var(--surface-raised)] hover:bg-[var(--tone-3)] ring-1 ring-[color:var(--border-subtle)] transition-colors"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-[28%] overflow-hidden bg-[var(--tone-3)] flex items-center justify-center shrink-0">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-6 h-6 text-[var(--ink-faint)]" />
                    )}
                  </div>
                  <div>
                    <p className="text-[length:var(--step-1)] font-display font-bold text-[var(--ink)] tracking-tight">
                      {user.displayName || "Jogador"}
                    </p>
                    <p className="text-[length:var(--step-0)] font-body text-[var(--ink-faint)] mt-0.5">
                      Nível {user.level || 1}
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
                      className="cursor-pointer px-4 py-2 rounded-full bg-[var(--tone-3)] hover:bg-[var(--tone-4)] text-[var(--ink)] font-body font-semibold text-[length:var(--step-0)] transition-colors active:scale-95"
                    >
                      {t("addFriendViewProfile") || "Ver perfil"}
                    </button>
                  )}
                  {isFriend ? (
                    <span className="px-4 py-2 rounded-full ring-1 ring-[color:var(--live)] text-[var(--live)] text-[length:var(--step-0)] font-semibold">
                      Amigo
                    </span>
                  ) : isOutgoing ? (
                    <span className="px-4 py-2 rounded-full bg-[var(--tone-3)] text-[var(--ink-muted)] text-[length:var(--step-0)] font-medium">
                      Pendente
                    </span>
                  ) : isIncoming ? (
                    <span className="px-4 py-2 rounded-full ring-1 ring-[color:var(--border-strong)] text-[var(--ink)] text-[length:var(--step-0)] font-semibold">
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
                      className="cursor-pointer px-5 py-2 rounded-full bg-[var(--ink)] text-[var(--tone-0)] font-body font-semibold text-[length:var(--step-0)] transition-transform active:scale-95"
                    >
                      {t("addFriendSend") || "Enviar"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {hasSearched && results.length === 0 && !searching && (
            <div className="text-center py-8 rounded-[var(--corner-md)] bg-[var(--surface-raised)]">
              <p className="text-[length:var(--step-0)] font-body text-[var(--ink-muted)]">Nenhum jogador encontrado para essa busca.</p>
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  );
};

export default FriendsPage;
