import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Info, Settings2, X } from "lucide-react";
import { faPlaystation } from "@fortawesome/free-brands-svg-icons";
import type { Game } from "../../types/domain";
import type { SoundEffectType } from "../../hooks/useSoundEffects";
import {
  WheelCarousel,
  type WheelCarouselItem,
} from "../ui/wheel-carousel";
import {
  PlatformAllIcon,
  PlatformSteamIcon,
  PlatformEpicIcon,
  PlatformEaIcon,
  PlatformUbisoftIcon,
  PlatformGogIcon,
  PlatformXboxIcon,
  PlatformRiotIcon,
  PlatformBattlenetIcon,
  PlatformRockstarIcon,
  PlatformLocalIcon,
} from "./PlatformIcons";
import {
  useGamepad,
  useGamepadButton,
  playHapticPattern,
} from "../../context/GamepadContext";
import { ControllerButtonGlyph } from "../ui/ControllerButtonGlyph";
import { LibraryFilterPanel } from "./LibraryFilterPanel";
import type { LibraryFilters } from "../LibraryFilterModal";

export interface PlatformSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  activePlatform: string;
  onSelectPlatform: (platformId: string) => void;
  games: Game[];
  playSound?: (sound: SoundEffectType) => void;
  openedViaShortcut?: boolean;
  /** Filtros da biblioteca (favoritos, conquistas, gêneros, ordem): vivem no mesmo painel da plataforma. */
  filters?: LibraryFilters;
  onFiltersChange?: (filters: LibraryFilters) => void;
}

export interface PlatformDefinition {
  id: string;
  label: string;
  badge: string;
  subtitle: string;
  /** frase curta que aparece abaixo do nome na vitrine */
  description: string;
  image: string;
  icon: React.ReactNode;
}

export const PLATFORM_DEFINITIONS: PlatformDefinition[] = [
  {
    id: "ALL",
    label: "Todas as Plataformas",
    badge: "TODOS",
    subtitle: "Biblioteca completa unificada",
    description: "Acesse todos os seus jogos de diferentes plataformas em um só lugar.",
    image: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1200&q=80&auto=format&fit=crop",
    icon: <PlatformAllIcon className="w-full h-full text-white" />,
  },
  {
    id: "STEAM",
    label: "Steam",
    badge: "STEAM",
    subtitle: "Valve Corporation",
    description: "A biblioteca da Valve com conquistas e tempo de jogo sincronizados.",
    image: "https://images.unsplash.com/photo-1612287270846-9d33b3a32f91?w=1200&q=80&auto=format&fit=crop",
    icon: <PlatformSteamIcon className="w-full h-full text-white" />,
  },
  {
    id: "EPIC",
    label: "Epic Games",
    badge: "EPIC",
    subtitle: "Epic Games Store",
    description: "Seus jogos da Epic Games Store, incluindo os resgatados de graça.",
    image: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1200&q=80&auto=format&fit=crop",
    icon: <PlatformEpicIcon className="w-full h-full text-white" />,
  },
  {
    id: "EA",
    label: "EA App",
    badge: "EA",
    subtitle: "Electronic Arts",
    description: "Os jogos da Electronic Arts instalados pelo EA App.",
    image: "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=1200&q=80&auto=format&fit=crop",
    icon: <PlatformEaIcon className="w-full h-full text-white" />,
  },
  {
    id: "UBISOFT",
    label: "Ubisoft",
    badge: "UBISOFT",
    subtitle: "Ubisoft Connect",
    description: "Sua biblioteca da Ubisoft Connect, lado a lado com o resto.",
    image: "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=1200&q=80&auto=format&fit=crop",
    icon: <PlatformUbisoftIcon className="w-full h-full text-white" />,
  },
  {
    id: "GOG",
    label: "GOG Galaxy",
    badge: "GOG",
    subtitle: "CD Projekt",
    description: "Jogos sem DRM da GOG Galaxy, direto na sua coleção.",
    image: "https://images.unsplash.com/photo-1551103782-8ab07afd45c1?w=1200&q=80&auto=format&fit=crop",
    icon: <PlatformGogIcon className="w-full h-full text-white" />,
  },
  {
    id: "XBOX",
    label: "Xbox",
    badge: "XBOX",
    subtitle: "Microsoft Gaming",
    description: "Os jogos da Microsoft Store e do Xbox Game Pass no PC.",
    image: "https://images.unsplash.com/photo-1605901309584-818e25960a8f?w=1200&q=80&auto=format&fit=crop",
    icon: <PlatformXboxIcon className="w-full h-full text-white" />,
  },
  {
    id: "RIOT",
    label: "Riot Games",
    badge: "RIOT",
    subtitle: "Riot Client",
    description: "VALORANT, League of Legends e outros jogos do Riot Client.",
    image: "https://images.unsplash.com/photo-1563089145-599997674d42?w=1200&q=80&auto=format&fit=crop",
    icon: <PlatformRiotIcon className="w-full h-full text-white" />,
  },
  {
    id: "BATTLENET",
    label: "Battle.net",
    badge: "BATTLE.NET",
    subtitle: "Blizzard Entertainment",
    description: "Os clássicos e lançamentos da Blizzard no Battle.net.",
    image: "https://images.unsplash.com/photo-1579373903781-fd5c0c30c4cd?w=1200&q=80&auto=format&fit=crop",
    icon: <PlatformBattlenetIcon className="w-full h-full text-white" />,
  },
  {
    id: "ROCKSTAR",
    label: "Rockstar Games",
    badge: "ROCKSTAR",
    subtitle: "Rockstar Games Launcher",
    description: "GTA, Red Dead e os demais jogos do Rockstar Games Launcher.",
    image: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1200&q=80&auto=format&fit=crop",
    icon: <PlatformRockstarIcon className="w-full h-full text-white" />,
  },
  {
    id: "LOCAL",
    label: "Jogos Locais",
    badge: "LOCAIS",
    subtitle: "Instalações e emuladores locais",
    description: "Instalações avulsas e emuladores que você adicionou à mão.",
    image: "https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=1200&q=80&auto=format&fit=crop",
    icon: <PlatformLocalIcon className="w-full h-full text-white" />,
  },
];

