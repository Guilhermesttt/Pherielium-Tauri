import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import {
  SfGamepadIcon,
  SfStarIcon,
  SfUsersIcon,
  SfRadarIcon,
  SfHammerIcon,
  SfComputerIcon,
  SfUserIcon,
  SfTrophyIcon,
  SfGearIcon,
  SfCarIcon,
  SfShieldIcon,
  SfGlobeIcon,
  SfScopeIcon,
  SfFlameIcon,
  SfMapIcon,
  SfBoltIcon,
  SfSlidersIcon,
} from "../design-system/sf-symbols";

import {
  GamepadIcon as AnimatedGamepadIcon,
  HammerIcon as AnimatedHammerIcon,
  LaptopIcon as AnimatedLaptopIcon,
  RadioIcon as AnimatedRadioIcon,
  SettingsIcon as AnimatedSettingsIcon,
  StarIcon as AnimatedStarIcon,
  UserIcon as AnimatedUserIcon,
  UsersIcon as AnimatedUsersIcon,
  type AnimatedIconHandle,
  type AnimatedIconProps,
} from "./animated/SidebarIcons";

import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import { faSteam, faDiscord, faXbox } from "@fortawesome/free-brands-svg-icons";

import {
  PHERIELIUM_LOGO_PATH,
  EPIC_GAMES_ICON_PATH,
  EA_GAMES_ICON_PATH,
  UBISOFT_ICON_PATH,
  GOG_ICON_PATH,
  RIOT_GAMES_ICON_PATH,
  BATTLENET_ICON_PATH,
  ROCKSTAR_ICON_PATH,
} from "../constants/assets";

import type { SoundEffectType } from "../hooks/useSoundEffects";

import { type LauncherLanguage } from "../context/PreferencesContext";

import {
  SIDEBAR_NAVIGATION_GROUPS,
  SIDEBAR_NAVIGATION_ORDER,
} from "../services/launcherNavigation";

import {
  useGamepad,
  useGamepadButton,
  playHapticPattern,
} from "../context/GamepadContext";
import { ControllerButtonGlyph } from "./ui/ControllerButtonGlyph";
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";

export const SteamBrandIcon: React.FC<{
  className?: string;
  style?: React.CSSProperties;
}> = ({ className, style }) => (
  <FontAwesomeIcon icon={faSteam} className={className} style={style as any} />
);

export const DiscordBrandIcon: React.FC<{
  className?: string;
  style?: React.CSSProperties;
}> = ({ className, style }) => (
  <FontAwesomeIcon
    icon={faDiscord}
    className={className}
    style={style as any}
  />
);

export const XboxBrandIcon: React.FC<{
  className?: string;
  style?: React.CSSProperties;
}> = ({ className, style }) => (
  <FontAwesomeIcon icon={faXbox} className={className} style={style as any} />
);

const createMaskIcon = (path: string) => {
  return function MaskIcon({
    className,
    style,
  }: {
    className?: string;
    style?: React.CSSProperties;
  }) {
    const { color, filter, ...restStyle } = style ?? {};

    return (
      <span
        role="img"
        aria-hidden="true"
        className={className}
        style={{
          ...restStyle,

          display: "inline-block",

          backgroundColor: (color as string) ?? "currentColor",

          WebkitMaskImage: `url(${path})`,

          maskImage: `url(${path})`,

          WebkitMaskSize: "contain",

          maskSize: "contain",

          WebkitMaskRepeat: "no-repeat",

          maskRepeat: "no-repeat",

          WebkitMaskPosition: "center",

          maskPosition: "center",

          filter: filter && filter !== "none" ? (filter as string) : undefined,
        }}
      />
    );
  };
};

export const EpicBrandIcon = createMaskIcon(EPIC_GAMES_ICON_PATH);

export const EaBrandIcon = createMaskIcon(EA_GAMES_ICON_PATH);

export const UbisoftBrandIcon = createMaskIcon(UBISOFT_ICON_PATH);

export const GogBrandIcon = createMaskIcon(GOG_ICON_PATH);

export const RiotBrandIcon = createMaskIcon(RIOT_GAMES_ICON_PATH);

