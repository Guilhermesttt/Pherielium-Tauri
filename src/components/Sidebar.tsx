

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import {

  User, Star, Gamepad2, Zap, Car, Swords, Trophy, Globe, Crosshair,

  Settings, Users, Newspaper, Laptop, Puzzle, Folder, FolderOpen, PanelLeft,

} from "lucide-react";

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

  PHERIELIUM_LOGO_PATH, EPIC_GAMES_ICON_PATH, EA_GAMES_ICON_PATH,

  UBISOFT_ICON_PATH, GOG_ICON_PATH, RIOT_GAMES_ICON_PATH,

  BATTLENET_ICON_PATH, ROCKSTAR_ICON_PATH,

} from "../constants/assets";

import type { SoundEffectType } from "../hooks/useSoundEffects";

import { type LauncherLanguage } from "../context/PreferencesContext";

import { SIDEBAR_NAVIGATION_GROUPS, SIDEBAR_NAVIGATION_ORDER } from "../services/launcherNavigation";

import { useGamepadButton } from "../context/GamepadContext";
import React, { useState } from "react";

export const SteamBrandIcon: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className, style }) => <FontAwesomeIcon icon={faSteam} className={className} style={style as any} />;

export const DiscordBrandIcon: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className, style }) => <FontAwesomeIcon icon={faDiscord} className={className} style={style as any} />;

export const XboxBrandIcon: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className, style }) => <FontAwesomeIcon icon={faXbox} className={className} style={style as any} />;

