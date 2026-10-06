import React, { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Users, MessageSquare } from "lucide-react";
import type { Game, SocialFriend } from "../../types/domain";
import type { SoundEffectType } from "../../hooks/useSoundEffects";
import { supabase } from "../../services/supabase";

interface GameDetailFriendsProps {
  game: Game;
  friends?: SocialFriend[];
  onOpenChat?: (friend: SocialFriend) => void;
  playSound?: (type: SoundEffectType) => void;
}

export const GameDetailFriends: React.FC<GameDetailFriendsProps> = React.memo(({
  game,
  friends = [],
  onOpenChat,
  playSound,
}) => {
  const gameTitleLower = useMemo(() => game.title.trim().toLowerCase(), [game.title]);
  const [friendsWhoOwnGameIds, setFriendsWhoOwnGameIds] = useState<Set<string>>(new Set());

  // Consulta no Supabase se algum dos amigos possui este jogo na sua biblioteca
  useEffect(() => {
    let isCancelled = false;
    const checkOwnership = async () => {
      if (friends.length === 0) return;
      try {
        const uids = friends.map((f) => f.id.replace("cp-friend:", ""));
        let query = supabase.from("user_games").select("user_id").in("user_id", uids);
        if (game.steamAppId) {
          query = query.or(`steam_app_id.eq.${game.steamAppId},title.ilike.%${game.title}%`);
        } else {
          query = query.ilike("title", `%${game.title}%`);
        }
        const { data, error } = await query;
        if (!error && data && !isCancelled) {
          const ids = new Set<string>();
          data.forEach((row: { user_id: string }) => {
            ids.add(row.user_id);
            ids.add(`cp-friend:${row.user_id}`);
          });
          setFriendsWhoOwnGameIds(ids);
        }
      } catch (e) {
        console.warn("[GameDetailFriends] Erro ao verificar posse do jogo:", e);
      }
    };
    void checkOwnership();
    return () => {
      isCancelled = true;
    };
  }, [game.title, game.steamAppId, friends]);

  // Amigos jogando este jogo agora
  const friendsPlayingNow = useMemo(() => {
    return friends.filter((f) => {
      if (!f.playing) return false;
      const playingLower = f.playing.trim().toLowerCase();
      return (
        playingLower.includes(gameTitleLower) ||
        gameTitleLower.includes(playingLower)
      );
    });
  }, [friends, gameTitleLower]);

  // Amigos que possuem este jogo na biblioteca (mas não estão jogando agora)
  const friendsWhoOwnNotPlaying = useMemo(() => {
    const playingIds = new Set(friendsPlayingNow.map((f) => f.id));
    return friends.filter((f) => {
      if (playingIds.has(f.id)) return false;
      const cleanId = f.id.replace("cp-friend:", "");
      return friendsWhoOwnGameIds.has(f.id) || friendsWhoOwnGameIds.has(cleanId);
    });
  }, [friends, friendsPlayingNow, friendsWhoOwnGameIds]);

  if (friendsPlayingNow.length === 0 && friendsWhoOwnNotPlaying.length === 0) {
    return (
      <div className="w-full rounded-2xl bg-[#0F1116] border border-white/[0.06] p-6 text-center select-none shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
        <Users className="w-8 h-8 text-white/20 mx-auto mb-2" />
        <h4 className="text-sm font-semibold text-white/70">Nenhum amigo possui este jogo na sua rede</h4>
        <p className="text-xs text-white/40 mt-1">
          Apenas amigos que possuem {game.title} na biblioteca aparecem aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-6 select-none">
      {/* 1. Amigos jogando agora (Estilo Banner CS2) */}
      {friendsPlayingNow.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            <h3 className="text-sm font-bold text-white tracking-wide">
              {friendsPlayingNow.length === 1
                ? "1 amigo está jogando agora"
                : `${friendsPlayingNow.length} amigos estão jogando agora`}
            </h3>
          </div>

          <div className="w-full rounded-2xl bg-[#0E1318] border border-emerald-500/25 p-4 sm:p-5 shadow-[0_8px_24px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(52,211,153,0.15)]">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {friendsPlayingNow.map((friend) => (
                <motion.div
                  key={friend.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: "spring", bounce: 0.2, duration: 0.25 }}
                  onClick={() => {
                    playSound?.("select");
                    onOpenChat?.(friend);
                  }}
                  className="flex items-center gap-3.5 p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.04] hover:border-emerald-500/30 transition-all cursor-pointer group"
                >
                  <div className="relative shrink-0">
                    <img
                      src={friend.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&q=80"}
                      alt={friend.name}
                      className="w-11 h-11 rounded-xl object-cover ring-2 ring-emerald-500/70 shadow-md"
                    />
                    <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-[#0E1318]" />
                  </div>

                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="font-bold text-sm text-white group-hover:text-emerald-300 transition-colors truncate">
                      {friend.name}
                    </span>
                    <span className="text-xs text-emerald-400/90 font-medium truncate">
                      {friend.playing || "Jogando agora"}
                    </span>
                  </div>

                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 shrink-0 text-white/70">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 2. Amigos que possuem este jogo */}
      {friendsWhoOwnNotPlaying.length > 0 && (
        <div className="flex flex-col gap-3">
          <h4 className="text-[11px] font-bold tracking-wider text-white/45 uppercase font-display">
            {friendsPlayingNow.length > 0
              ? `${friendsWhoOwnNotPlaying.length} amigos também possuem este jogo`
              : "Amigos que possuem este jogo"}
          </h4>

          <div className="w-full rounded-2xl bg-[#0F1116] border border-white/[0.06] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] overflow-x-auto hide-scrollbar">
            <div className="flex items-center gap-4 min-w-max">
              {friendsWhoOwnNotPlaying.map((friend) => (
                <div
                  key={friend.id}
                  onClick={() => {
                    playSound?.("select");
                    onOpenChat?.(friend);
                  }}
                  className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/[0.06] transition-all cursor-pointer group shrink-0"
                >
                  <img
                    src={friend.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&q=80"}
                    alt={friend.name}
                    className="w-9 h-9 rounded-xl object-cover ring-1 ring-white/10 group-hover:ring-white/40 transition-all"
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium text-xs text-white/90 group-hover:text-white truncate max-w-[110px]">
                      {friend.name}
                    </span>
                    <span className="text-[10px] text-white/40 truncate max-w-[110px]">
                      {friend.status === "online" ? "Online" : "Jogou recentemente"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

GameDetailFriends.displayName = "GameDetailFriends";
export default GameDetailFriends;
