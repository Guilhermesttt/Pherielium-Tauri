import React from "react";
import { Flame, Users2 } from "lucide-react";
import type { TranslationKey } from "../context/PreferencesContext";
import type { Game } from "../types/domain";
import { motion } from "framer-motion";

interface FriendPresenceSnapshot {
  id: string;
  name: string;
  status: "online" | "playing" | "offline";
  playing?: string;
  avatar?: string;
}

interface ActivityItem {
  id: string;
  title: string;
  detail: string;
}

interface HomeOverviewPanelsProps {
  continuePlaying: Game[];
  favoriteGames: Game[];
  friendsPlaying: FriendPresenceSnapshot[];
  recentActivity: ActivityItem[];
  onOpenGame: (game: Game) => void;
  onOpenFriends: () => void;
  onOpenFriendChat: (friendId: string) => void;
  t: (key: TranslationKey) => string;
}

export const HomeOverviewPanels = React.memo(function HomeOverviewPanels({
  friendsPlaying,
  recentActivity,
  onOpenFriends,
}: HomeOverviewPanelsProps) {
  const topFriends = friendsPlaying.slice(0, 2);
  const topActivities = recentActivity.slice(0, 2);

  return (
    <aside
      aria-label="Painel de atividade e amigos"
      className="absolute top-24 right-10 flex flex-col gap-2.5 z-20 pointer-events-none"
    >
      {topFriends.length > 0 && (
        <motion.div
          initial={{ opacity: 0, x: 20, filter: "blur(6px)" }}
          animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
          whileHover={{ scale: 1.02, backgroundColor: "rgba(38, 38, 42, 0.85)" }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
          onClick={onOpenFriends}
          className="pointer-events-auto group w-72 rounded-[28px] border border-white/[0.08] bg-[#1C1C1E]/75 p-3.5 shadow-[0_24px_48px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.12)] flex items-center gap-3.5 cursor-pointer"
          style={{ backdropFilter: "blur(40px) saturate(180%)", WebkitBackdropFilter: "blur(40px) saturate(180%)" }}
        >
          {/* Inner Icon: R_inner (14px) = R_outer (28px) - Padding (14px) */}
          <div className="relative w-11 h-11 rounded-[14px] bg-white/[0.05] border border-white/[0.08] flex items-center justify-center shrink-0 group-hover:border-white/20 transition-colors">
            <Users2 className="h-5 w-5 text-white/80 group-hover:text-white transition-colors" />
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#1C1C1E] shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="block text-[10px] font-semibold tracking-widest text-white/45 uppercase font-body">
              Amigos online
            </span>
            <p className="text-[13px] font-semibold text-white/95 truncate font-body group-hover:text-white transition-colors">
              {topFriends[0].name} {topFriends.length > 1 ? `e mais ${friendsPlaying.length - 1}` : "ativo agora"}
            </p>
          </div>
        </motion.div>
      )}
    </aside>
  );
});
