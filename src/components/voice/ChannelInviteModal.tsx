import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, UserPlus, Check, X, Users, Radio, Send } from "lucide-react";
import type { SocialFriend, UserProfile, VoiceCallSession } from "../../types/domain";
import { sendChatMessage } from "../../services/chat";
import { sendCallInvite } from "../../services/voiceCall";

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
    const friendUid = friend.id.includes(":") ? friend.id.split(":")[1] : friend.id;
    setSendingId(friendUid);

    try {
      const avatarUrl = userProfile?.photoURL?.startsWith("data:") ? null : (userProfile?.photoURL || null);
      
      // 1. Send realtime call invite popup if online
      void sendCallInvite(friendUid, {
        callerId: userProfile?.uid || "",
        callerName: userProfile?.displayName || "Jogador",
        callerAvatar: avatarUrl,
        chatId: session.chatId,
        hasVideo: false,
        timestamp: Date.now(),
      }).catch(() => {});

      // 2. Send structured chat message for interactive invite card in DM
      const invitePayload = {
        __type: "call_invite",
        chatId: session.chatId,
        roomName: session.roomName || `Call de ${userProfile?.displayName || "Voz"}`,
        category: session.category || "resenha_games",
        callerName: userProfile?.displayName || "Jogador",
        callerAvatar: avatarUrl,
        isPrivate: Boolean(session.isPrivate),
        createdAt: Date.now(),
      };

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

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl select-none">
        {/* Backdrop dismiss */}
        <div className="absolute inset-0" onClick={onClose} />

        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 10 }}
          transition={{ type: "spring", stiffness: 380, damping: 28 }}
          className="glass-panel relative flex flex-col w-full max-w-md max-h-[80vh] overflow-hidden rounded-3xl border border-white/10 shadow-[0_30px_90px_rgba(0,0,0,0.95)] z-10"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4.5 border-b border-white/8 bg-black/30 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white border border-white/10 shadow-sm">
                <UserPlus className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white tracking-tight uppercase flex items-center gap-2">
                  <span>Convidar Amigos</span>
                  <span className="text-[10px] font-mono font-normal text-white/70 bg-white/10 px-1.5 py-0.5 rounded border border-white/10">
                    {availableFriends.length}
                  </span>
                </h3>
                <p className="text-[11px] text-white/40">
                  Envie um convite direto pelo chat para entrarem no canal
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="h-8 w-8 flex items-center justify-center rounded-xl bg-white/5 text-white/60 hover:text-white hover:bg-white/15 transition cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Search Bar */}
          <div className="px-5 pt-4 pb-2">
            <div className="relative flex items-center">
              <Search className="absolute left-3.5 h-4 w-4 text-white/40 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar amigo por nome..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                className="w-full h-10 pl-10 pr-4 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-white placeholder-white/30 focus:outline-none focus:border-white/30 focus:bg-white/10 transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 text-white/40 hover:text-white transition"
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
                <Users className="h-8 w-8 text-white/20" />
                <p className="text-xs font-bold text-white/50">
                  {searchQuery ? "Nenhum amigo encontrado" : "Sua lista de amigos está vazia"}
                </p>
                {searchQuery && (
                  <p className="text-[10px] text-white/30">Tente buscar por outro termo</p>
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
                    className="flex items-center justify-between p-2.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/6 hover:border-white/12 transition-all duration-150"
                  >
                    {/* Friend Avatar & Info */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative shrink-0">
                        <div className="h-10 w-10 rounded-full overflow-hidden border border-white/10 bg-white/5">
                          {friend.avatar ? (
                            <img
                              src={friend.avatar}
                              alt={friend.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-white/10 text-xs font-black text-white">
                              {friend.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                        </div>
                        {/* Status Dot */}
                        <span
                          className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#111218] ${
                            friend.status === "online"
                              ? "bg-emerald-500"
                              : friend.status === "playing"
                              ? "bg-purple-500"
                              : "bg-white/30"
                          }`}
                        />
                      </div>

                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-white truncate max-w-[170px]">
                          {friend.name}
                        </h4>
                        <p className="text-[10px] text-white/40 truncate max-w-[170px]">
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
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 cursor-default"
                          : isSending
                          ? "bg-white/10 text-white/50 border border-white/10"
                          : "bg-white text-black hover:bg-white/90 shadow-md hover:scale-105 active:scale-95"
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
          <div className="px-6 py-3 border-t border-white/8 bg-black/20 text-center">
            <p className="text-[10px] text-white/40 flex items-center justify-center gap-1.5">
              <Radio className="h-3 w-3 text-white/60 animate-pulse" />
              <span>O amigo receberá uma mensagem interativa com botão para entrar na call</span>
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
