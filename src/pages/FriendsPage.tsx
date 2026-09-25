import React, { useState, useMemo, useCallback } from "react";
import {
  MessageSquare,
  Phone,
  Search,
  User,
  Users,
  Video,
  Activity,
  ChevronDown,
  LayoutGrid,
  ListFilter,
  X,
  ChevronLeft,
  ChevronRight,
  Gamepad2,
  UserPlus,
  UserMinus,
  RadioReceiver,
  Loader2,
} from "lucide-react";
import {
  MessageSquare as AnimateUIMessageSquare,
  Radio as AnimateUIRadio,
  UserPlus as AnimateUIUserPlus,
  Users as AnimateUIUsers,
} from "../components/animate-ui/icons";
import { SystemPageShell } from "../components/ui/SystemPageShell";
import ModalShell from "../components/ui/ModalShell";
import { StandardEmptyState } from "../components/ui/StateViews";
import { GhostSelect } from "../components/ui/GhostSelect";
import { usePreferences, type LauncherLanguage } from "../context/PreferencesContext";
import { searchCheckpointFriends } from "../services/checkpointFriends";
import type { CheckpointFriendRequest, SocialFriend, UserProfile } from "../types/domain";
import type { SoundEffectType } from "../hooks/useSoundEffects";
import { VoiceRoomsTab } from "../components/voice/VoiceRoomsTab";
import { useVoiceCallContext } from "../context/VoiceCallContext";
import { useAuth } from "../auth/AuthProvider";
import { useNotification } from "../components/NotificationCenter";
import { DiscordBrandIcon, SteamBrandIcon } from "../components/Sidebar";
import { useGamepadButton } from "../context/GamepadContext";
import { FriendsSubTabs } from "@/components/social/FriendsSubTabs";

type TranslationFn = ReturnType<typeof usePreferences>["t"];
type BrandIcon = React.ComponentType<{ className?: string; style?: React.CSSProperties }>;

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
}

// ============================================================
// SUBCOMPONENTES MEMOIZADOS DE AMIGOS
// ============================================================