export const countGamesForPlatform = (platformId: string, gamesList: Game[]): number => {
  switch (platformId) {
    case "ALL":
      return gamesList.length;
    case "STEAM":
      return gamesList.filter((g) => g.launcherType === "steam").length;
    case "EPIC":
      return gamesList.filter((g) => g.launcherType === "epic").length;
    case "EA":
      return gamesList.filter((g) => g.launcherType === "ea").length;
    case "UBISOFT":
      return gamesList.filter((g) => g.launcherType === "ubisoft").length;
    case "GOG":
      return gamesList.filter((g) => g.launcherType === "gog").length;
    case "XBOX":
      return gamesList.filter((g) => g.launcherType === "xbox").length;
    case "RIOT":
      return gamesList.filter((g) => g.launcherType === "riot").length;
    case "BATTLENET":
      return gamesList.filter((g) => g.launcherType === "battlenet").length;
    case "ROCKSTAR":
      return gamesList.filter((g) => g.launcherType === "rockstar").length;
    case "LOCAL":
      return gamesList.filter((g) => g.launcherType === "local" || !g.launcherType).length;
    default:
      return 0;
  }
};

/**
 * Ícone da plataforma com o anel orbital: uma elipse inclinada que passa por trás do ícone (metade
 * de cima) e pela frente (metade de baixo), na cor de destaque do tema.
 */
