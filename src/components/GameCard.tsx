import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Play, Star, Gamepad2, MoreVertical, X } from "lucide-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSteam } from "@fortawesome/free-brands-svg-icons";
import {
  EpicBrandIcon,
  EaBrandIcon,
  UbisoftBrandIcon,
  GogBrandIcon,
  XboxBrandIcon,
  RiotBrandIcon,
  BattlenetBrandIcon,
  RockstarBrandIcon,
} from "./Sidebar";

export interface GameCardProps {
  title: string;
  image?: string;
  isActive: boolean;
  isSteam?: boolean;
  isEpic?: boolean;
  launcherType?: string;
  steamAppId?: number;
  isFavorite?: boolean;
  onClick: () => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onMenuClick?: (e: React.MouseEvent) => void;
  isMenuOpen?: boolean;
  playSound?: (type: any) => void;
}

const EPIC_GAMES_ICON_PATH = "/epic_games_store.ico";
const FALLBACK_CARD_BACKGROUND = "linear-gradient(180deg, #161820 0%, #08090C 100%)";
const CARD_WIDTH = 168;
const CARD_HEIGHT = 252;
const CARD_FRAME_WIDTH = 178;
const CARD_FRAME_HEIGHT = 264;

const GameCard: React.FC<GameCardProps> = ({
  title,
  image,
  isActive,
  isSteam,
  isEpic,
  launcherType,
  steamAppId,
  isFavorite = false,
  onClick,
  onKeyDown,
  onContextMenu,
  onMenuClick,
  isMenuOpen = false,
  playSound,
}) => {
  const [imageFailed, setImageFailed] = useState(false);
  const [useFallbackSteamUrl, setUseFallbackSteamUrl] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const btn = menuButtonRef.current;
    if (!btn) return;
    const stopNative = (e: PointerEvent | MouseEvent | TouchEvent) => {
      e.stopPropagation();
    };
    btn.addEventListener("pointerdown", stopNative, { capture: true });
    btn.addEventListener("mousedown", stopNative, { capture: true });
    btn.addEventListener("touchstart", stopNative, { capture: true });
    return () => {
      btn.removeEventListener("pointerdown", stopNative, { capture: true });
      btn.removeEventListener("mousedown", stopNative, { capture: true });
      btn.removeEventListener("touchstart", stopNative, { capture: true });
    };
  }, [isActive, onMenuClick]);

  // Reseta erros de imagem quando a prop `image` muda (ex: após edição do card)
  useEffect(() => {
    setImageFailed(false);
    setUseFallbackSteamUrl(false);
  }, [image]);

  const currentImageSrc = useMemo(() => {
    if (steamAppId && !imageFailed) {
      if (useFallbackSteamUrl) {
        return `https://cdn.cloudflare.steamstatic.com/steam/apps/${steamAppId}/library_600x900.jpg`;
      }
      return image || `https://cdn.cloudflare.steamstatic.com/steam/apps/${steamAppId}/library_600x900.jpg`;
    }
    return image || "";
  }, [steamAppId, imageFailed, useFallbackSteamUrl, image]);

  const hasAllFailed = imageFailed || !currentImageSrc;

  const handleImageError = useCallback(() => {
    if (steamAppId && !useFallbackSteamUrl) {
      setUseFallbackSteamUrl(true);
    } else {
      setImageFailed(true);
    }
  }, [steamAppId, useFallbackSteamUrl]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onClick();
      }
      onKeyDown?.(e);
    },
    [onClick, onKeyDown],
  );

  const platformBadge = useMemo(() => {
    const type = (launcherType || "").toLowerCase() || (isSteam ? "steam" : isEpic ? "epic" : "local");
    const badgeStyle = {
      color: "#FFFFFF",
      border: "rgba(255, 255, 255, 0.2)",
      background: "rgba(18, 20, 26, 0.92)",
    };

    if (type === "steam") {
      return {
        label: "Steam",
        ...badgeStyle,
        icon: <FontAwesomeIcon icon={faSteam} className="h-3 w-3 text-white" />,
      };
    }

    if (type === "epic") {
      return {
        label: "Epic",
        ...badgeStyle,
        icon: <EpicBrandIcon className="h-3 w-3 text-white" />,
      };
    }

    if (type === "ea") {
      return {
        label: "EA",
        ...badgeStyle,
        icon: <EaBrandIcon className="h-3 w-3 text-white" />,
      };
    }

    if (type === "ubisoft") {
      return {
        label: "Ubisoft",
        ...badgeStyle,
        icon: <UbisoftBrandIcon className="h-3 w-3 text-white" />,
      };
    }

    if (type === "gog") {
      return {
        label: "GOG",
        ...badgeStyle,
        icon: <GogBrandIcon className="h-3 w-3 text-white" />,
      };
    }

    if (type === "xbox") {
      return {
        label: "Xbox",
        ...badgeStyle,
        icon: <XboxBrandIcon className="h-3 w-3 text-white" />,
      };
    }

    if (type === "riot") {
      return {
        label: "Riot",
        ...badgeStyle,
        icon: <RiotBrandIcon className="h-3 w-3 text-white" />,
      };
    }

    if (type === "battlenet") {
      return {
        label: "B.net",
        ...badgeStyle,
        icon: <BattlenetBrandIcon className="h-3 w-3 text-white" />,
      };
    }

    if (type === "rockstar") {
      return {
        label: "Rockstar",
        ...badgeStyle,
        icon: <RockstarBrandIcon className="h-3 w-3 text-white" />,
      };
    }

    return {
      label: "Local",
      ...badgeStyle,
      icon: <Gamepad2 className="h-3 w-3 text-white" />,
    };
  }, [isEpic, isSteam, launcherType]);

  return (
    <div
      onClick={onClick}
      onKeyDown={handleKeyDown}
      onContextMenu={onContextMenu}
      role="button"
      tabIndex={0}
      aria-label={title}
      aria-pressed={isActive}
      data-game-card={true}
      className="group relative flex items-center justify-center p-0 text-left select-none focus:outline-none cursor-pointer"
      style={{
        width: CARD_FRAME_WIDTH,
        height: CARD_FRAME_HEIGHT,
        contain: "layout style",
      }}
    >
      <motion.div
        whileHover={{ scale: isActive ? 1.05 : 0.98, y: isActive ? -8 : -2 }}
        whileTap={{ scale: 0.95 }}
        animate={{
          scale: isActive ? 1.05 : 0.95,
          y: isActive ? -8 : 0,
          borderColor: isActive ? "var(--color-ui-detail)" : "rgba(255,255,255,0.08)"
        }}
        transition={{ type: "spring", bounce: 0.2, duration: 0.3 }}
        style={{
          width: CARD_WIDTH,
          height: CARD_HEIGHT,
          borderRadius: 24, /* Squircle outer approximation */
          boxShadow: isActive
            ? "0 25px 60px rgba(0,0,0,0.95), inset 0 1px 0 rgba(255,255,255,0.25)"
            : "0 10px 28px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.12)",
          transition: "box-shadow 0.3s ease",
        }}
        className={`relative isolate bg-[var(--color-surface)] border transform-gpu will-change-transform flex flex-col justify-between ${isActive ? "ring-2 ring-[var(--color-ui-detail)] z-20" : "z-10"
          }`}
      >
        {/* Clip container isolado - borda arredondada fica aqui, fora do layer de transform 3D */}
        <div className="absolute inset-0 overflow-hidden isolate" style={{ borderRadius: 23 }}>
          {/* Full-Bleed Cover Image Artwork */}
          {hasAllFailed ? (
            <div
              className="absolute inset-0 flex items-center justify-center p-5 text-center"
              style={{ background: FALLBACK_CARD_BACKGROUND }}
            >
              <span className="line-clamp-3 text-xs font-display font-medium text-white/70">
                {title}
              </span>
            </div>
          ) : (
            <motion.img
              src={currentImageSrc}
              alt={title}
              initial={false}
              animate={{ scale: isActive ? 1.06 : 1 }}
              whileHover={{ scale: 1.06 }}
              transition={{ type: "spring", bounce: 0.1, duration: 0.5 }}
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
              decoding="async"
              draggable={false}
              onError={handleImageError}
            />
          )}

          {/* Cinematic Vignette Overlay (Darker at bottom for text contrast) */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/35 to-black/20 pointer-events-none" />

          {/* Ambient Gloss Highlight on Top Edge */}
          <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/[0.08] to-transparent pointer-events-none" />
        </div>

        {/* Top Badges (Platform, Favorite & 3-Dots Morph Menu) */}
        <div className="absolute left-2.5 right-2.5 top-2.5 z-30 flex items-center justify-between pointer-events-none">
          {platformBadge && (
            <div
              className="flex items-center gap-1.5 rounded-xl px-2 py-1 shadow-sm"
              style={{
                background: platformBadge.background,
                border: `1px solid ${platformBadge.border}`,
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12)",
              }}
            >
              {platformBadge.icon}
              <span className="text-[10px] font-bold tracking-tight text-white uppercase">
                {platformBadge.label}
              </span>
            </div>
          )}

          <div className="flex items-center gap-1.5 pointer-events-auto ml-auto">
            {isFavorite && (
              <div
                className="flex h-6 w-6 items-center justify-center rounded-xl bg-[#12141A]/95 border border-white/20 shadow-sm pointer-events-none"
                style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.15)" }}
              >
                <Star className="h-3 w-3 fill-amber-400 text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]" />
              </div>
            )}

            {isActive && onMenuClick && (
              <motion.button
                ref={menuButtonRef}
                type="button"
                data-context-menu-trigger="true"
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.92 }}
                transition={{ type: "spring", bounce: 0.2, duration: 0.25 }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                }}
                onTouchStart={(e) => {
                  e.stopPropagation();
                }}
                onPointerUp={(e) => {
                  e.stopPropagation();
                }}
                onMouseUp={(e) => {
                  e.stopPropagation();
                }}
                onTouchEnd={(e) => {
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onMenuClick(e);
                }}
                className="relative flex h-7 w-7 items-center justify-center rounded-full bg-black/60 hover:bg-white/20 text-white/80 hover:text-white border border-white/20 hover:border-white/50 shadow-md hover:shadow-[0_0_14px_rgba(255,255,255,0.3)] backdrop-blur-md cursor-pointer transition-colors duration-200"
                aria-label={isMenuOpen ? "Fechar opções" : `Opções de ${title}`}
                title={isMenuOpen ? "Fechar opções" : "Opções do jogo"}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {isMenuOpen ? (
                    <motion.div
                      key="close-icon"
                      initial={{ rotate: -90, opacity: 0, scale: 0.7 }}
                      animate={{ rotate: 0, opacity: 1, scale: 1 }}
                      exit={{ rotate: 90, opacity: 0, scale: 0.7 }}
                      transition={{ type: "spring", bounce: 0.15, duration: 0.22 }}
                      className="flex items-center justify-center"
                    >
                      <X className="w-3.5 h-3.5 stroke-[2.2] text-white/90" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="more-icon"
                      initial={{ rotate: 90, opacity: 0, scale: 0.7 }}
                      animate={{ rotate: 0, opacity: 1, scale: 1 }}
                      exit={{ rotate: -90, opacity: 0, scale: 0.7 }}
                      transition={{ type: "spring", bounce: 0.15, duration: 0.22 }}
                      className="flex items-center justify-center"
                    >
                      <MoreVertical className="w-3.5 h-3.5 text-white/90" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
            )}
          </div>
        </div>

        {/* Central Interactive Play/Action Indicator */}
        <motion.div
          initial={false}
          animate={{
            opacity: isActive ? 1 : 0,
            scale: isActive ? 1 : 0.9
          }}
          whileHover={{ opacity: 1, scale: 0.95 }}
          transition={{ type: "spring", bounce: 0.2, duration: 0.3 }}
          className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none"
        >
          <motion.div
            animate={{
              scale: isActive ? 1.1 : 1,
              boxShadow: isActive ? "0 0 30px rgba(255,255,255,0.5)" : "0 0 24px rgba(255,255,255,0.3)"
            }}
            whileHover={{ scale: 1.1 }}
            transition={{ type: "spring", bounce: 0.3, duration: 0.3 }}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[#12141A]/90 border border-white/40 shadow-lg"
            style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2)" }}
          >
            <Play className="h-4 w-4 fill-white text-white ml-0.5" />
          </motion.div>
        </motion.div>


        {/* Bottom Title and Source Metadata (Consistent Typography Scale) */}
        <div className="relative z-20 mt-auto p-3.5 flex flex-col justify-end pointer-events-none">
          <h3 className="line-clamp-2 text-sm font-display font-bold text-white tracking-tight leading-snug drop-shadow-md">
            {title}
          </h3>
          <p className="mt-0.5 text-[11px] font-body font-medium text-white/50 line-clamp-1 drop-shadow-sm">
            {platformBadge?.label || "Jogo"} • Pherielium
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default React.memo(GameCard);