export const BattlenetBrandIcon = createMaskIcon(BATTLENET_ICON_PATH);

export const RockstarBrandIcon = createMaskIcon(ROCKSTAR_ICON_PATH);

// eslint-disable-next-line react-refresh/only-export-components

export const CATEGORIES = [
  {
    id: "ALL",
    label: "Todos",
    Icon: SfGamepadIcon,
    AnimatedIcon: AnimatedGamepadIcon,
  },

  {
    id: "FAVORITES",
    label: "Favoritos",
    Icon: SfStarIcon,
    AnimatedIcon: AnimatedStarIcon,
  },

  {
    id: "FRIENDS",
    label: "Amigos",
    Icon: SfUsersIcon,
    AnimatedIcon: AnimatedUsersIcon,
  },

  {
    id: "FEED",
    label: "Radar",
    Icon: SfRadarIcon,
    AnimatedIcon: AnimatedRadioIcon,
  },

  { id: "MODS", label: "Mods", Icon: SfHammerIcon, AnimatedIcon: AnimatedHammerIcon },

  { id: "STEAM", label: "Steam", Icon: SteamBrandIcon },

  { id: "EPIC", label: "Epic", Icon: EpicBrandIcon },

  { id: "EA", label: "EA App", Icon: EaBrandIcon },

  { id: "UBISOFT", label: "Ubisoft", Icon: UbisoftBrandIcon },

  { id: "GOG", label: "GOG", Icon: GogBrandIcon },

  { id: "XBOX", label: "Xbox", Icon: XboxBrandIcon },

  { id: "RIOT", label: "Riot Games", Icon: RiotBrandIcon },

  { id: "BATTLENET", label: "Battle.net", Icon: BattlenetBrandIcon },

  { id: "ROCKSTAR", label: "Rockstar", Icon: RockstarBrandIcon },

  {
    id: "LOCAL",
    label: "Local",
    Icon: SfComputerIcon,
    AnimatedIcon: AnimatedLaptopIcon,
  },

  {
    id: "PROFILE",
    label: "Perfil",
    Icon: SfUserIcon,
    AnimatedIcon: AnimatedUserIcon,
  },

  { id: "TROPHIES", label: "Troféus", Icon: SfTrophyIcon },

  { id: "RACING", label: "Corrida", Icon: SfCarIcon },

  { id: "ROLEPLAYING", label: "RPG", Icon: SfShieldIcon },

  { id: "SPORTS", label: "Esportes", Icon: SfTrophyIcon },

  { id: "ONLINE", label: "Online", Icon: SfGlobeIcon },

  { id: "SHOOTER", label: "Tiro", Icon: SfScopeIcon },

  { id: "ACTION", label: "Ação", Icon: SfFlameIcon },

  { id: "ADVENTURE", label: "Aventura", Icon: SfMapIcon },

  { id: "HORROR", label: "Terror", Icon: SfBoltIcon },

  { id: "STRATEGY", label: "Estratégia", Icon: SfSlidersIcon },

  { id: "FIGHTING", label: "Luta", Icon: SfShieldIcon },
];

// eslint-disable-next-line react-refresh/only-export-components

export const SIDEBAR_CATEGORIES = CATEGORIES.filter(({ id }) =>
  SIDEBAR_NAVIGATION_ORDER.includes(
    id as (typeof SIDEBAR_NAVIGATION_ORDER)[number],
  ),
).sort(
  (left, right) =>
    SIDEBAR_NAVIGATION_ORDER.indexOf(
      left.id as (typeof SIDEBAR_NAVIGATION_ORDER)[number],
    ) -
    SIDEBAR_NAVIGATION_ORDER.indexOf(
      right.id as (typeof SIDEBAR_NAVIGATION_ORDER)[number],
    ),
);

interface SidebarProps {
  activeCategory: string;
  onCategory: (id: string) => void;
  settingsLabel: string;
  playSound: (t: SoundEffectType) => void;
  notificationCount?: number;
  language?: LauncherLanguage;
  userDisplay?: string;
  userAvatar?: string;
  platformOperations?: any;
}