const createMaskIcon = (path: string) => {

  return function MaskIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {

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

  { id: "ALL", label: "Todos", Icon: Gamepad2, AnimatedIcon: AnimatedGamepadIcon },

  { id: "FAVORITES", label: "Favoritos", Icon: Star, AnimatedIcon: AnimatedStarIcon },

  { id: "FRIENDS", label: "Amigos", Icon: Users, AnimatedIcon: AnimatedUsersIcon },

  { id: "FEED", label: "Radar", Icon: Newspaper, AnimatedIcon: AnimatedRadioIcon },

  { id: "MODS", label: "Mods", Icon: Puzzle, AnimatedIcon: AnimatedHammerIcon },

  { id: "STEAM", label: "Steam", Icon: SteamBrandIcon },

  { id: "EPIC", label: "Epic", Icon: EpicBrandIcon },

  { id: "EA", label: "EA App", Icon: EaBrandIcon },

  { id: "UBISOFT", label: "Ubisoft", Icon: UbisoftBrandIcon },

  { id: "GOG", label: "GOG", Icon: GogBrandIcon },

  { id: "XBOX", label: "Xbox", Icon: XboxBrandIcon },

  { id: "RIOT", label: "Riot Games", Icon: RiotBrandIcon },

  { id: "BATTLENET", label: "Battle.net", Icon: BattlenetBrandIcon },

  { id: "ROCKSTAR", label: "Rockstar", Icon: RockstarBrandIcon },

  { id: "LOCAL", label: "Local", Icon: Laptop, AnimatedIcon: AnimatedLaptopIcon },

  { id: "PROFILE", label: "Perfil", Icon: User, AnimatedIcon: AnimatedUserIcon },

  { id: "TROPHIES", label: "Troféus", Icon: Trophy },

  { id: "RACING", label: "Corrida", Icon: Car },

  { id: "ROLEPLAYING", label: "RPG", Icon: Swords },

  { id: "SPORTS", label: "Esportes", Icon: Trophy },

  { id: "ONLINE", label: "Online", Icon: Globe },

  { id: "SHOOTER", label: "Tiro", Icon: Crosshair },

  { id: "ACTION", label: "Ação", Icon: Gamepad2 },

  { id: "ADVENTURE", label: "Aventura", Icon: Gamepad2 },

  { id: "HORROR", label: "Terror", Icon: Zap },

  { id: "STRATEGY", label: "Estratégia", Icon: Trophy },

  { id: "FIGHTING", label: "Luta", Icon: Swords },

];

// eslint-disable-next-line react-refresh/only-export-components

export const SIDEBAR_CATEGORIES = CATEGORIES.filter(({ id }) =>

  SIDEBAR_NAVIGATION_ORDER.includes(id as (typeof SIDEBAR_NAVIGATION_ORDER)[number]),

).sort(

  (left, right) => SIDEBAR_NAVIGATION_ORDER.indexOf(left.id as (typeof SIDEBAR_NAVIGATION_ORDER)[number])

    - SIDEBAR_NAVIGATION_ORDER.indexOf(right.id as (typeof SIDEBAR_NAVIGATION_ORDER)[number]),

);

const COLLAPSIBLE_GROUP_KEYS = new Set(["platforms"]);

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

interface SidebarButtonProps {

  id: string;

  label: string;

  Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;

  AnimatedIcon?: AnimatedSidebarIcon;

  active: boolean;

  onClick: () => void;

  notificationCount?: number;

  reducedMotion?: boolean;

  rotateOnHover?: boolean;

  isExpanded?: boolean;

  nested?: boolean;

}

type AnimatedSidebarIcon = React.ForwardRefExoticComponent<

  AnimatedIconProps & React.RefAttributes<AnimatedIconHandle>

>;

const SidebarButton: React.FC<SidebarButtonProps> = ({

  id, label, Icon, AnimatedIcon, active, onClick,

  notificationCount = 0, reducedMotion = false,

  rotateOnHover = false, isExpanded = true, nested = false,

}) => {

  // Hover local: só este botão re-renderiza (sem thrash no layout da sidebar

  // inteira), então o glide nunca perde a medição no meio do voo.

  const [isHovered, setIsHovered] = useState(false);

  const hasNotifications = notificationCount > 0;

  const animatedIconRef = React.useRef<AnimatedIconHandle>(null);

  const animationTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => () => {

    if (animationTimerRef.current) clearTimeout(animationTimerRef.current);

  }, []);

  const playIconAnimation = () => {

    if (!AnimatedIcon || reducedMotion || animationTimerRef.current) return;

    animatedIconRef.current?.startAnimation();

    animationTimerRef.current = setTimeout(() => {

      animatedIconRef.current?.stopAnimation();

      animationTimerRef.current = null;

    }, 1300);

  };

  // Ícone inativo usa a paleta Orbloom (#6C6C6C -> branco no hover via classe);

  // o estado ativo mantém o accent do tema como indicador de seleção.

  const iconStyle = active

    ? {

        color: "rgb(var(--launcher-accent))",

        filter: "drop-shadow(0 0 10px rgb(var(--launcher-accent) / 0.7))",

        transition: "color 0.3s ease, filter 0.3s ease",

      }

    : { transition: "color 0.3s ease, filter 0.3s ease" };

  const inactiveIconClass = active ? "" : "text-[#6C6C6C] group-hover:text-white";

  const iconSizeClass = isExpanded

    ? (nested ? "h-4 w-4" : "h-6 w-6")

    : (nested ? "h-5 w-5" : "h-6 w-6");

  // Glide highlight estilo Vercel: pill compartilhado (layoutId global)

  // desliza entre botões; entrada com fade+scale. O hover estático

  // `hover:bg-white/[0.08]` fica como fallback garantido.

  const showGlide = Boolean(!reducedMotion && !active && isHovered);

  const glideRadius = isExpanded ? "rounded-2xl" : nested ? "rounded-xl" : "rounded-2xl";

  const buttonContent = (

    <motion.button

      onClick={onClick}

      onMouseEnter={() => {

        playIconAnimation();

        setIsHovered(true);

      }}

      onMouseLeave={() => setIsHovered(false)}

      onFocus={() => setIsHovered(true)}

      onBlur={() => setIsHovered(false)}

      aria-label={hasNotifications ? `${label}, ${notificationCount} notificações` : label}

      aria-current={active ? "page" : undefined}

      data-sidebar-item={id}

      whileTap={{ scale: 0.95 }}

      transition={{ type: "spring", bounce: 0.2, duration: 0.3 }}

      className={`relative group flex cursor-pointer items-center

        focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/50

        ${isExpanded

          ? `w-full ${nested ? "h-10 px-3 gap-3" : "h-12 px-4 gap-4"} rounded-2xl text-left`

          : (nested ? "h-10 w-10 justify-center rounded-xl" : "h-12 w-12 justify-center rounded-2xl")}`}

      style={{

        background: active ? "rgb(var(--launcher-accent) / 0.14)" : "transparent",

        boxShadow: active

          ? "0 4px 12px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15)"

          : "none",

      }}

    >

      {showGlide && (

        <motion.span

          aria-hidden

          layoutId="sidebar-glide"

          transition={{ type: "spring", bounce: 0.2, duration: 0.3 }}

          className={`absolute inset-0 ${glideRadius} bg-white/8 shadow-[inset_0_1px_0_rgba(255,255,255,0.09)]`}

        />

      )}

      <div

        className={`relative z-10 shrink-0

          ${rotateOnHover && !AnimatedIcon ? "group-hover:rotate-45" : ""}`}

      >

        {AnimatedIcon ? (

          <AnimatedIcon ref={animatedIconRef} size={isExpanded ? (nested ? 16 : 24) : (nested ? 20 : 24)} duration={1} className={`${iconSizeClass} ${inactiveIconClass}`} style={iconStyle} />

        ) : (

          <Icon className={`${iconSizeClass} ${inactiveIconClass}`} style={iconStyle} />

        )}

      </div>

      {isExpanded && (

        <div className="relative z-10 flex flex-1 items-center justify-between min-w-0">

          <span

            className={`truncate font-body tracking-[0.015em]

              ${nested ? "text-xs" : "text-sm"}

              ${active ? "font-semibold" : "text-[#6C6C6C] group-hover:text-white"}`}

            style={active ? { color: "rgb(var(--launcher-accent))", textShadow: "0 0 8px rgb(var(--launcher-accent) / 0.5)" } : undefined}

          >

            {label}

          </span>

          {hasNotifications && (

            <div className="relative flex items-center justify-center">

              <span

                className="flex h-5 min-w-5 items-center justify-center rounded-md border px-1.5 text-[10px] font-bold text-black shadow-[0_0_12px_rgb(var(--launcher-accent)/0.3)] backdrop-blur-md"

                style={{ background: "rgb(var(--launcher-accent))", borderColor: "rgb(var(--launcher-accent) / 0.4)" }}

              >

                {notificationCount > 99 ? "99+" : notificationCount}

              </span>

            </div>

          )}

        </div>

      )}

      {!isExpanded && hasNotifications && (

        <div

          className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full"

          style={{ background: "rgb(var(--launcher-accent))", boxShadow: "0 0 8px rgb(var(--launcher-accent) / 1)" }}

        />

      )}

    </motion.button>

  );

  if (!isExpanded) {

    return (

      <Tooltip>

        <TooltipTrigger asChild>

          <span className="inline-flex w-full justify-center">{buttonContent}</span>

        </TooltipTrigger>

        <TooltipContent side="right" align="center" sideOffset={16} className="border border-[#161616] bg-[#0F0F0F]/80 px-3 py-1.5 text-xs text-[#D2D2D2] tracking-wide backdrop-blur-2xl rounded-lg shadow-[0_10px_40px_rgba(0,0,0,0.5)]">

          {label}

        </TooltipContent>

      </Tooltip>

    );

  }

  return buttonContent;

};