const PlatformOrbitIcon: React.FC<{ icon: React.ReactNode; size: number; className?: string }> = ({ icon, size, className }) => {
  const gradientId = React.useId();
  const w = size;
  const h = size * 0.82;
  const cx = w / 2;
  const cy = h / 2;
  const rx = w * 0.5;
  const ry = w * 0.17;
  return (
    <div className={`relative shrink-0 ${className ?? ""}`} style={{ width: w, height: h }}>
      <svg className="pointer-events-none absolute inset-0 overflow-visible" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" style={{ stopColor: "rgb(var(--launcher-accent))" }} />
            <stop offset="0.55" style={{ stopColor: "rgb(var(--launcher-accent-ring))" }} />
            <stop offset="1" style={{ stopColor: "rgb(var(--launcher-accent))", stopOpacity: 0.9 }} />
          </linearGradient>
          <clipPath id={`${gradientId}-back`}><rect x={cx - rx - 8} y={cy - ry - 8} width={rx * 2 + 16} height={ry + 8} /></clipPath>
        </defs>
        <g transform={`rotate(-24 ${cx} ${cy})`} style={{ filter: "drop-shadow(0 0 6px rgb(var(--launcher-accent) / 0.7))" }}>
          <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke={`url(#${gradientId})`} strokeWidth={Math.max(2.5, size * 0.045)} strokeOpacity="0.8" clipPath={`url(#${gradientId}-back)`} />
        </g>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center p-[17%] text-white [&_svg]:h-full [&_svg]:w-full">{icon}</div>
      <svg className="pointer-events-none absolute inset-0 overflow-visible" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
        <g transform={`rotate(-24 ${cx} ${cy})`} style={{ filter: "drop-shadow(0 0 6px rgb(var(--launcher-accent) / 0.8))" }}>
          <path
            d={`M ${cx - rx} ${cy} A ${rx} ${ry} 0 0 0 ${cx + rx} ${cy}`}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={Math.max(3, size * 0.06)}
            strokeLinecap="round"
          />
        </g>
      </svg>
    </div>
  );
};