type AnimatedSidebarIcon = React.ForwardRefExoticComponent<
  AnimatedIconProps & React.RefAttributes<AnimatedIconHandle>
>;

interface NavItemDefinition {
  id: string;
  label: string;
  Icon: React.ComponentType<{
    className?: string;
    style?: React.CSSProperties;
    active?: boolean;
  }>;
  AnimatedIcon?: AnimatedSidebarIcon;
  notificationCount?: number;
  rotateOnHover?: boolean;
}

interface NavButtonProps {
  id: string;
  label: string;
  Icon: React.ComponentType<{
    className?: string;
    style?: React.CSSProperties;
    active?: boolean;
  }>;
  AnimatedIcon?: AnimatedSidebarIcon;
  active: boolean;
  onClick: () => void;
  notificationCount?: number;
  reducedMotion?: boolean;
  rotateOnHover?: boolean;
  isFocused?: boolean;
}

const RailButton: React.FC<NavButtonProps> = ({
  id,
  label,
  Icon,
  AnimatedIcon,
  active,
  onClick,
  notificationCount = 0,
  reducedMotion = false,
  rotateOnHover = false,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const hasNotifications = notificationCount > 0;
  const animatedIconRef = useRef<AnimatedIconHandle>(null);
  const animationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (animationTimerRef.current) clearTimeout(animationTimerRef.current);
    },
    [],
  );

  const playIconAnimation = () => {
    if (!AnimatedIcon || reducedMotion || animationTimerRef.current) return;
    animatedIconRef.current?.startAnimation();
    animationTimerRef.current = setTimeout(() => {
      animatedIconRef.current?.stopAnimation();
      animationTimerRef.current = null;
    }, 1300);
  };

  const iconStyle = active
    ? {
        color: "var(--selection-text, rgb(var(--launcher-accent)))",
        filter: "drop-shadow(0 0 10px rgb(var(--launcher-accent) / 0.7))",
        transition: "color 0.3s ease, filter 0.3s ease",
      }
    : { transition: "color 0.3s ease, filter 0.3s ease" };

  const inactiveIconClass = active
    ? ""
    : "text-[#6C6C6C] group-hover:text-white";

  const showGlide = Boolean(!reducedMotion && !active && isHovered);

  const buttonElement = (
    <motion.button
      type="button"
      onClick={onClick}
      onMouseEnter={() => {
        playIconAnimation();
        setIsHovered(true);
      }}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsHovered(true)}
      onBlur={() => setIsHovered(false)}
      aria-label={
        hasNotifications ? `${label}, ${notificationCount} notificações` : label
      }
      aria-current={active ? "page" : undefined}
      data-sidebar-item={id}
      whileTap={{ scale: 0.95 }}
      transition={{ type: "spring", bounce: 0.2, duration: 0.3 }}
      className="relative group flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-[12px] border border-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-selected)]"
      style={{
        background: active
          ? "var(--selection-bg, rgb(var(--launcher-accent) / 0.14))"
          : "transparent",
        borderColor: active
          ? "var(--selection-border, transparent)"
          : "transparent",
        color: active ? "var(--selection-text, inherit)" : undefined,
        boxShadow: active
          ? "0 4px 12px rgba(0, 0, 0, 0.2), var(--surface-chamfer, inset 0 1px 0 rgba(255, 255, 255, 0.15))"
          : "none",
      }}
    >
      {showGlide && (
        <motion.span
          aria-hidden
          layoutId="sidebar-rail-glide"
          transition={{ type: "spring", bounce: 0.2, duration: 0.3 }}
          className="absolute inset-0 rounded-[12px] bg-white/8 shadow-[inset_0_1px_0_rgba(255,255,255,0.09)]"
        />
      )}

      <div
        className={`relative z-10 flex items-center justify-center shrink-0 ${
          rotateOnHover && !AnimatedIcon ? "group-hover:rotate-45" : ""
        }`}
      >
        {AnimatedIcon ? (
          <AnimatedIcon
            ref={animatedIconRef}
            active={active}
            size={22}
            duration={1}
            className={`h-5.5 w-5.5 ${inactiveIconClass}`}
            style={iconStyle}
          />
        ) : (
          <Icon
            active={active}
            className={`h-5.5 w-5.5 ${inactiveIconClass}`}
            style={iconStyle}
          />
        )}
      </div>

      {hasNotifications && (
        <span
          className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full"
          style={{
            background: "rgb(var(--launcher-accent))",
            boxShadow: "0 0 8px rgb(var(--launcher-accent) / 1)",
          }}
        />
      )}
    </motion.button>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex justify-center">{buttonElement}</span>
      </TooltipTrigger>
      <TooltipContent
        side="right"
        align="center"
        sideOffset={16}
        className="border border-[#161616] bg-[#0F0F0F]/90 px-3 py-1.5 text-xs text-[#D2D2D2] tracking-wide backdrop-blur-2xl rounded-lg shadow-[0_10px_40px_rgba(0,0,0,0.5)]"
      >
        {label}
      </TooltipContent>
    </Tooltip>
  );
};