const Sidebar: React.FC<SidebarProps> = ({

  activeCategory, onCategory, settingsLabel, playSound, notificationCount = 0, language = "pt-BR",

}) => {

  const prefersReducedMotion = useReducedMotion();

  const navRef = React.useRef<HTMLElement | null>(null);
  const revealFrameRef = React.useRef<number | null>(null);

  const ensureItemVisible = React.useCallback((id: string) => {
    const nav = navRef.current;
    if (!nav) return;

    const item = Array.from(nav.querySelectorAll<HTMLElement>("[data-sidebar-item]")).find(
      (element) => element.dataset.sidebarItem === id,
    );
    if (!item) return;

    const navRect = nav.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    const revealPadding = 12;
    const visibleTop = navRect.top + revealPadding;
    const visibleBottom = navRect.bottom - revealPadding;

    let targetTop = nav.scrollTop;
    if (itemRect.top < visibleTop) {
      targetTop -= visibleTop - itemRect.top;
    } else if (itemRect.bottom > visibleBottom) {
      targetTop += itemRect.bottom - visibleBottom;
    } else {
      return;
    }

    nav.scrollTo({
      top: Math.max(0, targetTop),
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  }, [prefersReducedMotion]);

  const scheduleItemReveal = React.useCallback((id: string) => {
    if (revealFrameRef.current !== null) {
      cancelAnimationFrame(revealFrameRef.current);
    }
    revealFrameRef.current = requestAnimationFrame(() => {
      revealFrameRef.current = requestAnimationFrame(() => {
        revealFrameRef.current = null;
        ensureItemVisible(id);
      });
    });
  }, [ensureItemVisible]);

  React.useEffect(() => () => {
    if (revealFrameRef.current !== null) {
      cancelAnimationFrame(revealFrameRef.current);
    }
  }, []);

  const [isExpanded, setIsExpanded] = useState<boolean>(() => {

    try { return localStorage.getItem("checkpoint_sidebar_expanded") !== "false"; }

    catch { return true; }

  });

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {

    try { return JSON.parse(localStorage.getItem("checkpoint_sidebar_groups") || '{"platforms": false}'); }

    catch { return { platforms: false }; }

  });

  React.useEffect(() => {
    scheduleItemReveal(activeCategory);
  }, [activeCategory, isExpanded, expandedGroups, scheduleItemReveal]);

  const toggleExpand = () => {

    const next = !isExpanded;

    setIsExpanded(next);

    try { localStorage.setItem("checkpoint_sidebar_expanded", String(next)); } catch { void 0; }

    playSound("navigate");

    window.dispatchEvent(new CustomEvent("checkpoint:sidebar-toggle", { detail: { expanded: next } }));

  };

  React.useEffect(() => {

    const handleForceToggle = (e: any) => {

      if (e.detail?.expanded !== undefined) {

        setIsExpanded(e.detail.expanded);

        try { localStorage.setItem("checkpoint_sidebar_expanded", String(e.detail.expanded)); } catch { void 0; }

      }

    };

    window.addEventListener("checkpoint:sidebar-toggle", handleForceToggle);

    return () => window.removeEventListener("checkpoint:sidebar-toggle", handleForceToggle);

  }, []);

  const toggleGroup = (key: string) => {

    const nav = navRef.current;
    const scrollTopBeforeToggle = nav?.scrollTop ?? 0;

    setExpandedGroups((prev: { [x: string]: any; }) => {

      const next = { ...prev, [key]: !prev[key] };

      try { localStorage.setItem("checkpoint_sidebar_groups", JSON.stringify(next)); } catch { void 0; }

      return next;

    });

    // Height animations can trigger browser scroll anchoring. Restore the user's
    // current offset after React commits the expanded/collapsed group.
    requestAnimationFrame(() => {
      if (!navRef.current) return;
      navRef.current.scrollTop = scrollTopBeforeToggle;
    });

    playSound("navigate");

  };

  useGamepadButton("L3", () => {

    toggleExpand();

  });

  const sidebarLabels: Record<string, string> = {

    ALL: { "pt-BR": "Todos os Jogos", "en-US": "All Games", "es-ES": "Todos los juegos", "fr-FR": "Tous les jeux", "de-DE": "Alle Spiele", "it-IT": "Tutti i giochi" }[language],

    FAVORITES: { "pt-BR": "Favoritos", "en-US": "Favorites", "es-ES": "Favoritos", "fr-FR": "Favoris", "de-DE": "Favoriten", "it-IT": "Preferiti" }[language],

    FRIENDS: { "pt-BR": "Amigos", "en-US": "Friends", "es-ES": "Amigos", "fr-FR": "Amis", "de-DE": "Freunde", "it-IT": "Amici" }[language],

    FEED: { "pt-BR": "Radar Gamer", "en-US": "Gaming Radar", "es-ES": "Radar Gamer", "fr-FR": "Radar Gamer", "de-DE": "Gaming Radar", "it-IT": "Radar Gamer" }[language],

    MODS: "Gerenciador de Mods",

    STEAM: "Steam", EPIC: "Epic Games",

    LOCAL: { "pt-BR": "Jogos Locais", "en-US": "Local Games", "es-ES": "Juegos Locales", "fr-FR": "Jeux Locaux", "de-DE": "Lokale Spiele", "it-IT": "Giochi Locali" }[language],

    PROFILE: { "pt-BR": "Perfil", "en-US": "Profile", "es-ES": "Perfil", "fr-FR": "Profil", "de-DE": "Profil", "it-IT": "Profilo" }[language],

  };

  const groupLabels: Record<string, string> = {

    filters: { "pt-BR": "MENU", "en-US": "MENU", "es-ES": "MENÚ", "fr-FR": "MENU", "de-DE": "MENÜ", "it-IT": "MENU" }[language],

    platforms: { "pt-BR": "PLATAFORMAS", "en-US": "PLATFORMS", "es-ES": "PLATAFORMAS", "fr-FR": "PLATEFORMES", "de-DE": "PLATTFORMEN", "it-IT": "PIATTAFORME" }[language],

    community: { "pt-BR": "SOCIAL", "en-US": "SOCIAL", "es-ES": "SOCIAL", "fr-FR": "SOCIAL", "de-DE": "SOZIAL", "it-IT": "SOCIAL" }[language],

    mods: { "pt-BR": "FERRAMENTAS", "en-US": "TOOLS", "es-ES": "HERRAMIENTAS", "fr-FR": "OUTILS", "de-DE": "WERKZEUGE", "it-IT": "STRUMENTI" }[language],

  };

  return (

    <motion.aside

      initial={{ x: -20, opacity: 0, width: 88 }}

      animate={{ x: 0, opacity: 1, width: isExpanded ? 280 : 88 }}

      transition={{ type: "spring", bounce: 0, duration: 0.4 }}

      // Generous Negative Space: Sidebar mais larga (280px)

      className="absolute left-4 top-4 bottom-4 z-40 flex flex-col pointer-events-none transform-gpu"

    >

      <div

        className="pointer-events-auto flex-1 flex flex-col py-6 px-4 min-h-0 rounded-4xl border-4 border-[#161616] bg-[#0F0F0F]/95"

      >

        <div

          onClick={toggleExpand}

          role="button"

          tabIndex={0}

          className={`relative mb-8 flex items-center cursor-pointer group p-1 transition-all duration-300 ${isExpanded ? "justify-start gap-4 px-1" : "justify-center"}`}

        >

          <div className="relative w-9.5 h-9.5 rounded-[14px] flex items-center justify-center bg-[#161616] shadow-[0_4px_16px_rgba(0,0,0,0.2)] group-hover:bg-[#1E1E1E] transition-all duration-300 shrink-0">

            <img src={PHERIELIUM_LOGO_PATH} alt="Pherielium" className="h-12.5 w-12.5 object-contain grayscale brightness-200 opacity-90 group-hover:opacity-100 transition-opacity" />

          </div>

          {isExpanded && (

            <div className="flex items-center min-w-0">

              <span className="font-display font-bold text-[25px] bg-linear-to-b from-[#FFFFFF] to-[#8A8A8A] bg-clip-text text-transparent tracking-tight flex items-start gap-0.5">

                Pherielium

                <span className="text-white/40 text-[15px] font-semibold translate-y-0.5">&reg;</span>

              </span>

            </div>

          )}

        </div>
        <nav

          ref={navRef}
          aria-label="Navegação principal"
          onFocusCapture={(event) => {
            const item = (event.target as HTMLElement).closest<HTMLElement>("[data-sidebar-item]");
            if (item?.dataset.sidebarItem) {
              scheduleItemReveal(item.dataset.sidebarItem);
            }
          }}
          className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto overscroll-contain no-scrollbar gap-6"
          style={{ overflowAnchor: "none" }}

        >

          {SIDEBAR_NAVIGATION_GROUPS.map((group, index) => {

            const isCollapsible = COLLAPSIBLE_GROUP_KEYS.has(group.key);

            const isOpen = !isCollapsible || Boolean(expandedGroups[group.key]);

            const items = group.ids

              .map((id) => SIDEBAR_CATEGORIES.find((item) => item.id === id))

              .filter((item): item is (typeof SIDEBAR_CATEGORIES)[number] => Boolean(item));

            const isGroupActive = items.some((item) => item.id === activeCategory);

            return (

              <React.Fragment key={group.key}>

                {index > 0 && (

                  <div className="w-full h-px my-1 shrink-0 bg-linear-to-r from-transparent via-[#6C6C6C]/30 to-transparent" />

                )}

                <div role="group" className="flex w-full flex-col gap-1.5">

                  {isExpanded ? (

                    isCollapsible ? (

                      <button

                        onClick={() => toggleGroup(group.key)}

                        onFocus={() => {

                          if (document.documentElement.dataset.gamepadNavigation === "active") {

                            setExpandedGroups((prev: any) => ({ ...prev, [group.key]: true }));

                          }

                        }}

                        className="flex items-center gap-3 px-2 w-full py-1.5 transition-colors duration-300 hover:bg-[#161616] rounded-lg group/folder cursor-pointer"

                        aria-expanded={isOpen}

                      >

                        <motion.span className="flex items-center justify-center shrink-0 text-[#6C6C6C] group-hover/folder:text-white transition-colors">

                          {isOpen ? <FolderOpen className="h-3.5 w-3.5" /> : <Folder className="h-3.5 w-3.5" />}

                        </motion.span>

                        <span className="text-[11px] font-semibold capitalize tracking-wide text-[#6C6C6C] font-body group-hover/folder:text-white transition-colors">

                          {groupLabels[group.key]}

                        </span>

                      </button>

                    ) : (

                      <span className="px-2 pb-1 text-[11px] font-semibold capitalize tracking-wide text-[#6C6C6C] font-body">

                        {groupLabels[group.key]}

                      </span>

                    )

                  ) : (

                    isCollapsible && (

                      <Tooltip>

                        <TooltipTrigger asChild>

                          <span className="inline-flex w-full justify-center">

                            <motion.button

                              type="button"

                              onClick={() => toggleGroup(group.key)}

                              onFocus={() => {

                                if (document.documentElement.dataset.gamepadNavigation === "active") {

                                  setExpandedGroups((prev: any) => ({ ...prev, [group.key]: true }));

                                }

                              }}

                              whileTap={{ scale: 0.95 }}

                              transition={{ type: "spring", bounce: 0.2, duration: 0.3 }}

                              aria-label={`${groupLabels[group.key]} (${isOpen ? "Aberta" : "Fechada"})`}

                              className={`relative group flex h-12 w-12 items-center justify-center rounded-[18px] cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/50 ${isGroupActive && !isOpen

                                ? "bg-[rgb(var(--launcher-accent)/0.14)] text-[rgb(var(--launcher-accent))] shadow-[0_4px_20px_rgba(0,0,0,0.4),inset_0_1px_0_rgb(var(--launcher-accent)/0.20)]"

                                : isOpen

                                  ? "bg-[#161616] text-white"

                                  : "text-[#6C6C6C] hover:text-white hover:bg-[#161616]"

                                }`}

                            >

                              {isOpen ? (

                                <FolderOpen className="h-6 w-6 text-[rgb(var(--launcher-accent))]" style={{ filter: "drop-shadow(0 0 10px rgb(var(--launcher-accent) / 0.7))" }} />

                              ) : (

                                <Folder className="h-6 w-6" style={isGroupActive ? { color: "rgb(var(--launcher-accent))", filter: "drop-shadow(0 0 10px rgb(var(--launcher-accent) / 0.7))" } : undefined} />

                              )}

                              {isGroupActive && !isOpen && (

                                <span

                                  className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full"

                                  style={{ background: "rgb(var(--launcher-accent))", boxShadow: "0 0 8px rgb(var(--launcher-accent))" }}

                                />

                              )}

                            </motion.button>

                          </span>

                        </TooltipTrigger>

                        <TooltipContent side="right" align="center" sideOffset={16} className="border border-[#161616] bg-[#0F0F0F]/90 px-3 py-1.5 text-xs text-[#D2D2D2] tracking-wide backdrop-blur-2xl rounded-lg shadow-[0_10px_40px_rgba(0,0,0,0.5)]">

                          {groupLabels[group.key]} {isOpen ? "(Aberta)" : "(Pasta)"}

                        </TooltipContent>

                      </Tooltip>

                    )

                  )}

                  <AnimatePresence initial={false}>

                    {isOpen && (

                      <motion.div

                        initial={isCollapsible ? { height: 0, opacity: 0 } : false}

                        animate={{ height: "auto", opacity: 1 }}

                        exit={{ height: 0, opacity: 0 }}

                        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}

                        className={`overflow-hidden ${isCollapsible

                          ? isExpanded

                            ? "relative pl-4"

                            : "relative flex flex-col items-center py-1.5 gap-1 rounded-2xl bg-[#0F0F0F] border border-[#161616] shadow-inner"

                          : ""

                          }`}

                      >

                        <div className="flex flex-col gap-1 w-full items-center">

                          {items.map((category, itemIndex) => {

                            const isLastItem = itemIndex === items.length - 1;

                            return (

                              <div

                                key={category.id}

                                className={`relative w-full ${isCollapsible && isExpanded

                                    ? `before:content-[''] before:absolute before:top-0 before:left-2 before:w-3 before:h-1/2 before:border-l before:border-b before:border-[#2A2A2A] before:rounded-bl-lg ${!isLastItem

                                       ? "after:content-[''] after:absolute after:top-1/2 after:left-2 after:bottom-0 after:w-px after:bg-[#2A2A2A]"

                                      : ""

                                    }`

                                    : ""

                                  }`}

                              >

                                <SidebarButton

                                  id={category.id}

                                  label={sidebarLabels[category.id] || category.label}

                                  Icon={category.Icon}

                                  AnimatedIcon={category.AnimatedIcon}

                                  active={activeCategory === category.id}

                                  onClick={() => { onCategory(category.id); playSound("showModal"); }}

                                  notificationCount={category.id === "FRIENDS" ? notificationCount : 0}

                                  reducedMotion={Boolean(prefersReducedMotion)}

                                  isExpanded={isExpanded}

                                  nested={isCollapsible}

                                />

                              </div>

                            );

                          })}

                        </div>

                      </motion.div>

                    )}

                  </AnimatePresence>

                </div>

              </React.Fragment>

            );

          })}

        </nav>
        <div className="w-full h-px mt-4 mb-4 shrink-0 bg-linear-to-r from-transparent via-[#6C6C6C]/30 to-transparent" />

        <div className="w-full flex flex-col gap-1 shrink-0">

          <SidebarButton

            id="SETTINGS"

            label={settingsLabel}

            Icon={Settings}

            AnimatedIcon={AnimatedSettingsIcon}

            active={activeCategory === "SETTINGS"}

            onClick={() => { onCategory("SETTINGS"); playSound("showModal"); }}

            reducedMotion={Boolean(prefersReducedMotion)}

            rotateOnHover

            isExpanded={isExpanded}

          />

        </div>

      </div>

    </motion.aside>

  );

};

export default Sidebar;