/** Compacto à esquerda da roda: ícone com anel orbital, nome da plataforma e quantidade de jogos. */
const FloatingPlatformShowcase: React.FC<{
  item: WheelCarouselItem;
}> = ({ item }) => {
  const definition = PLATFORM_DEFINITIONS.find((def) => def.id === item.id);
  const count = item.count ?? 0;
  const countText = count === 1 ? "1 jogo" : `${count} jogos`;
  const platformName = definition?.label || item.label;

  return (
    <div className="relative flex flex-col items-center justify-center select-none text-center">
      <AnimatePresence mode="wait">
        <motion.div
          key={`logo-${item.id}`}
          initial={{ opacity: 0, scale: 0.9, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: -8 }}
          transition={{ type: "spring", bounce: 0.15, duration: 0.35 }}
        >
          <PlatformOrbitIcon icon={item.icon} size={132} />
        </motion.div>
      </AnimatePresence>

      <AnimatePresence mode="wait">
        <motion.div
          key={`meta-${item.id}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ type: "spring", bounce: 0, duration: 0.25 }}
          className="mt-5 flex items-center justify-center gap-2.5 whitespace-nowrap select-none"
        >
          <span className="text-[13px] font-semibold text-white tracking-tight">{platformName}</span>
          <span className="text-[var(--ink-faint)] text-xs">•</span>
          <span className="text-[13px] text-[var(--ink-muted)]">{countText}</span>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

/** Faixa de logos das plataformas principais: PlayStation, Xbox, Steam, Epic, EA, Ubisoft e "mais". */
const PlatformLogoStrip: React.FC = () => {
  const rawPath = faPlaystation.icon[4];
  const pathData = Array.isArray(rawPath) ? rawPath.join(" ") : rawPath;
  const logos: Array<{ key: string; node: React.ReactNode }> = [
    {
      key: "ps",
      node: (
        <svg viewBox={`0 0 ${faPlaystation.icon[0]} ${faPlaystation.icon[1]}`} fill="currentColor" aria-hidden="true">
          <path d={pathData} />
        </svg>
      ),
    },
    ...["XBOX", "STEAM", "EPIC", "EA", "UBISOFT"].map((id) => ({
      key: id,
      node: PLATFORM_DEFINITIONS.find((def) => def.id === id)?.icon,
    })),
  ];
  return (
    <div className="flex items-center rounded-full border border-white/[0.12] bg-black/35 p-px backdrop-blur-md">
      {logos.map((logo) => (
        <span
          key={logo.key}
          className="-ml-px flex h-[64px] w-[64px] items-center justify-center rounded-full border border-white/[0.1] bg-white/[0.03] p-[19px] text-white first:ml-0 [&_svg]:h-full [&_svg]:w-full"
        >
          {logo.node}
        </span>
      ))}
      <span className="-ml-px flex h-[64px] w-[64px] items-center justify-center gap-[3px] rounded-full border border-white/[0.1] bg-white/[0.03]" aria-label="e outras">
        {[0, 1, 2].map((dot) => (
          <span key={dot} className="h-[4px] w-[4px] rounded-full bg-white" />
        ))}
      </span>
    </div>
  );
};

/** Vitrine grande à direita: ícone orbital, nome, descrição e a faixa de logos (ou a contagem da plataforma). */
const PlatformHero: React.FC<{ item: WheelCarouselItem }> = ({ item }) => {
  const definition = PLATFORM_DEFINITIONS.find((def) => def.id === item.id);
  const count = item.count ?? 0;
  const countText = count === 1 ? "1 jogo" : `${count} jogos`;
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={item.id}
        initial={{ opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.98 }}
        transition={{ type: "spring", bounce: 0, duration: 0.4 }}
        className="relative flex max-w-[520px] flex-col items-center text-center"
      >
        {/* órbitas finas atrás do ícone */}
        <span aria-hidden="true" className="pointer-events-none absolute left-1/2 top-[88px] h-[170px] w-[580px] -translate-x-1/2 -translate-y-1/2 -rotate-[8deg] rounded-[50%] border border-white/[0.07]" />
        <span aria-hidden="true" className="pointer-events-none absolute left-1/2 top-[88px] h-[128px] w-[440px] -translate-x-1/2 -translate-y-1/2 -rotate-[8deg] rounded-[50%] border border-white/[0.05]" />
        <PlatformOrbitIcon icon={item.icon} size={200} />
        <h2 className="mt-9 font-display text-[34px] font-bold leading-tight tracking-tight text-white">{definition?.label ?? item.label}</h2>
        <p className="mt-3 max-w-[470px] text-[18px] leading-snug text-[var(--ink-muted)]">{definition?.description ?? item.subtitle}</p>
        <div className="mt-9">
          {item.id === "ALL" ? (
            <PlatformLogoStrip />
          ) : (
            <div className="flex items-center gap-3 rounded-full border border-white/[0.12] bg-black/35 py-2 pl-2 pr-6 backdrop-blur-md">
              <span className="flex h-[52px] w-[52px] items-center justify-center rounded-full border border-white/[0.1] bg-white/[0.03] p-[15px] text-white [&_svg]:h-full [&_svg]:w-full">{item.icon}</span>
              <span className="text-[15px] font-semibold text-white">{countText}</span>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export const PlatformSelectorModal: React.FC<PlatformSelectorModalProps> = ({
  isOpen,
  onClose,
  activePlatform,
  onSelectPlatform,
  games,
  playSound,
  openedViaShortcut = false,
  filters,
  onFiltersChange,
}) => {
  const items: WheelCarouselItem[] = useMemo(() => {
    return PLATFORM_DEFINITIONS.map((def) => {
      const count = countGamesForPlatform(def.id, games);
      return {
        id: def.id,
        label: def.label,
        subtitle: def.subtitle,
        image: def.image,
        icon: def.icon,
        count,
      };
    });
  }, [games]);

  const initialIdx = useMemo(() => {
    const foundIndex = items.findIndex((it) => it.id === activePlatform);
    return foundIndex >= 0 ? foundIndex : 0;
  }, [activePlatform, items]);

  const [currentIndex, setCurrentIndex] = useState(initialIdx);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const currentIndexRef = useRef(currentIndex);
  currentIndexRef.current = currentIndex;

  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIdx);
      setFiltersOpen(false);
    }
  }, [isOpen, initialIdx]);

  const handleConfirm = useCallback((itemToSelect?: WheelCarouselItem) => {
    const target = itemToSelect || items[currentIndexRef.current] || items[0];
    if (target?.id) {
      playSound?.("select");
      onSelectPlatform(target.id);
      onClose();
    }
  }, [items, onSelectPlatform, onClose, playSound]);

  const { gamepadFamily, isGamepadConnected } = useGamepad();

  // Controller Navigation with priority 250 (captures input over home page)
  useGamepadButton(
    "DPAD_UP",
    () => {
      if (!isOpen) return;
      playSound?.("navigate");
      playHapticPattern("nav");
      setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
    },
    isOpen,
    250,
  );

  useGamepadButton(
    "DPAD_DOWN",
    () => {
      if (!isOpen) return;
      playSound?.("navigate");
      playHapticPattern("nav");
      setCurrentIndex((prev) => (prev + 1) % items.length);
    },
    isOpen,
    250,
  );

  useGamepadButton(
    "DPAD_LEFT",
    () => {
      if (!isOpen) return;
      playSound?.("navigate");
      playHapticPattern("nav");
      setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
    },
    isOpen,
    250,
  );

  useGamepadButton(
    "DPAD_RIGHT",
    () => {
      if (!isOpen) return;
      playSound?.("navigate");
      playHapticPattern("nav");
      setCurrentIndex((prev) => (prev + 1) % items.length);
    },
    isOpen,
    250,
  );

  useGamepadButton(
    "X",
    () => {
      if (!isOpen) return;
      playHapticPattern("action");
      handleConfirm();
    },
    isOpen,
    250,
  );

  useGamepadButton(
    "O",
    () => {
      if (!isOpen) return;
      playSound?.("back");
      playHapticPattern("nav");
      onClose();
    },
    isOpen,
    250,
  );

  useGamepadButton(
    "L2",
    () => {
      if (!isOpen) return;
      playSound?.("back");
      playHapticPattern("nav");
      onClose();
    },
    isOpen,
    250,
  );

  // Handle Alt key release to confirm when opened via shortcut, Esc to cancel, Arrows to navigate
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyUp = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Alt") {
        e.preventDefault();
        handleConfirm();
      }
    };

    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        playSound?.("back");
        onClose();
      } else if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        playSound?.("navigate");
        playHapticPattern("nav");
        setCurrentIndex((prev) => (prev + 1) % items.length);
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        playSound?.("navigate");
        playHapticPattern("nav");
        setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        playHapticPattern("action");
        handleConfirm();
      }
    };

    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, handleConfirm, onClose, playSound, items.length]);

  // Robust wheel listener: captures all scroll ticks on window, stops bleed-through to game cards, and steps smoothly
  const wheelTimeRef = useRef(0);

  useEffect(() => {
    if (!isOpen) return;

    const handleWheel = (e: WheelEvent) => {
      if ((e.target as Element | null)?.closest?.("[data-filter-panel]")) return;
      e.preventDefault();
      e.stopPropagation();

      const delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (Math.abs(delta) < 8) return;

      const now = performance.now();
      if (now - wheelTimeRef.current < 75) return;
      wheelTimeRef.current = now;

      const step = delta > 0 ? 1 : -1;
      setCurrentIndex((prev) => {
        const next = (prev + step + items.length) % items.length;
        playSound?.("navigate");
        playHapticPattern("nav");
        return next;
      });
    };

    window.addEventListener("wheel", handleWheel, { capture: true, passive: false });
    return () => {
      window.removeEventListener("wheel", handleWheel, { capture: true });
    };
  }, [isOpen, items.length, playSound]);

  const selectedItem = items[currentIndex] ?? items[0];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 select-none overflow-hidden">
          {/* Fundo: preto com luz do tema (manchas e o arco de luz no canto) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={onClose}
            className="platform-ambient absolute inset-0"
          >
            <div className="platform-arc" aria-hidden="true" />
          </motion.div>

          {/* Fechar */}
          <button
            type="button"
            onClick={() => {
              playSound?.("back");
              onClose();
            }}
            className="absolute right-11 top-[22px] z-20 flex h-[38px] w-[38px] items-center justify-center rounded-full bg-white/[0.08] text-[var(--ink-muted)] backdrop-blur-xl transition-[background-color,color,transform] duration-[180ms] ease-[var(--ease-out-strong)] hover:bg-white/15 hover:text-white active:scale-[0.97] active:duration-75 cursor-pointer"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Vitrine grande da plataforma selecionada */}
          {selectedItem && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: filtersOpen ? 0.2 : 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="pointer-events-none absolute inset-y-0 right-0 z-[5] hidden items-center justify-center min-[1500px]:flex"
              style={{ left: 812 }}
            >
              <PlatformHero item={selectedItem} />
            </motion.div>
          )}

          {/* Filtros: abrem por cima, no lado direito, a partir do botão "Filtros" */}
          {filters && onFiltersChange && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  playSound?.("select");
                  setFiltersOpen((open) => !open);
                }}
                aria-pressed={filtersOpen}
                className="absolute bottom-9 right-11 z-20 flex h-10 cursor-pointer items-center gap-2 rounded-full border border-white/[0.12] bg-black/40 px-4 text-[13px] font-medium text-[var(--ink)] backdrop-blur-md transition-[background-color,transform] duration-[180ms] ease-[var(--ease-out-strong)] hover:bg-white/10 active:scale-[0.97] active:duration-75"
              >
                <Settings2 className="h-4 w-4" />
                Filtros
              </button>
              <AnimatePresence>
                {filtersOpen && (
                  <motion.div
                    initial={{ x: 80, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 80, opacity: 0 }}
                    transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                    onClick={(e) => e.stopPropagation()}
                    className="absolute right-11 top-1/2 z-20 -translate-y-1/2 pointer-events-auto"
                  >
                    <LibraryFilterPanel games={games} filters={filters} onChange={onFiltersChange} playSound={playSound} />
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}

          {/* Roda à esquerda */}
          <motion.div
            initial={{ x: -200, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -200, opacity: 0 }}
            transition={{ type: "spring", bounce: 0, duration: 0.4 }}
            onClick={(e) => e.stopPropagation()}
            className="absolute left-0 top-0 bottom-0 z-10 flex h-screen w-full max-w-[900px] flex-col justify-center pl-[52px] pointer-events-auto"
          >
            <div className="absolute left-[52px] top-9 z-20">
              <span className="text-sm font-normal text-[var(--ink-muted)]">Plataforma e filtros</span>
            </div>

            <div className="flex h-full w-[760px] items-center">
              <WheelCarousel
                items={items}
                activeIndex={currentIndex}
                onActiveChange={(_item, idx) => {
                  setCurrentIndex(idx);
                }}
                onItemSelect={(item) => handleConfirm(item)}
                renderCover={(item) => <FloatingPlatformShowcase item={item} />}
                mode="dark"
                contentWidth={760}
                photoWidth={32}
                minHeight="100%"
                visibleItems={6}
                spacing={9.2}
                apexInset={12.5}
                radius={640}
                rotateFactor={0.6}
                unselectedPadding={76}
                unselectedScale={0.86}
                scaleFalloff={0.015}
                showMarker={false}
                selectedPill
                edgeFadeSize={17}
                showItemIcons={false}
                showItemCounts={false}
                textColor="rgba(255, 255, 255, 0.45)"
                selectedColor="#FFFFFF"
                className="w-full h-full bg-transparent"
              />
            </div>

            {/* Dica de uso */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.3 }}
              className="absolute bottom-9 left-[52px] z-20 flex items-center gap-3 text-xs select-none font-normal"
            >
              {isGamepadConnected ? (
                <div className="flex items-center gap-5 text-[var(--ink-muted)]">
                  <div className="flex items-center gap-2">
                    <ControllerButtonGlyph button="DPAD" gamepadFamily={gamepadFamily} size={20} />
                    <span>Navegar</span>
                  </div>
                  <span className="text-[var(--ink-faint)]">•</span>
                  <div className="flex items-center gap-2 text-[var(--ink)]">
                    <ControllerButtonGlyph button="A" gamepadFamily={gamepadFamily} size={20} />
                    <span className="font-semibold text-white">Confirmar</span>
                  </div>
                  <span className="text-[var(--ink-faint)]">•</span>
                  <div className="flex items-center gap-2 text-[var(--ink-muted)]">
                    <ControllerButtonGlyph button="B" gamepadFamily={gamepadFamily} size={20} />
                    <span>Fechar</span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2.5 text-[var(--ink-muted)]">
                  <Info className="h-[18px] w-[18px] text-[var(--ink-faint)]" />
                  <span>Gire o scroll para trocar de plataforma</span>
                  <span className="text-[var(--ink-faint)]">•</span>
                  <span>{openedViaShortcut ? "Solte Alt para confirmar" : "Enter para confirmar"}</span>
                </div>
              )}
            </motion.div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default PlatformSelectorModal;