const OverlayButton: React.FC<NavButtonProps> = ({
  id,
  label,
  Icon,
  AnimatedIcon,
  active,
  onClick,
  notificationCount = 0,
  reducedMotion = false,
  rotateOnHover = false,
  isFocused = false,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const hasNotifications = notificationCount > 0;
  const animatedIconRef = useRef<AnimatedIconHandle>(null);
  const animationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (animationTimerRef.current) clearTimeout(animationTimerRef.current);
    },
    [],
  );

  const playIconAnimation = () => {
    if (!AnimatedIcon || reducedMotion || animationTimerRef.current) return;
    animatedIconRef.current?.startAnimation();
    animationTimerRef.current = setTimeout(() => {
      animatedIconRef.current?.stopAnimation();
      animationTimerRef.current = null;
    }, 1300);
  };

  useEffect(() => {
    if (isFocused) {
      playIconAnimation();
    }
  }, [isFocused]);

  const iconStyle = active
    ? {
        color: "var(--selection-text, rgb(var(--launcher-accent)))",
        filter: "drop-shadow(0 0 10px rgb(var(--launcher-accent) / 0.7))",
        transition: "color 0.3s ease, filter 0.3s ease",
      }
    : { transition: "color 0.3s ease, filter 0.3s ease" };

  const inactiveIconClass = active
    ? ""
    : "text-[#6C6C6C] group-hover:text-white";

  const showGlide = Boolean(isFocused || (!reducedMotion && !active && isHovered));

  return (
    <motion.button
      type="button"
      onClick={onClick}
      onMouseEnter={() => {
        playIconAnimation();
        setIsHovered(true);
      }}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsHovered(true)}
      onBlur={() => setIsHovered(false)}
      aria-label={
        hasNotifications ? `${label}, ${notificationCount} notificações` : label
      }
      aria-current={active ? "page" : undefined}
      data-sidebar-item={id}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", bounce: 0.2, duration: 0.3 }}
      className={`relative group flex h-11 w-full cursor-pointer items-center gap-3 px-3 rounded-[12px] border border-transparent text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-selected)] ${
        isFocused ? "ring-2 ring-white/70 bg-white/10" : ""
      }`}
      style={{
        color: active ? "var(--selection-text, inherit)" : undefined,
      }}
    >
      {/* Smooth Active Selection Pill (Glides between items) */}
      {active && (
        <motion.span
          aria-hidden
          layoutId="sidebar-active-pill"
          transition={{ type: "spring", bounce: 0.18, duration: 0.35 }}
          className="absolute inset-0 rounded-[12px] border shadow-[0_4px_16px_rgba(0,0,0,0.35),var(--surface-chamfer,inset_0_1px_0_rgba(255,255,255,0.18))]"
          style={{
            background: "var(--selection-bg, rgb(var(--launcher-accent) / 0.16))",
            borderColor: "var(--selection-border, rgba(255, 255, 255, 0.12))",
          }}
        />
      )}

      {/* Smooth Hover Glide Pill */}
      {showGlide && !active && (
        <motion.span
          aria-hidden
          layoutId="sidebar-hover-glide"
          transition={{ type: "spring", bounce: 0.15, duration: 0.25 }}
          className="absolute inset-0 rounded-[12px] bg-white/[0.07] border border-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
        />
      )}

      <div
        className={`relative z-10 flex items-center justify-center shrink-0 ${
          rotateOnHover && !AnimatedIcon ? "group-hover:rotate-45" : ""
        }`}
      >
        {AnimatedIcon ? (
          <AnimatedIcon
            ref={animatedIconRef}
            active={active}
            size={22}
            duration={1}
            className={`h-5.5 w-5.5 ${inactiveIconClass}`}
            style={iconStyle}
          />
        ) : (
          <Icon
            active={active}
            className={`h-5.5 w-5.5 ${inactiveIconClass}`}
            style={iconStyle}
          />
        )}
      </div>

      <div className="relative z-10 flex flex-1 items-center justify-between min-w-0">
        <span
          className={`truncate font-body text-sm tracking-[0.015em] ${
            active
              ? "font-semibold"
              : "text-[#6C6C6C] group-hover:text-white"
          }`}
          style={
            active
              ? {
                  color: "var(--selection-text, rgb(var(--launcher-accent)))",
                  textShadow: "0 0 8px rgb(var(--launcher-accent) / 0.5)",
                }
              : undefined
          }
        >
          {label}
        </span>

        {hasNotifications && (
          <div className="relative flex items-center justify-center shrink-0">
            <span
              className="flex h-5 min-w-5 items-center justify-center rounded-md border px-1.5 text-[10px] font-bold text-black shadow-[0_0_12px_rgb(var(--launcher-accent)/0.3)] backdrop-blur-md"
              style={{
                background: "rgb(var(--launcher-accent))",
                borderColor: "rgb(var(--launcher-accent) / 0.4)",
              }}
            >
              {notificationCount > 99 ? "99+" : notificationCount}
            </span>
          </div>
        )}
      </div>
    </motion.button>
  );
};

