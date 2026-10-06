import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
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

export interface PlatformSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  activePlatform: string;
  onSelectPlatform: (platformId: string) => void;
  games: Game[];
  playSound?: (sound: SoundEffectType) => void;
  openedViaShortcut?: boolean;
}

export interface PlatformDefinition {
  id: string;
  label: string;
  badge: string;
  subtitle: string;
  image: string;
  icon: React.ReactNode;
}

export const PLATFORM_DEFINITIONS: PlatformDefinition[] = [
  {
    id: "ALL",
    label: "Todas as Plataformas",
    badge: "TODOS",
    subtitle: "Biblioteca completa unificada",
    image: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1200&q=80&auto=format&fit=crop",
    icon: <PlatformAllIcon className="w-full h-full text-white" />,
  },
  {
    id: "STEAM",
    label: "Steam",
    badge: "STEAM",
    subtitle: "Valve Corporation",
    image: "https://images.unsplash.com/photo-1612287270846-9d33b3a32f91?w=1200&q=80&auto=format&fit=crop",
    icon: <PlatformSteamIcon className="w-full h-full text-white" />,
  },
  {
    id: "EPIC",
    label: "Epic Games",
    badge: "EPIC",
    subtitle: "Epic Games Store",
    image: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1200&q=80&auto=format&fit=crop",
    icon: <PlatformEpicIcon className="w-full h-full text-white" />,
  },
  {
    id: "EA",
    label: "EA App",
    badge: "EA",
    subtitle: "Electronic Arts",
    image: "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=1200&q=80&auto=format&fit=crop",
    icon: <PlatformEaIcon className="w-full h-full text-white" />,
  },
  {
    id: "UBISOFT",
    label: "Ubisoft",
    badge: "UBISOFT",
    subtitle: "Ubisoft Connect",
    image: "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=1200&q=80&auto=format&fit=crop",
    icon: <PlatformUbisoftIcon className="w-full h-full text-white" />,
  },
  {
    id: "GOG",
    label: "GOG Galaxy",
    badge: "GOG",
    subtitle: "CD Projekt",
    image: "https://images.unsplash.com/photo-1551103782-8ab07afd45c1?w=1200&q=80&auto=format&fit=crop",
    icon: <PlatformGogIcon className="w-full h-full text-white" />,
  },
  {
    id: "XBOX",
    label: "Xbox",
    badge: "XBOX",
    subtitle: "Microsoft Gaming",
    image: "https://images.unsplash.com/photo-1605901309584-818e25960a8f?w=1200&q=80&auto=format&fit=crop",
    icon: <PlatformXboxIcon className="w-full h-full text-white" />,
  },
  {
    id: "RIOT",
    label: "Riot Games",
    badge: "RIOT",
    subtitle: "Riot Client",
    image: "https://images.unsplash.com/photo-1563089145-599997674d42?w=1200&q=80&auto=format&fit=crop",
    icon: <PlatformRiotIcon className="w-full h-full text-white" />,
  },
  {
    id: "BATTLENET",
    label: "Battle.net",
    badge: "BATTLE.NET",
    subtitle: "Blizzard Entertainment",
    image: "https://images.unsplash.com/photo-1579373903781-fd5c0c30c4cd?w=1200&q=80&auto=format&fit=crop",
    icon: <PlatformBattlenetIcon className="w-full h-full text-white" />,
  },
  {
    id: "ROCKSTAR",
    label: "Rockstar Games",
    badge: "ROCKSTAR",
    subtitle: "Rockstar Games Launcher",
    image: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1200&q=80&auto=format&fit=crop",
    icon: <PlatformRockstarIcon className="w-full h-full text-white" />,
  },
  {
    id: "LOCAL",
    label: "Jogos Locais",
    badge: "LOCAIS",
    subtitle: "Instalações e emuladores locais",
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
 * Floating brand showcase without enclosing boxes or card borders
 */
const FloatingPlatformShowcase: React.FC<{
  item: WheelCarouselItem;
}> = ({ item }) => {
  const definition = PLATFORM_DEFINITIONS.find((def) => def.id === item.id);
  const count = item.count ?? 0;
  const countText = count === 1 ? "1 jogo" : `${count} jogos`;
  const platformName = definition?.label || item.label;

  return (
    <div className="relative flex flex-col items-center justify-center select-none text-center">
      {/* Floating Logo (Much larger, no box/enclosure, subtle elegant ambient glow) */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`logo-${item.id}`}
          initial={{ opacity: 0, scale: 0.88, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.88, y: -8 }}
          transition={{ type: "spring", bounce: 0.2, duration: 0.35 }}
          className="relative flex items-center justify-center text-white"
        >
          {/* Subtle soft ambient back-glow behind the logo */}
          <div className="absolute inset-0 -z-10 rounded-full blur-2xl opacity-20 bg-white/20 scale-125 pointer-events-none" />

          {/* Logo icon itself */}
          <div className="w-28 h-28 md:w-32 md:h-32 flex items-center justify-center text-white drop-shadow-[0_12px_36px_rgba(255,255,255,0.25)] [&_svg]:w-full [&_svg]:h-full transition-transform">
            {item.icon}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Plataforma (ponto flutuante) quantidade de jogos */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`meta-${item.id}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ type: "spring", bounce: 0, duration: 0.25 }}
          className="mt-6 flex items-center justify-center gap-2.5 select-none"
        >
          <span className="font-semibold text-white tracking-tight font-display text-base">
            {platformName}
          </span>
          <span className="text-white/35 font-normal text-xs">•</span>
          <span className="text-white/60 font-medium text-sm">
            {countText}
          </span>
        </motion.div>
      </AnimatePresence>
    </div>
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
  const currentIndexRef = useRef(currentIndex);
  currentIndexRef.current = currentIndex;

  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIdx);
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

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 select-none overflow-hidden">
          {/* Blurred backdrop with dark vignette */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/65 backdrop-blur-2xl"
          />

          {/* Close button in top right corner */}
          <button
            type="button"
            onClick={() => {
              playSound?.("back");
              onClose();
            }}
            className="absolute top-6 right-8 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/50 backdrop-blur-xl transition-all hover:bg-white/15 hover:text-white active:scale-95 shadow-lg cursor-pointer"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Left-docked drawer sliding in from left to right */}
          <motion.div
            initial={{ x: -200, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -200, opacity: 0 }}
            transition={{ type: "spring", bounce: 0, duration: 0.4 }}
            onClick={(e) => e.stopPropagation()}
            className="absolute left-0 top-0 bottom-0 z-10 flex flex-col justify-center pl-8 md:pl-16 pr-8 w-full max-w-[1100px] pointer-events-auto h-screen"
          >
            {/* Header tag */}
            <div className="absolute top-8 left-8 md:left-16 z-20 flex items-center gap-2">
              <span className="text-xs font-bold tracking-widest text-white/40 uppercase font-display">
                Filtrar por Plataforma
              </span>
            </div>

            {/* Full-height sweeping Wheel Carousel */}
            <div className="w-full h-full flex items-center">
              <WheelCarousel
                items={items}
                activeIndex={currentIndex}
                onActiveChange={(_item, idx) => {
                  setCurrentIndex(idx);
                }}
                onItemSelect={(item) => handleConfirm(item)}
                renderCover={(item) => (
                  <FloatingPlatformShowcase item={item} />
                )}
                mode="dark"
                contentWidth={1080}
                photoWidth={28}
                minHeight="100%"
                visibleItems={10}
                spacing={8.5}
                apexInset={18}
                radius={750}
                markerGap={18}
                markerSize={8}
                edgeFadeSize={12}
                showItemIcons={false}
                showItemCounts={false}
                textColor="rgba(255, 255, 255, 0.45)"
                selectedColor="#FFFFFF"
                markerColor="#FFFFFF"
                className="w-full h-full bg-transparent"
              />
            </div>

            {/* Borderless hint text */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.3 }}
              className="absolute bottom-8 left-8 md:left-16 z-20 flex items-center gap-4 text-xs select-none font-normal"
            >
              {isGamepadConnected ? (
                <div className="flex items-center gap-5 text-white/70">
                  <div className="flex items-center gap-2">
                    <ControllerButtonGlyph button="DPAD" gamepadFamily={gamepadFamily} size={20} />
                    <span>Navegar</span>
                  </div>
                  <span className="text-white/20">•</span>
                  <div className="flex items-center gap-2 text-white/90">
                    <ControllerButtonGlyph button="A" gamepadFamily={gamepadFamily} size={20} />
                    <span className="font-semibold text-white">Confirmar</span>
                  </div>
                  <span className="text-white/20">•</span>
                  <div className="flex items-center gap-2 text-white/70">
                    <ControllerButtonGlyph button="B" gamepadFamily={gamepadFamily} size={20} />
                    <span>Fechar</span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2.5 text-white/45">
                  <span>Gire o scroll para navegar</span>
                  {!openedViaShortcut ? (
                    <>
                      <span className="text-white/20">•</span>
                      <span className="text-white/75 font-medium">Enter para confirmar</span>
                    </>
                  ) : (
                    <>
                      <span className="text-white/20">•</span>
                      <span className="text-white/75 font-medium">Solte Alt para confirmar</span>
                    </>
                  )}
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