const FriendOnlineCard = React.memo<{
  friend: SocialFriend;
  unreadCount: number;
  isCallActive: boolean;
  isLoadingProfile: boolean;
  variant?: "grid" | "list";
  onOpenChat: (friend: SocialFriend) => void;
  onStartVoiceCall?: (friend: SocialFriend, withVideo?: boolean) => void;
  onViewFriendProfile: (friend: SocialFriend) => void;
  onRemoveFriend?: (friend: SocialFriend) => void;
  playSound?: (type: SoundEffectType) => void;
}>(({
  friend,
  unreadCount,
  isCallActive,
  isLoadingProfile,
  variant = "grid",
  onOpenChat,
  onStartVoiceCall,
  onViewFriendProfile,
  onRemoveFriend,
  playSound,
}) => {
  const handleChat = useCallback(() => onOpenChat(friend), [friend, onOpenChat]);
  const handleCall = useCallback(() => onStartVoiceCall?.(friend, false), [friend, onStartVoiceCall]);
  const handleProfile = useCallback(() => onViewFriendProfile(friend), [friend, onViewFriendProfile]);
  const handleRemove = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onRemoveFriend?.(friend);
  }, [friend, onRemoveFriend]);
  const handleMouseEnter = useCallback(() => playSound?.("hover"), [playSound]);

  const avatar = (
    <div
      onClick={handleProfile}
      className="relative cursor-pointer group/avatar shrink-0"
      title="Ver perfil"
    >
      <div className="w-10 h-10 rounded-xl overflow-hidden bg-[var(--color-surface)] border border-white/15 group-hover/avatar:border-white/40 transition-colors">
        {friend.avatar ? (
          <img src={friend.avatar} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/50">
            <User className="w-5 h-5" />
          </div>
        )}
      </div>
      {isLoadingProfile && (
        <div className="absolute inset-0 rounded-xl bg-black/60 flex items-center justify-center z-10">
          <Loader2 className="w-4 h-4 text-white animate-spin" />
        </div>
      )}
      <span
        className={`absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-black/80 z-20 ${friend.status === "playing"
          ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]"
          : "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]"
          }`}
      />
    </div>
  );

  const nameBlock = (
    <div
      onClick={handleProfile}
      className="min-w-0 flex-1 cursor-pointer group/name"
      title="Ver perfil"
    >
      <h3 className="text-sm font-display font-semibold text-white truncate group-hover/name:text-white/80 transition-colors">
        {friend.name}
      </h3>
      <p className={`text-xs font-body font-medium truncate ${friend.status === "playing" ? "text-emerald-400 flex items-center gap-1 font-semibold" : "text-white/70"
        }`}>
        {friend.status === "playing" ? (
          <>
            <Gamepad2 className="w-3 h-3 text-emerald-400 shrink-0 inline" />
            <span>Jogando {friend.playing || "um jogo"}</span>
          </>
        ) : (
          "Online"
        )}
      </p>
    </div>
  );

  const chatButton = (
    <button
      type="button"
      onMouseEnter={handleMouseEnter}
      onClick={handleChat}
      title="Chat"
      className={`min-w-0 h-9 px-3 rounded-xl bg-[var(--color-surface)] hover:bg-[#222222] border border-[var(--color-ui-detail)] hover:border-white/20 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all duration-160 cursor-pointer active:scale-[0.97] outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${variant === "grid" ? "flex-1 max-w-[150px]" : "shrink-0"
        }`}
    >
      <MessageSquare className="w-3.5 h-3.5 text-white/80 shrink-0" />
      <span className="truncate">Chat</span>
      {unreadCount > 0 && (
        <span className="px-1.5 py-0.2 rounded-full bg-white text-black text-[10px] font-bold shrink-0">
          {unreadCount}
        </span>
      )}
    </button>
  );

  const actionButtons = (
    <div className="flex items-center gap-1.5 shrink-0">
      {onStartVoiceCall && (
        <button
          type="button"
          onMouseEnter={handleMouseEnter}
          onClick={handleCall}
          title="Ligar"
          aria-label={`Ligar para ${friend.name}`}
          className={`h-9 w-9 rounded-xl border transition-all duration-160 cursor-pointer flex items-center justify-center shrink-0 active:scale-[0.96] outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${isCallActive
            ? "bg-white text-black border-white shadow-md animate-pulse"
            : "bg-[var(--color-surface)] hover:bg-[#222222] border border-[var(--color-ui-detail)] hover:border-white/20 text-white/70 hover:text-white"
            }`}
        >
          <Phone className="w-3.5 h-3.5" />
        </button>
      )}

      <button
        type="button"
        onMouseEnter={handleMouseEnter}
        onClick={handleProfile}
        disabled={isLoadingProfile}
        title="Ver Perfil"
        aria-label={`Ver perfil de ${friend.name}`}
        className={`h-9 w-9 rounded-xl border transition-all duration-160 cursor-pointer flex items-center justify-center shrink-0 active:scale-[0.96] outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${isLoadingProfile
            ? "bg-white/20 border-white/30 text-white shadow-[0_0_12px_rgba(255,255,255,0.2)] cursor-wait"
            : "bg-[var(--color-surface)] hover:bg-[#222222] border-[var(--color-ui-detail)] hover:border-white/20 text-white/70 hover:text-white"
          }`}
      >
        {isLoadingProfile ? (
          <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
        ) : (
          <User className="w-3.5 h-3.5" />
        )}
      </button>

      {onRemoveFriend && (
        <button
          type="button"
          onMouseEnter={handleMouseEnter}
          onClick={handleRemove}
          title="Desfazer amizade"
          aria-label={`Desfazer amizade com ${friend.name}`}
          className="h-9 w-9 rounded-xl border border-[var(--color-ui-detail)] hover:border-rose-500/40 bg-[var(--color-surface)] hover:bg-rose-500/15 text-white/40 hover:text-rose-400 transition-all duration-160 cursor-pointer flex items-center justify-center shrink-0 active:scale-[0.96] outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
        >
          <UserMinus className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );

  // Modo lista: uma linha compacta (avatar · nome · Steam · ações), ideal
  // para varrer muitos amigos de uma vez sem o card vertical ocupar tanto espaço.
  if (variant === "list") {
    return (
      <div
        data-friend-id={friend.id}
        className="group relative flex items-center gap-3 rounded-xl bg-[var(--color-surface)] hover:bg-[#222222] border border-[var(--color-ui-detail)] hover:border-white/20 px-3.5 py-2.5 transition-[background-color,border-color] duration-160 shadow-[0_2px_12px_rgba(0,0,0,0.25)]"
        onMouseEnter={handleMouseEnter}
      >
        {avatar}
        {nameBlock}
        <SteamBrandIcon className="w-4 h-4 text-white/40 shrink-0" />
        <div className="w-px h-6 bg-[var(--color-ui-detail)] shrink-0" />
        {chatButton}
        {actionButtons}
      </div>
    );
  }

  return (
    <div
      data-friend-id={friend.id}
      className="group relative rounded-xl bg-[var(--color-surface)] hover:bg-[#222222] border border-[var(--color-ui-detail)] hover:border-white/20 p-3.5 transition-[transform,background-color,border-color] duration-160 hover:-translate-y-0.5 shadow-[0_4px_20px_rgba(0,0,0,0.3)]  flex flex-col justify-between"
      onMouseEnter={handleMouseEnter}
    >
      <div>
        <div className="flex items-center gap-3 mb-2.5">
          {avatar}
          {nameBlock}
          <SteamBrandIcon className="w-4 h-4 text-white/40 shrink-0" />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-[var(--color-ui-detail)] mt-1.5">
        {chatButton}
        {actionButtons}
      </div>
    </div>
  );
}, (prev, next) => (
  prev.friend.id === next.friend.id &&
  prev.friend.name === next.friend.name &&
  prev.friend.avatar === next.friend.avatar &&
  prev.friend.status === next.friend.status &&
  prev.friend.playing === next.friend.playing &&
  prev.unreadCount === next.unreadCount &&
  prev.isCallActive === next.isCallActive &&
  prev.isLoadingProfile === next.isLoadingProfile &&
  prev.variant === next.variant &&
  prev.onOpenChat === next.onOpenChat &&
  prev.onStartVoiceCall === next.onStartVoiceCall &&
  prev.onViewFriendProfile === next.onViewFriendProfile &&
  prev.onRemoveFriend === next.onRemoveFriend &&
  prev.playSound === next.playSound
));