const Sidebar: React.FC<SidebarProps> = ({
  activeCategory,
  onCategory,
  settingsLabel,
  playSound,
  notificationCount = 0,
  language = "pt-BR",
}) => {
  const prefersReducedMotion = useReducedMotion();

  const [isExpanded, setIsExpanded] = useState<boolean>(() => {
    try {
      return localStorage.getItem("checkpoint_sidebar_expanded") === "true";
    } catch {
      return false;
    }
  });

  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (isExpanded) {
      playSound("detailOpen");
    } else {
      playSound("modalClose");
    }
  }, [isExpanded, playSound]);

  const toggleExpand = () => {
    const next = !isExpanded;
    setIsExpanded(next);
    try {
      localStorage.setItem("checkpoint_sidebar_expanded", String(next));
    } catch {
      void 0;
    }
    window.dispatchEvent(
      new CustomEvent("checkpoint:sidebar-toggle", {
        detail: { expanded: next },
      }),
    );
  };

  useEffect(() => {
    const handleForceToggle = (e: any) => {
      if (e.detail?.expanded !== undefined) {
        setIsExpanded(e.detail.expanded);
        try {
          localStorage.setItem(
            "checkpoint_sidebar_expanded",
            String(e.detail.expanded),
          );
        } catch {
          void 0;
        }
      }
    };

    window.addEventListener("checkpoint:sidebar-toggle", handleForceToggle);
    return () =>
      window.removeEventListener(
        "checkpoint:sidebar-toggle",
        handleForceToggle,
      );
  }, []);

  useEffect(() => {
    if (!isExpanded) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsExpanded(false);
        try {
          localStorage.setItem("checkpoint_sidebar_expanded", "false");
        } catch {
          void 0;
        }
        window.dispatchEvent(
          new CustomEvent("checkpoint:sidebar-toggle", {
            detail: { expanded: false },
          }),
        );
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isExpanded]);

  // Hover & edge-trigger logic for auto-hide sidebar
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleOpenSidebar = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setIsExpanded(true);
  }, []);

  const handleCloseSidebar = useCallback(() => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    closeTimeoutRef.current = setTimeout(() => {
      setIsExpanded(false);
    }, 250);
  }, []);

  // Listen to mouse touching the leftmost edge (clientX <= 12)
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (e.clientX <= 12) {
        handleOpenSidebar();
      }
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [handleOpenSidebar]);

  const { isGamepadConnected, gamepadFamily } = useGamepad();

  const ALL_SIDEBAR_IDS = useMemo(
    () => [
      "ALL",
      "FAVORITES",
      "FRIENDS",
      "FEED",
      "TROPHIES",
      "PROFILE",
      "MODS",
      "SETTINGS",
    ],
    [],
  );

  const [focusedNavIndex, setFocusedNavIndex] = useState(0);

  useEffect(() => {
    if (isExpanded) {
      const idx = ALL_SIDEBAR_IDS.indexOf(activeCategory);
      setFocusedNavIndex(idx >= 0 ? idx : 0);
    }
  }, [isExpanded, activeCategory, ALL_SIDEBAR_IDS]);

  useGamepadButton(
    "DPAD_UP",
    () => {
      playSound("navigate");
      playHapticPattern("nav");
      setFocusedNavIndex((p) => (p - 1 + ALL_SIDEBAR_IDS.length) % ALL_SIDEBAR_IDS.length);
    },
    isExpanded,
    260,
  );

  useGamepadButton(
    "DPAD_DOWN",
    () => {
      playSound("navigate");
      playHapticPattern("nav");
      setFocusedNavIndex((p) => (p + 1) % ALL_SIDEBAR_IDS.length);
    },
    isExpanded,
    260,
  );

  useGamepadButton(
    "X",
    () => {
      const targetId = ALL_SIDEBAR_IDS[focusedNavIndex];
      if (targetId) {
        playSound("select");
        playHapticPattern("action");
        onCategory(targetId);
        setIsExpanded(false);
      }
    },
    isExpanded,
    260,
  );

  useGamepadButton(
    "O",
    () => {
      playSound("back");
      playHapticPattern("nav");
      setIsExpanded(false);
    },
    isExpanded,
    260,
  );

  useGamepadButton(
    "OPTIONS",
    () => {
      playSound("back");
      playHapticPattern("nav");
      setIsExpanded(false);
    },
    isExpanded,
    260,
  );

  const sidebarLabels: Record<string, string> = {
    ALL:
      {
        "pt-BR": "Todos os Jogos",
        "en-US": "All Games",
        "es-ES": "Todos los juegos",
        "fr-FR": "Tous les jeux",
        "de-DE": "Alle Spiele",
        "it-IT": "Tutti i giochi",
      }[language] || "Todos os Jogos",

    FAVORITES:
      {
        "pt-BR": "Favoritos",
        "en-US": "Favorites",
        "es-ES": "Favoritos",
        "fr-FR": "Favoris",
        "de-DE": "Favoriten",
        "it-IT": "Preferiti",
      }[language] || "Favoritos",

    FRIENDS:
      {
        "pt-BR": "Amigos",
        "en-US": "Friends",
        "es-ES": "Amigos",
        "fr-FR": "Amis",
        "de-DE": "Freunde",
        "it-IT": "Amici",
      }[language] || "Amigos",

    FEED:
      {
        "pt-BR": "Radar Gamer",
        "en-US": "Gaming Radar",
        "es-ES": "Radar Gamer",
        "fr-FR": "Radar Gamer",
        "de-DE": "Gaming Radar",
        "it-IT": "Radar Gamer",
      }[language] || "Radar Gamer",

    MODS:
      {
        "pt-BR": "Gerenciador de Mods",
        "en-US": "Mods Manager",
        "es-ES": "Gestor de Mods",
        "fr-FR": "Gestionnaire de Mods",
        "de-DE": "Mod-Manager",
        "it-IT": "Gestore Mod",
      }[language] || "Gerenciador de Mods",

    STEAM: "Steam",
    EPIC: "Epic Games",

    LOCAL:
      {
        "pt-BR": "Jogos Locais",
        "en-US": "Local Games",
        "es-ES": "Juegos Locales",
        "fr-FR": "Jeux Locaux",
        "de-DE": "Lokale Spiele",
        "it-IT": "Giochi Locali",
      }[language] || "Jogos Locais",

    PROFILE:
      {
        "pt-BR": "Perfil",
        "en-US": "Profile",
        "es-ES": "Perfil",
        "fr-FR": "Profil",
        "de-DE": "Profil",
        "it-IT": "Profilo",
      }[language] || "Perfil",

    TROPHIES:
      {
        "pt-BR": "Troféus",
        "en-US": "Trophies",
        "es-ES": "Trofeos",
        "fr-FR": "Trophées",
        "de-DE": "Erfolge",
        "it-IT": "Trofei",
      }[language] || "Troféus",
  };

  const groupLabels: Record<string, string> = {
    filters:
      {
        "pt-BR": "MENU",
        "en-US": "MENU",
        "es-ES": "MENÚ",
        "fr-FR": "MENU",
        "de-DE": "MENÜ",
        "it-IT": "MENU",
      }[language] || "MENU",

    community:
      {
        "pt-BR": "SOCIAL",
        "en-US": "SOCIAL",
        "es-ES": "SOCIAL",
        "fr-FR": "SOCIAL",
        "de-DE": "SOZIAL",
        "it-IT": "SOCIAL",
      }[language] || "SOCIAL",

    mods:
      {
        "pt-BR": "FERRAMENTAS",
        "en-US": "TOOLS",
        "es-ES": "HERRAMIENTAS",
        "fr-FR": "OUTILS",
        "de-DE": "WERKZEUGE",
        "it-IT": "STRUMENTI",
      }[language] || "FERRAMENTAS",
  };

  const upperNavItems: NavItemDefinition[] = [
    {
      id: "ALL",
      label: sidebarLabels.ALL,
      Icon: SfGamepadIcon,
      AnimatedIcon: AnimatedGamepadIcon,
    },
    {
      id: "FAVORITES",
      label: sidebarLabels.FAVORITES,
      Icon: SfStarIcon,
      AnimatedIcon: AnimatedStarIcon,
    },
    {
      id: "FRIENDS",
      label: sidebarLabels.FRIENDS,
      Icon: SfUsersIcon,
      AnimatedIcon: AnimatedUsersIcon,
      notificationCount,
    },
    {
      id: "FEED",
      label: sidebarLabels.FEED,
      Icon: SfRadarIcon,
      AnimatedIcon: AnimatedRadioIcon,
    },
  ];

  const lowerNavItems: NavItemDefinition[] = [
    {
      id: "TROPHIES",
      label: sidebarLabels.TROPHIES,
      Icon: SfTrophyIcon,
    },
    {
      id: "MODS",
      label: sidebarLabels.MODS,
      Icon: SfHammerIcon,
      AnimatedIcon: AnimatedHammerIcon,
    },
    {
      id: "PROFILE",
      label: sidebarLabels.PROFILE,
      Icon: SfUserIcon,
      AnimatedIcon: AnimatedUserIcon,
    },
    {
      id: "SETTINGS",
      label: settingsLabel,
      Icon: SfGearIcon,
      AnimatedIcon: AnimatedSettingsIcon,
      rotateOnHover: true,
    },
  ];

  const overlaySections = [
    {
      key: "filters",
      title: groupLabels.filters,
      items: upperNavItems.slice(0, 2), // ALL, FAVORITES
    },
    {
      key: "community",
      title: groupLabels.community,
      items: [
        upperNavItems[2], // FRIENDS
        upperNavItems[3], // FEED
        lowerNavItems[0], // TROPHIES
        lowerNavItems[2], // PROFILE
      ],
    },
    {
      key: "mods",
      title: groupLabels.mods,
      items: [
        lowerNavItems[1], // MODS
        lowerNavItems[3], // SETTINGS
      ],
    },
  ];

  return (
    <>
      {/* Invisible edge trigger strip on the far left edge of the screen */}
      <div
        onMouseEnter={handleOpenSidebar}
        className="fixed left-0 top-0 bottom-0 w-3.5 z-40 pointer-events-auto"
        aria-hidden="true"
      />

      {/* Auto-hiding Slide-over Sidebar Drawer */}
      <AnimatePresence>
        {isExpanded && (
          <>
            {/* Click-outside backdrop */}
            <motion.div
              key="sidebar-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsExpanded(false)}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs"
              aria-hidden="true"
            />

            {/* Slide-over floating panel (~260px) */}
            <motion.aside
              key="sidebar-overlay"
              initial={prefersReducedMotion ? { opacity: 0 } : { x: -260 }}
              animate={{ x: 0, opacity: 1 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { x: -260 }}
              transition={{ type: "spring", bounce: 0, duration: 0.35 }}
              onMouseEnter={handleOpenSidebar}
              onMouseLeave={handleCloseSidebar}
              className="fixed left-0 top-0 bottom-0 w-[260px] z-50 bg-[#0D0D0D] border-r border-white/[0.08] shadow-[24px_0_60px_rgba(0,0,0,0.85)] p-4 flex flex-col select-none overflow-y-auto no-scrollbar"
              aria-label="Menu de navegação"
            >
              {/* Header: Logo + Pherielium Brand */}
              <div
                onClick={() => setIsExpanded(false)}
                role="button"
                tabIndex={0}
                className="relative mb-6 flex cursor-pointer items-center gap-3 px-1 group"
              >
                <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[#161616] shadow-[0_4px_16px_rgba(0,0,0,0.2)] transition-colors group-hover:bg-[#1E1E1E]">
                  <img
                    src={PHERIELIUM_LOGO_PATH}
                    alt="Pherielium"
                    className="h-7 w-7 object-contain grayscale brightness-200 opacity-90 transition-opacity group-hover:opacity-100"
                  />
                </div>

                <div className="flex items-center min-w-0">
                  <span className="font-display font-bold text-[22px] bg-linear-to-b from-[#FFFFFF] to-[#8A8A8A] bg-clip-text text-transparent tracking-tight flex items-start gap-0.5">
                    Pherielium
                    <span className="text-white/40 text-[13px] font-semibold translate-y-0.5">
                      &reg;
                    </span>
                  </span>
                </div>
              </div>

              {/* Navigation Sections */}
              <nav aria-label="Navegação do menu" className="flex flex-col flex-1 min-h-0">
                {overlaySections.map((section, sIndex) => (
                  <div key={section.key} role="group" className="flex flex-col">
                    <span
                      className={`text-[11px] font-semibold tracking-wide text-[#6C6C6C] font-body uppercase px-3 mb-2 ${
                        sIndex > 0 ? "mt-6" : ""
                      }`}
                    >
                      {section.title}
                    </span>

                    <div className="flex flex-col gap-1">
                      {section.items.map((item) => (
                        <OverlayButton
                          key={item.id}
                          id={item.id}
                          label={item.label}
                          Icon={item.Icon}
                          AnimatedIcon={item.AnimatedIcon}
                          active={activeCategory === item.id}
                          isFocused={ALL_SIDEBAR_IDS[focusedNavIndex] === item.id}
                          onClick={() => {
                            onCategory(item.id);
                            playSound("showModal");
                            setIsExpanded(false);
                          }}
                          notificationCount={item.notificationCount}
                          reducedMotion={Boolean(prefersReducedMotion)}
                          rotateOnHover={item.rotateOnHover}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </nav>

              {/* Controller Navigation Hint in Sidebar Footer */}
              {isGamepadConnected && (
                <div className="mt-auto pt-3 border-t border-white/[0.08] flex items-center justify-between text-[11px] text-white/60 select-none">
                  <div className="flex items-center gap-1.5">
                    <ControllerButtonGlyph button="DPAD" gamepadFamily={gamepadFamily} size={15} />
                    <span>Navegar</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-white/90">
                    <ControllerButtonGlyph button="A" gamepadFamily={gamepadFamily} size={15} />
                    <span className="font-semibold text-white">Selecionar</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <ControllerButtonGlyph button="B" gamepadFamily={gamepadFamily} size={15} />
                    <span>Fechar</span>
                  </div>
                </div>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default Sidebar;
