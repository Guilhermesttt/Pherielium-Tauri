import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { X, Users } from "lucide-react";
import type { Game } from "../../types/domain";

interface GameDetailSteamHeroProps {
  game: Game;
  heroImage: string;
  steamLogoUrl?: string | null;
  isRunning?: boolean;
  friendsPlayingCount?: number;
  onClose: () => void;
  userAvatar?: string;
}

export const GameDetailSteamHero: React.FC<GameDetailSteamHeroProps> = React.memo(({
  game,
  heroImage,
  steamLogoUrl,
  isRunning = false,
  friendsPlayingCount = 0,
  onClose,
  userAvatar,
}) => {
  const [logoFailed, setLogoFailed] = useState(false);
  const [currentTime, setCurrentTime] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000 * 30);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative w-full h-[62vh] sm:h-[68vh] min-h-[480px] max-h-[720px] select-none overflow-hidden bg-black">
      {/* 1. Horizontal Wallpaper Image */}
      <motion.img
        key={heroImage}
        initial={{ opacity: 0, scale: 1.04 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        src={heroImage || undefined}
        alt=""
        className="w-full h-full object-cover object-center"
        loading="eager"
        decoding="async"
      />

      {/* 2. Cinematic Gradients */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0C0D10] via-[#0C0D10]/35 to-transparent pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-transparent to-transparent pointer-events-none" />

      {/* 3. Top-Right Status Bar */}
      <div className="absolute top-6 right-8 z-30 flex items-center gap-4 text-white/70">
        {currentTime && (
          <span className="font-semibold text-xs tracking-wider text-white/90">
            {currentTime}
          </span>
        )}

        {userAvatar && (
          <div className="w-8 h-8 rounded-lg overflow-hidden ring-1 ring-white/20">
            <img src={userAvatar} alt="" className="w-full h-full object-cover" />
          </div>
        )}

        {/* Botão Fechar Modal (Círculo Perfeito 1:1) */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="ml-2 w-10 h-10 min-w-[40px] min-h-[40px] aspect-square rounded-full shrink-0 flex items-center justify-center p-0 bg-black/60 hover:bg-white/15 text-white/80 hover:text-white border border-white/15 backdrop-blur-xl transition-all hover:rotate-90 active:scale-90 cursor-pointer shadow-lg"
        >
          <X className="w-4 h-4 shrink-0" />
        </button>
      </div>

      {/* 4. Game Logo / Title (Over the Banner, matching CS2 & Arena Breakout) */}
      <div className="absolute bottom-8 left-8 sm:left-14 max-w-[78%] z-20 pointer-events-none">
        {steamLogoUrl && !logoFailed ? (
          <img
            src={steamLogoUrl}
            alt={game.title}
            onError={() => setLogoFailed(true)}
            className="max-h-24 sm:max-h-32 md:max-h-40 object-contain drop-shadow-[0_12px_36px_rgba(0,0,0,0.9)]"
          />
        ) : (
          <h1
            title={game.title}
            className="text-3xl sm:text-5xl md:text-6xl font-display font-extrabold tracking-tight text-white leading-none whitespace-nowrap truncate drop-shadow-[0_8px_32px_rgba(0,0,0,0.95)]"
          >
            {game.title}
          </h1>
        )}
      </div>

      {/* 5. Online Friends Playing Badge on Bottom-Right of Banner (Like CS2 green badge) */}
      {friendsPlayingCount > 0 && (
        <div className="absolute bottom-8 right-8 sm:right-14 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500 text-black font-bold text-xs shadow-[0_4px_16px_rgba(16,185,129,0.5)] select-none">
          <Users className="w-3.5 h-3.5" />
          <span>{friendsPlayingCount}</span>
        </div>
      )}
    </div>
  );
});

GameDetailSteamHero.displayName = "GameDetailSteamHero";
export default GameDetailSteamHero;