const FriendOfflineCard = React.memo<{
  friend: SocialFriend;
  onViewFriendProfile: (friend: SocialFriend) => void;
  onRemoveFriend?: (friend: SocialFriend) => void;
  isLoadingProfile?: boolean;
  playSound?: (type: SoundEffectType) => void;
}>(({ friend, onViewFriendProfile, onRemoveFriend, isLoadingProfile = false, playSound }) => {
  const handleClick = useCallback(() => {
    if (isLoadingProfile) return;
    playSound?.("select");
    onViewFriendProfile(friend);
  }, [friend, onViewFriendProfile, isLoadingProfile, playSound]);

  const handleRemove = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onRemoveFriend?.(friend);
  }, [friend, onRemoveFriend]);

  return (
    <div
      tabIndex={0}
      role="button"
      data-friend-id={friend.id}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
      onMouseEnter={() => playSound?.("hover")}
      className={`group shrink-0 snap-start relative flex items-center gap-3 p-3 rounded-xl border transition-[transform,background-color,border-color,box-shadow] duration-200 ease-out shadow-md data-[gamepad-focused='true']:border-white data-[gamepad-focused='true']:ring-2 data-[gamepad-focused='true']:ring-white/40 ${isLoadingProfile
          ? "bg-[var(--color-surface)] border-white/40 ring-1 ring-white/25 shadow-[0_0_24px_rgba(255,255,255,0.18)] cursor-wait scale-[0.99]"
          : "bg-[var(--color-surface)] hover:bg-[#222222] border-[var(--color-ui-detail)] hover:border-white/15 cursor-pointer hover:scale-[1.02]"
        }`}
      style={{ minWidth: 200 }}
    >
      <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-[var(--color-surface)] border border-white/10 shrink-0">
        {friend.avatar ? (
          <img
            src={friend.avatar}
            alt=""
            loading="lazy"
            decoding="async"
            className={`w-full h-full object-cover transition-all duration-300 ${isLoadingProfile ? "grayscale-0 opacity-100 scale-105" : "grayscale-[0.6] opacity-75 hover:opacity-100"
              }`}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/30">
            <User className="w-5 h-5" />
          </div>
        )}
        {isLoadingProfile && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
            <Loader2 className="w-4 h-4 text-white animate-spin" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-white/90 truncate">{friend.name}</p>
        {isLoadingProfile ? (
          <p className="text-[10px] font-medium text-white/90 flex items-center gap-1 animate-pulse mt-0.5">
            <Loader2 className="w-2.5 h-2.5 animate-spin text-white shrink-0" />
            <span>Abrindo...</span>
          </p>
        ) : (
          <p className="text-[10px] font-body text-white/30">Offline</p>
        )}
      </div>

      {onRemoveFriend && (
        <button
          type="button"
          tabIndex={0}
          onClick={handleRemove}
          title="Desfazer amizade"
          aria-label={`Desfazer amizade com ${friend.name}`}
          className="opacity-0 group-hover:opacity-100 focus:opacity-100 h-7 w-7 rounded-lg border border-[var(--color-ui-detail)] hover:border-rose-500/40 bg-[var(--color-surface)] hover:bg-rose-500/15 text-white/40 hover:text-rose-400 transition-all duration-160 cursor-pointer flex items-center justify-center shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
        >
          <UserMinus className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}, (prev, next) => (
  prev.friend.id === next.friend.id &&
  prev.friend.name === next.friend.name &&
  prev.friend.avatar === next.friend.avatar &&
  prev.isLoadingProfile === next.isLoadingProfile &&
  prev.onViewFriendProfile === next.onViewFriendProfile &&
  prev.onRemoveFriend === next.onRemoveFriend &&
  prev.playSound === next.playSound
));

const FriendChatCard = React.memo<{
  friend: SocialFriend;
  unreadCount: number;
  onOpenChat: (friend: SocialFriend) => void;
  onStartVoiceCall?: (friend: SocialFriend, withVideo?: boolean) => void;
  playSound?: (type: SoundEffectType) => void;
}>(({ friend, unreadCount, onOpenChat, onStartVoiceCall, playSound }) => {
  const handleChat = useCallback(() => onOpenChat(friend), [friend, onOpenChat]);
  const handleVoice = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onStartVoiceCall?.(friend, false);
  }, [friend, onStartVoiceCall]);
  const handleVideo = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onStartVoiceCall?.(friend, true);
  }, [friend, onStartVoiceCall]);

  const isPlaying = friend.status === "playing";
  const isOnline = isPlaying || friend.status === "online";

  return (
    <div
      tabIndex={0}
      role="button"
      data-friend-id={friend.id}
      onClick={handleChat}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleChat();
        }
      }}
      className="group relative flex items-center justify-between p-4 rounded-2xl bg-[var(--color-surface)] hover:bg-[#222222] border border-[var(--color-ui-detail)] hover:border-white/20 focus:border-white/40 focus:bg-[var(--color-surface)] focus:outline-none data-[gamepad-focused='true']:border-white data-[gamepad-focused='true']:bg-[var(--color-surface)] data-[gamepad-focused='true']:ring-2 data-[gamepad-focused='true']:ring-white/40 cursor-pointer transition-all shadow-md"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="relative w-11 h-11 rounded-xl overflow-hidden bg-[var(--color-surface)] border border-white/10 shrink-0">
          {friend.avatar ? (
            <img src={friend.avatar} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/40">
              <User className="w-5 h-5" />
            </div>
          )}
          {/* Indicador de status */}
          <span
            className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-black/80 ${isPlaying
              ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)] animate-pulse"
              : isOnline
                ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]"
                : "bg-white/20"
              }`}
          />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white truncate">{friend.name}</p>
          <p className={`text-xs truncate font-medium ${isPlaying ? "text-emerald-400 font-semibold flex items-center gap-1" : isOnline ? "text-white/60" : "text-white/30"
            }`}>
            {isPlaying ? (
              <>
                <Gamepad2 className="w-3 h-3 text-emerald-400 shrink-0 inline" />
                <span>Jogando {friend.playing || "um jogo"}</span>
              </>
            ) : isOnline ? (
              "Online"
            ) : (
              "Offline"
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
        {onStartVoiceCall && (
          <>
            <button
              type="button"
              tabIndex={-1}
              onMouseEnter={() => playSound?.("hover")}
              onClick={handleVoice}
              title="Ligar (Áudio)"
              className="p-2 rounded-xl bg-[var(--color-surface)] hover:bg-white/10 text-white/70 hover:text-white border border-[var(--color-ui-detail)] transition-all cursor-pointer"
            >
              <Phone className="w-4 h-4" />
            </button>
            <button
              type="button"
              tabIndex={-1}
              onMouseEnter={() => playSound?.("hover")}
              onClick={handleVideo}
              title="Chamada de Vídeo"
              className="p-2 rounded-xl bg-[var(--color-surface)] hover:bg-white/10 text-white/70 hover:text-white border border-[var(--color-ui-detail)] transition-all cursor-pointer"
            >
              <Video className="w-4 h-4" />
            </button>
          </>
        )}
        {unreadCount > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-white text-black text-xs font-bold">
            {unreadCount}
          </span>
        )}
      </div>
    </div>
  );
}, (prev, next) => (
  prev.friend.id === next.friend.id &&
  prev.friend.name === next.friend.name &&
  prev.friend.avatar === next.friend.avatar &&
  prev.friend.status === next.friend.status &&
  prev.friend.playing === next.friend.playing &&
  prev.unreadCount === next.unreadCount &&
  prev.onOpenChat === next.onOpenChat &&
  prev.onStartVoiceCall === next.onStartVoiceCall &&
  prev.playSound === next.playSound
));

const FriendRequestCard = React.memo<{
  request: CheckpointFriendRequest;
  onAccept: (uid: string) => void;
  onReject: (uid: string) => void;
}>(({ request, onAccept, onReject }) => {
  const handleAccept = useCallback(() => onAccept(request.uid), [request.uid, onAccept]);
  const handleReject = useCallback(() => onReject(request.uid), [request.uid, onReject]);

  return (
    <div className="flex items-center justify-between p-4 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-ui-detail)]">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl overflow-hidden bg-[var(--color-surface)] border border-white/10">
          {request.photoURL ? (
            <img src={request.photoURL} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/40">
              <User className="w-5 h-5" />
            </div>
          )}
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{request.displayName || "Jogador"}</p>
          <p className="text-xs text-white/40">Deseja adicionar você</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleReject}
          className="px-3 py-1.5 rounded-xl border border-white/10 bg-[var(--color-surface)] text-white/60 hover:text-white text-xs font-semibold cursor-pointer"
        >
          Rejeitar
        </button>
        <button
          type="button"
          onClick={handleAccept}
          className="px-4 py-1.5 rounded-xl bg-white text-black text-xs font-bold shadow-md hover:bg-white/90 cursor-pointer"
        >
          Aceitar
        </button>
      </div>
    </div>
  );
}, (prev, next) => (
  prev.request.uid === next.request.uid &&
  prev.request.displayName === next.request.displayName &&
  prev.request.photoURL === next.request.photoURL &&
  prev.onAccept === next.onAccept &&
  prev.onReject === next.onReject
));

export const FriendsPage: React.FC<FriendsPageProps> = React.memo(({
  discordConnected,
  userDisplay,
  discordUsername,
  discordAvatar,
  friends,
  unreadMessagesByFriend,
  incomingRequests,
  currentPresenceGame,
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
}) => {
  const [friendSearch, setFriendSearch] = useState("");
  const [activeSubTab, setActiveSubTab] = useState<SocialSubTab>("AMIGOS");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ONLINE" | "PLAYING" | "OFFLINE">("ALL");
  const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
    try {
      return (localStorage.getItem("pherielium_friends_view_mode") as "grid" | "list") || "grid";
    } catch {
      return "grid";
    }
  });

  const handleSetViewMode = (mode: "grid" | "list") => {
    setViewMode(mode);
    try {
      localStorage.setItem("pherielium_friends_view_mode", mode);
    } catch { }
    playSound?.("select");
  };

  const voiceCall = useVoiceCallContext();
  const { userProfile, user } = useAuth();
  const { notify } = useNotification();
  const offlineScrollRef = React.useRef<HTMLDivElement>(null);

  const totalUnreadCount = useMemo(
    () => Object.values(unreadMessagesByFriend).reduce((acc, count) => acc + (count || 0), 0),
    [unreadMessagesByFriend],
  );

  const normalizedSearch = friendSearch.trim().toLowerCase();

  const filteredFriends = useMemo(() => {
    return friends.filter((friend) => {
      const matchesSearch =
        !normalizedSearch ||
        friend.name.toLowerCase().includes(normalizedSearch) ||
        (friend.playing && friend.playing.toLowerCase().includes(normalizedSearch));

      if (!matchesSearch) return false;

      if (statusFilter === "ONLINE") return friend.status === "online" || friend.status === "playing";
      if (statusFilter === "PLAYING") return friend.status === "playing";
      if (statusFilter === "OFFLINE") return friend.status === "offline";
      return true;
    });
  }, [friends, normalizedSearch, statusFilter]);

  const onlineFriends = useMemo(
    () => filteredFriends.filter((f) => f.status === "online" || f.status === "playing"),
    [filteredFriends],
  );

  const offlineFriends = useMemo(
    () => filteredFriends.filter((f) => f.status === "offline"),
    [filteredFriends],
  );

  const checkpointFriends = useMemo(
    () => friends.filter((f) => f.source === "checkpoint"),
    [friends],
  );

  const playingNowCount = useMemo(
    () => friends.filter((f) => f.status === "playing").length,
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

  const scrollOffline = (direction: "left" | "right") => {
    if (offlineScrollRef.current) {
      offlineScrollRef.current.scrollBy({
        left: direction === "left" ? -260 : 260,
        behavior: "smooth",
      });
    }
  };

  const recentActivities = useMemo(() => {
    const SEVEN_HOURS_MS = 7 * 60 * 60 * 1000;
    const now = Date.now();
    return friends
      .filter((f) => {
        if (f.lastSeen) {
          return now - new Date(f.lastSeen).getTime() <= SEVEN_HOURS_MS;
        }
        return f.status === "playing" || f.status === "online";
      })
      .slice(0, 3);
  }, [friends]);

  return (
    <SystemPageShell
      title="Amigos"
      description="Conecte-se e jogue junto."
      actions={
        <button
          type="button"
          onMouseEnter={() => playSound?.("hover")}
          onClick={onAddFriendClick}
          className="cursor-pointer flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-black font-body font-bold text-xs tracking-wide shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:bg-white/90 hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          <span>+ ADICIONAR AMIGO</span>
        </button>
      }
    >
      <FriendsSubTabs
        activeTab={activeSubTab}
        onTabChange={(id) => setActiveSubTab(id)}
        incomingRequestsCount={incomingRequests.length}
        totalFriendsCount={onlineFriends.length + offlineFriends.length}
        onlineCount={onlineFriends.length}
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

      {/* Main 2-Column Social Layout */}
      {activeSubTab === "AMIGOS" && friends.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Column: User Profile Identity & Recent Social Activity (4 Cols) */}
          <div className="lg:col-span-4 flex flex-col gap-5">
            {/* User Identity Card */}
            <div
              className="rounded-2xl border border-[var(--color-ui-detail)] p-5 shadow-2xl glass-panel"
            >

              <div className="flex items-center gap-4 mb-4">
                <div className="relative">
                  <div className="w-14 h-14 rounded-2xl overflow-hidden bg-[var(--color-surface)] border border-white/15 shadow-md">
                    {userProfile?.photoURL || user?.photoURL || discordAvatar ? (
                      <img
                        src={userProfile?.photoURL || user?.photoURL || discordAvatar}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/50">
                        <User className="w-7 h-7" />
                      </div>
                    )}
                  </div>
                  <span className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full bg-white border-2 border-black/80 shadow-[0_0_8px_rgba(255,255,255,0.9)]" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-display font-bold text-white truncate">
                      {discordUsername || userDisplay}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-white/10 border border-white/20 text-[9.5px] font-bold text-white uppercase tracking-wider">
                      ONLINE
                    </span>
                  </div>
                  <p className="text-[11px] font-body text-white/50 truncate mt-0.5">
                    {currentPresenceGame ? `Jogando ${currentPresenceGame}` : "Explorando o ecossistema Pherielium"}
                  </p>
                </div>
              </div>

              {/* Discord Connection Status */}
              <div className="flex items-center justify-between p-2.5 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-ui-detail)] mb-4">
                <div className="flex items-center gap-2">
                  <DiscordBrandIcon className="w-4 h-4 text-white/80" />
                  <span className="text-xs font-semibold text-white/90">Discord</span>
                </div>
                {discordConnected || discordUsername || userProfile?.discordUsername ? (
                  <span className="text-[10px] font-bold text-white bg-white/15 px-2.5 py-0.5 rounded-full border border-white/25">
                    Conectado
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={onConnectDiscord}
                    className="text-[10px] font-bold text-black bg-white hover:bg-white/90 px-3 py-1 rounded-full border border-white transition-all cursor-pointer shadow-sm active:scale-95"
                  >
                    Conectar
                  </button>
                )}
              </div>

              <div className="w-full h-px bg-[var(--color-surface)] mb-4" />

              {/* 3 Metric Mini Counters */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="space-y-0.5">
                  <span className="text-[9.5px] font-body font-semibold uppercase tracking-wider text-white/40">
                    AMIGOS
                  </span>
                  <p className="text-base font-display font-bold text-white">{friends.length}</p>
                </div>
                <div className="space-y-0.5 border-x border-[var(--color-ui-detail)]">
                  <span className="text-[9.5px] font-body font-semibold uppercase tracking-wider text-white/40">
                    ONLINE
                  </span>
                  <p className="text-base font-display font-bold text-white">{onlineFriends.length}</p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[9.5px] font-body font-semibold uppercase tracking-wider text-white/40">
                    JOGANDO
                  </span>
                  <p className="text-base font-display font-bold text-white">{playingNowCount}</p>
                </div>
              </div>
            </div>

            {/* Recent Social Activity (3 Blocks Max, strictly within last 7h) */}
            <div
              className="rounded-2xl border border-[var(--color-ui-detail)] p-5 shadow-2xl glass-panel"
            >

              <div className="flex items-center justify-between mb-4">
                <span className="text-[10.5px] font-body font-bold uppercase tracking-[0.2em] text-white/50 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-white/60" /> ATIVIDADE RECENTE (ÚLTIMAS 7H)
                </span>
                <span className="h-1.5 w-1.5 rounded-full bg-white/70 animate-pulse" />
              </div>

              {recentActivities.length === 0 ? (
                <div className="py-6 text-center text-xs font-body text-white/40">
                  Nenhuma atividade nas últimas 7 horas.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {recentActivities.map((friend, idx) => (
                    <div
                      key={friend.id || idx}
                      onClick={() => {
                        if (friendProfileLoadingId === friend.id) return;
                        playSound?.("select");
                        onViewFriendProfile(friend);
                      }}
                      className={`flex items-start gap-3 p-2.5 rounded-2xl transition-all cursor-pointer ${friendProfileLoadingId === friend.id
                          ? "bg-[var(--color-surface)] border border-white/30 ring-1 ring-white/20"
                          : "bg-[var(--color-surface)] border border-[var(--color-ui-detail)] hover:border-[var(--color-ui-detail)] hover:bg-[#222222]"
                        }`}
                    >
                      <div className="relative w-9 h-9 rounded-xl overflow-hidden bg-[var(--color-surface)] border border-white/10 shrink-0">
                        {friend.avatar ? (
                          <img src={friend.avatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white/40">
                            <User className="w-4 h-4" />
                          </div>
                        )}
                        {friendProfileLoadingId === friend.id && (
                          <div className="absolute inset-0 bg-black/60  flex items-center justify-center">
                            <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-xs font-semibold text-white truncate">{friend.name}</p>
                          {friendProfileLoadingId === friend.id ? (
                            <span className="text-[9.5px] font-semibold text-white/80 flex items-center gap-1 animate-pulse">
                              <Loader2 className="w-2.5 h-2.5 animate-spin" />
                              Abrindo...
                            </span>
                          ) : (
                            <span className="text-[9.5px] font-body text-white/30 shrink-0">Há {idx * 7 + 2} min</span>
                          )}
                        </div>
                        <p className="text-[11px] font-body text-white/50 line-clamp-1 mt-0.5">
                          {friend.status === "playing"
                            ? `Começou a jogar ${friend.playing || "um jogo"}`
                            : friend.status === "online"
                              ? "Entrou no ecossistema Pherielium"
                              : "Atividade registrada"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Friends Search, Filter & Grid (8 Cols) */}
          <div className="lg:col-span-8 flex flex-col gap-5">
            {/* Search & Control Bar */}
            <div className="relative z-[100] flex flex-wrap items-center gap-2.5 rounded-3xl border border-[var(--color-ui-detail)] p-2.5 shadow-[0_20px_50px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.12)] glass-panel">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                <input
                  id="friends-search-input"
                  aria-label="Buscar amigos"
                  type="text"
                  value={friendSearch}
                  onChange={(e) => setFriendSearch(e.target.value)}
                  placeholder="Buscar amigos..."
                  className="w-full flex-1 h-9 pl-9 pr-4 rounded-full bg-[var(--color-surface)] border border-[var(--color-ui-detail)] text-[13px] font-body text-white placeholder:text-white/30 focus:outline-none focus:border-white/25 transition-all"
                />
              </div>

              <div className="flex items-center gap-2">
                <div className="relative z-50">
                  <GhostSelect
                    value={statusFilter}
                    onChange={(value) => setStatusFilter(value as any)}
                    options={[
                      { value: "ALL", label: "Todos os status" },
                      { value: "ONLINE", label: "Apenas Online" },
                      { value: "PLAYING", label: "Em Jogo" },
                      { value: "OFFLINE", label: "Offline" },
                    ]}
                    className="w-44"
                  />
                </div>

                <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--color-surface)] border border-[var(--color-ui-detail)]">
                  <button
                    type="button"
                    aria-label="Visualização em Grade"
                    aria-pressed={viewMode === "grid"}
                    onClick={() => handleSetViewMode("grid")}
                    className={`h-7 w-7 flex items-center justify-center rounded-lg transition-colors cursor-pointer ${viewMode === "grid" ? "bg-white/15 text-white" : "text-white/40 hover:text-white"
                      }`}
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Visualização em Lista"
                    aria-pressed={viewMode === "list"}
                    onClick={() => handleSetViewMode("list")}
                    className={`h-7 w-7 flex items-center justify-center rounded-lg transition-colors cursor-pointer ${viewMode === "list" ? "bg-white/15 text-white" : "text-white/40 hover:text-white"
                      }`}
                  >
                    <ListFilter className="w-4 h-4" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={onAddFriendClick}
                  onMouseEnter={() => playSound?.("hover")}
                  className="ml-2 flex items-center gap-1.5 h-9 px-4 rounded-xl bg-white text-black font-semibold text-xs transition-all hover:bg-white/90 active:scale-95 cursor-pointer shadow-[0_0_15px_rgba(255,255,255,0.2)]"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Adicionar Amigo</span>
                </button>
              </div>
            </div>

            {/* Section: ONLINE Friends */}
            <div className="space-y-3.5">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)]" />
                <h2 className="text-xs font-body font-bold uppercase tracking-wider text-white">
                  ONLINE — {onlineFriends.length}
                </h2>
              </div>

              {onlineFriends.length === 0 ? (
                <StandardEmptyState
                  icon={Users}
                  illustrated="friends"
                  title="Nenhum amigo online"
                  description="Seus amigos aparecerão aqui quando estiverem conectados ou jogando."
                  actionLabel="Adicionar amigo"
                  onAction={onAddFriendClick}
                />
              ) : (
                <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" : "flex flex-col gap-2"}>
                  {onlineFriends.map((friend) => (
                    <FriendOnlineCard
                      key={friend.id}
                      friend={friend}
                      variant={viewMode}
                      unreadCount={unreadMessagesByFriend[friend.id.split(":")[1]] || 0}
                      isCallActive={voiceCall.isCallActiveWithFriend(friend.id)}
                      isLoadingProfile={friendProfileLoadingId === friend.id}
                      onOpenChat={onOpenChat}
                      onStartVoiceCall={onStartVoiceCall}
                      onViewFriendProfile={onViewFriendProfile}
                      onRemoveFriend={onRemoveFriend}
                      playSound={playSound}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Section: OFFLINE Friends Carousel with Navigation Controls */}
            <div className="space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-white/20" />
                  <h2 className="text-xs font-body font-bold uppercase tracking-wider text-white/40">
                    OFFLINE — {offlineFriends.length}
                  </h2>
                </div>

                {offlineFriends.length > 0 && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => scrollOffline("left")}
                      className="p-1.5 rounded-xl bg-[var(--color-surface)] hover:bg-white/10 border border-[var(--color-ui-detail)] text-white/60 hover:text-white transition-all cursor-pointer"
                      title="Amigos anteriores"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollOffline("right")}
                      className="p-1.5 rounded-xl bg-[var(--color-surface)] hover:bg-white/10 border border-[var(--color-ui-detail)] text-white/60 hover:text-white transition-all cursor-pointer"
                      title="Próximos amigos"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {offlineFriends.length === 0 ? (
                <div className="p-4 text-center text-xs text-white/40">Nenhum amigo offline</div>
              ) : (
                <div
                  ref={offlineScrollRef}
                  className="flex items-center gap-3 overflow-x-auto pb-3 no-scrollbar scroll-smooth snap-x snap-mandatory"
                >
                  {offlineFriends.map((friend) => (
                    <FriendOfflineCard
                      key={friend.id}
                      friend={friend}
                      isLoadingProfile={friendProfileLoadingId === friend.id}
                      onViewFriendProfile={onViewFriendProfile}
                      onRemoveFriend={onRemoveFriend}
                      playSound={playSound}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SubTab: CHATS */}
      {activeSubTab === "CHAT" && (
        <div
          className="rounded-2xl border border-[var(--color-ui-detail)] p-6 shadow-2xl glass-panel"
        >

          <div className="mb-6 flex items-center justify-between border-b border-[var(--color-ui-detail)] pb-4">
            <div>
              <h2 className="text-lg font-display font-bold text-white">Conversas Recentes</h2>
              <p className="text-xs font-body text-white/40">Abra mensagens diretas e canais de amigos.</p>
            </div>
          </div>

          {checkpointFriends.length === 0 ? (
            <div className="py-12 text-center text-white/40 text-sm">Nenhuma conversa encontrada.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {checkpointFriends.map((friend) => (
                <FriendChatCard
                  key={friend.id}
                  friend={friend}
                  unreadCount={unreadMessagesByFriend[friend.id.split(":")[1]] || 0}
                  onOpenChat={onOpenChat}
                  onStartVoiceCall={onStartVoiceCall}
                  playSound={playSound}
                />
              ))}
            </div>
          )}
        </div>
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
          onSimulateIncomingCall={() => {
            voiceCall.simulateIncomingCall(true);
          }}
          notify={notify}
        />
      )}

      {/* SubTab: SOLICITAÇÕES */}
      {activeSubTab === "SOLICITAÇÕES" && (
        <div
          className="rounded-2xl border border-[var(--color-ui-detail)] p-6 shadow-2xl glass-panel"
        >

          <div className="mb-6 flex items-center justify-between border-b border-[var(--color-ui-detail)] pb-4">
            <div>
              <h2 className="text-lg font-display font-bold text-white">Solicitações de Amizade</h2>
              <p className="text-xs font-body text-white/40">Gerencie convites de novas conexões.</p>
            </div>
            <span className="px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs font-bold text-white">
              {incomingRequests.length}
            </span>
          </div>

          {incomingRequests.length === 0 ? (
            <div className="py-12 text-center text-white/40 text-sm">Nenhuma solicitação pendente.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {incomingRequests.map((req) => (
                <FriendRequestCard
                  key={req.uid}
                  request={req}
                  onAccept={onAcceptRequest}
                  onReject={onRejectRequest}
                />
              ))}
            </div>
          )}
        </div>
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

  if (!isOpen) return null;

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={() => {
        playSound?.("back");
        onClose();
      }}
      title={t("addFriendTitle") || "Adicionar amigo"}
      maxWidthClassName="max-w-xl"
    >
      <div className="space-y-5 p-6">
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
