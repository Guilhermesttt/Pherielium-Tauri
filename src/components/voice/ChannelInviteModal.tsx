import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, UserPlus, Check, X, Users, Radio, Send } from "lucide-react";
import type { SocialFriend, UserProfile, VoiceCallSession } from "../../types/domain";
import { sendChatMessage } from "../../services/chat";
import { sendCallInvite } from "../../services/voiceCall";
import { isChannelInviteRingOn } from "../../services/voiceCall/inviteState";
import { APP_PROTOCOL_VERSION } from "../../lib/protocolVersion";
import { callCapacityMessage, canAcceptNewParticipant } from "../../services/voiceCall/limits";
import { buildChannelInvitePayload } from "../../services/voiceCall/channelInvite";
import { modalBackdropMotion, modalMotion } from "../../design-system/motion";
import { useModalSounds } from "../../hooks/useModalSounds";

interface ChannelInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: VoiceCallSession | null;
  userProfile: UserProfile | null;
  friends: SocialFriend[];
  notify: (msg: string, type: "success" | "error" | "info") => void;
}

export const ChannelInviteModal: React.FC<ChannelInviteModalProps> = ({
  isOpen,
  onClose,
  session,
  userProfile,
  friends,
  notify,
}) => {
  useModalSounds(isOpen);
  const [searchQuery, setSearchQuery] = useState("");
  const [invitedFriends, setInvitedFriends] = useState<Record<string, boolean>>({});
  const [sendingId, setSendingId] = useState<string | null>(null);

  // Filter out friends who are the current remote participant in 1:1 call if applicable
  const availableFriends = useMemo(() => {
    return friends.filter((friend) => {
      const rawId = friend.id.includes(":") ? friend.id.split(":")[1] : friend.id;
      return rawId !== session?.friendUid;
    });
  }, [friends, session?.friendUid]);

  const filteredFriends = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return availableFriends;
    return availableFriends.filter(
      (f) =>
        f.name.toLowerCase().includes(query) ||
        (f.playing && f.playing.toLowerCase().includes(query)),
    );
  }, [availableFriends, searchQuery]);

  const handleSendInvite = async (friend: SocialFriend) => {
    if (!session) return;
    if (!canAcceptNewParticipant(session.participants)) {
      notify(callCapacityMessage(), "info");
      return;
    }
    const friendUid = friend.id.includes(":") ? friend.id.split(":")[1] : friend.id;
    setSendingId(friendUid);

    try {
      const avatarUrl = userProfile?.photoURL?.startsWith("data:") ? null : (userProfile?.photoURL || null);
      
      // 1. Aviso de ligação em tempo real: só com a flag (padrão desligada). O convite de canal vai como cartão no chat;
      //    o aviso fazia o app do amigo tocar como ligação (docs/invite-notifications.md).
      if (isChannelInviteRingOn()) void sendCallInvite(friendUid, {
        callerId: userProfile?.uid || "",
        callerName: userProfile?.displayName || "Jogador",
        callerAvatar: avatarUrl,
        chatId: session.chatId,
        hasVideo: false,
        timestamp: Date.now(),
        pv: APP_PROTOCOL_VERSION,
      }).catch(() => {});

      // 2. Send structured chat message for interactive invite card in DM
      const invitePayload = buildChannelInvitePayload({
        roomId: session.chatId,
        roomName: session.roomName || `Call de ${userProfile?.displayName || "Voz"}`,
        category: session.category || "resenha_games",
        callerName: userProfile?.displayName || "Jogador",
        callerAvatar: avatarUrl,
        isPrivate: Boolean(session.isPrivate),
      });

      await sendChatMessage(friendUid, JSON.stringify(invitePayload));

      setInvitedFriends((prev) => ({ ...prev, [friendUid]: true }));
      notify(`Convite enviado para ${friend.name}!`, "success");

      setTimeout(() => {
        setInvitedFriends((prev) => {
          const next = { ...prev };
          delete next[friendUid];
          return next;
        });
      }, 4000);
    } catch (err: any) {
      console.error("[ChannelInviteModal] Send invite error:", err);
      notify(err?.message || "Não foi possível enviar o convite.", "error");
    } finally {
      setSendingId(null);
    }
  };


  return (
    <AnimatePresence>
      {isOpen && (
      <motion.div {...modalBackdropMotion} className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl select-none">
        {/* Backdrop dismiss */}
        <div className="absolute inset-0" onClick={onClose} />

        <motion.div
          {...modalMotion}
          className="glass-panel relative flex flex-col w-full max-w-md max-h-[80vh] overflow-hidden rounded-3xl border border-transparent shadow-[0_30px_90px_rgba(0,0,0,0.95)] z-10"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4.5 border-b border-transparent bg-black/30 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--tone-3)] text-[var(--ink)] border border-transparent shadow-sm">
                <UserPlus className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-[var(--ink)] tracking-tight uppercase flex items-center gap-2">
                  <span>Convidar Amigos</span>
                  <span className="text-[length:var(--step-0)] font-mono font-normal text-[var(--ink-muted)] bg-[var(--tone-3)] px-1.5 py-0.5 rounded border border-transparent">
                    {availableFriends.length}
                  </span>
                </h3>
                <p className="text-[length:var(--step-0)] text-[var(--ink-faint)]">
                  Envie um convite direto pelo chat para entrarem no canal
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="h-8 w-8 flex items-center justify-center rounded-xl bg-[var(--tone-3)] text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--tone-4)] transition cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Search Bar */}
          <div className="px-5 pt-4 pb-2">
            <div className="relative flex items-center">
              <Search className="absolute left-3.5 h-4 w-4 text-[var(--ink-faint)] pointer-events-none" />
              <input aria-label="Buscar amigo por nome"
                type="text"
                placeholder="Buscar amigo por nome..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                className="w-full h-10 pl-10 pr-4 rounded-xl bg-[var(--tone-3)] border border-transparent text-xs font-semibold text-[var(--ink)] placeholder-white/30 focus:outline-none focus:border-transparent focus:bg-[var(--tone-4)] transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 text-[var(--ink-faint)] hover:text-[var(--ink)] transition"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Friend List */}
          <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2 scrollbar-thin scrollbar-thumb-white/10 max-h-[380px]">
            {filteredFriends.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center space-y-2">
                <Users className="h-8 w-8 text-[var(--ink-faint)]" />
                <p className="text-xs font-bold text-[var(--ink-muted)]">
                  {searchQuery ? "Nenhum amigo encontrado" : "Sua lista de amigos está vazia"}
                </p>
                {searchQuery && (
                  <p className="text-[length:var(--step-0)] text-[var(--ink-faint)]">Tente buscar por outro termo</p>
                )}
              </div>
            ) : (
              filteredFriends.map((friend) => {
                const friendUid = friend.id.split(":")[1] || friend.id;
                const isInvited = Boolean(invitedFriends[friendUid]);
                const isSending = sendingId === friendUid;

                return (
                  <div
                    key={friend.id}
                    className="flex items-center justify-between p-2.5 rounded-2xl bg-[var(--tone-3)] hover:bg-[var(--tone-4)] border border-transparent hover:border-transparent transition-all duration-150"
                  >
                    {/* Friend Avatar & Info */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative shrink-0">
                        <div className="h-10 w-10 rounded-full overflow-hidden border border-transparent bg-[var(--tone-3)]">
                          {friend.avatar ? (
                            <img
                              src={friend.avatar}
                              alt={friend.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-[var(--tone-3)] text-xs font-black text-[var(--ink)]">
                              {friend.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                        </div>
                        {/* Status Dot */}
                        <span
                          className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#111218] ${
                            friend.status === "online"
                              ? "bg-[var(--live)]"
                              : friend.status === "playing"
                              ? "bg-purple-500"
                              : "bg-[var(--tone-4)]"
                          }`}
                        />
                      </div>

                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-[var(--ink)] truncate max-w-[170px]">
                          {friend.name}
                        </h4>
                        <p className="text-[length:var(--step-0)] text-[var(--ink-faint)] truncate max-w-[170px]">
                          {friend.playing
                            ? `🎮 Jogando ${friend.playing}`
                            : friend.status === "online"
                            ? "Online"
                            : "Offline"}
                        </p>
                      </div>
                    </div>

                    {/* Action Button */}
                    <button
                      type="button"
                      disabled={isInvited || isSending}
                      onClick={() => void handleSendInvite(friend)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                        isInvited
                          ? "bg-[var(--tone-3)] text-[var(--live)] border border-transparent cursor-default"
                          : isSending
                          ? "bg-[var(--tone-3)] text-[var(--ink-muted)] border border-transparent"
                          : "bg-[var(--ink)] text-[var(--tone-0)] hover:opacity-90 shadow-md hover:scale-105 active:scale-95"
                      }`}
                    >
                      {isInvited ? (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          <span>Convidado</span>
                        </>
                      ) : isSending ? (
                        <>
                          <Send className="h-3.5 w-3.5 animate-pulse" />
                          <span>Enviando...</span>
                        </>
                      ) : (
                        <>
                          <UserPlus className="h-3.5 w-3.5" />
                          <span>Convidar</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Info */}
          <div className="px-6 py-3 border-t border-transparent bg-black/20 text-center">
            <p className="text-[length:var(--step-0)] text-[var(--ink-faint)] flex items-center justify-center gap-1.5">
              <Radio className="h-3 w-3 text-[var(--ink-muted)] animate-pulse" />
              <span>O amigo receberá uma mensagem interativa com botão para entrar na call</span>
            </p>
          </div>
        </motion.div>
      </motion.div>
    )}
    </AnimatePresence>
  );
};
