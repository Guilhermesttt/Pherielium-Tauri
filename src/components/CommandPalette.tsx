import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Gamepad2,
  Users,
  MessageSquare,
  Phone,
  Settings,
  Trophy,
  Activity,
  Layers,
  Sparkles,
  ExternalLink,
  Play,
  Star,
  X,
  Volume2,
  Shield,
  Palette,
  Laptop,
} from "lucide-react";
import type { Game, SocialFriend } from "../types/domain";

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  games: Game[];
  friends?: SocialFriend[];
  onSelectGame?: (game: Game) => void;
  onPlayGame?: (game: Game) => void;
  onNavigate?: (category: string) => void;
  onOpenSettingsTab?: (tab: string) => void;
  onStartCall?: (friend: SocialFriend) => void;
  onOpenChat?: (friend: SocialFriend) => void;
  playSound?: (type: any) => void;
}

interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  category: "Jogos" | "Navegação" | "Social" | "Ajustes";
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
  badge?: string;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  games,
  friends = [],
  onSelectGame,
  onPlayGame,
  onNavigate,
  onOpenSettingsTab,
  onStartCall,
  onOpenChat,
  playSound,
}) => {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const items = useMemo<CommandItem[]>(() => {
    const list: CommandItem[] = [];

    // 1. Navigation items
    list.push(
      {
        id: "nav-all",
        title: "Todos os Jogos",
        subtitle: "Ver biblioteca completa",
        category: "Navegação",
        icon: Gamepad2,
        action: () => onNavigate?.("ALL"),
      },
      {
        id: "nav-favorites",
        title: "Favoritos",
        subtitle: "Jogos marcados como preferidos",
        category: "Navegação",
        icon: Star,
        action: () => onNavigate?.("FAVORITES"),
      },
      {
        id: "nav-friends",
        title: "Amigos",
        subtitle: "Ver lista e status de amigos",
        category: "Navegação",
        icon: Users,
        action: () => onNavigate?.("FRIENDS"),
      },
      {
        id: "nav-trophies",
        title: "Troféus & Conquistas",
        subtitle: "Progresso, níveis e platinas",
        category: "Navegação",
        icon: Trophy,
        action: () => onNavigate?.("TROPHIES"),
      },
      {
        id: "nav-mods",
        title: "Gerenciador de Mods",
        subtitle: "Instalar e gerenciar mods",
        category: "Navegação",
        icon: Layers,
        action: () => onNavigate?.("MODS"),
      },
      {
        id: "nav-radar",
        title: "Radar Gamer",
        subtitle: "Notícias e lançamentos",
        category: "Navegação",
        icon: Activity,
        action: () => onNavigate?.("FEED"),
      },
      {
        id: "nav-settings",
        title: "Ajustes do Launcher",
        subtitle: "Configurações gerais e conexões",
        category: "Navegação",
        icon: Settings,
        action: () => onNavigate?.("SETTINGS"),
      },
    );

    // 2. Settings quick jumps
    list.push(
      {
        id: "set-audio",
        title: "Ajustes de Áudio & Som",
        subtitle: "Volumes de efeitos, música e temas sonoros",
        category: "Ajustes",
        icon: Volume2,
        action: () => {
          onNavigate?.("SETTINGS");
          onOpenSettingsTab?.("general");
        },
      },
      {
        id: "set-themes",
        title: "Personalização de Temas",
        subtitle: "Esquemas visuais e iluminação",
        category: "Ajustes",
        icon: Palette,
        action: () => {
          onNavigate?.("SETTINGS");
          onOpenSettingsTab?.("personalization");
        },
      },
      {
        id: "set-accounts",
        title: "Contas Conectadas",
        subtitle: "Steam, Epic Games e Discord",
        category: "Ajustes",
        icon: Shield,
        action: () => {
          onNavigate?.("SETTINGS");
          onOpenSettingsTab?.("connections");
        },
      },
    );

    // 3. Social friends
    friends.forEach((friend) => {
      list.push({
        id: `friend-chat-${friend.id}`,
        title: `Abrir chat com ${friend.name}`,
        subtitle: friend.playing ? `Jogando ${friend.playing}` : friend.status,
        category: "Social",
        icon: MessageSquare,
        badge: friend.status === "online" || friend.status === "playing" ? "Online" : undefined,
        action: () => onOpenChat?.(friend),
      });

      if (friend.status === "online" || friend.status === "playing") {
        list.push({
          id: `friend-call-${friend.id}`,
          title: `Iniciar chamada de voz com ${friend.name}`,
          subtitle: "Canal de voz direto",
          category: "Social",
          icon: Phone,
          action: () => onStartCall?.(friend),
        });
      }
    });

    // 4. Games
    games.forEach((game) => {
      list.push({
        id: `game-play-${game.id}`,
        title: `Jogar ${game.title}`,
        subtitle: `${game.launcherType || "Local"} · ${game.category || "Jogo"}`,
        category: "Jogos",
        icon: Play,
        badge: game.isFavorite ? "Favorito" : undefined,
        action: () => {
          onPlayGame ? onPlayGame(game) : onSelectGame?.(game);
        },
      });
    });

    return list;
  }, [games, friends, onNavigate, onOpenSettingsTab, onStartCall, onOpenChat, onPlayGame, onSelectGame]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 40);

    return items
      .filter((item) => {
        return (
          item.title.toLowerCase().includes(q) ||
          (item.subtitle && item.subtitle.toLowerCase().includes(q)) ||
          item.category.toLowerCase().includes(q)
        );
      })
      .slice(0, 30);
  }, [items, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const executeItem = useCallback(
    (item: CommandItem) => {
      playSound?.("select");
      item.action();
      onClose();
    },
    [playSound, onClose],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredItems.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
    } else if (e.key === "Enter" && filteredItems[selectedIndex]) {
      e.preventDefault();
      executeItem(filteredItems[selectedIndex]);
    }
  };

  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.querySelector<HTMLElement>(`[data-index="${selectedIndex}"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIndex]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[14vh] px-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="fixed inset-0 bg-black/75 backdrop-blur-md"
            onClick={onClose}
          />

          {/* Palette Shell */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -10 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="glass-panel relative z-10 w-full max-w-xl overflow-hidden rounded-[16px] border border-white/[0.12] shadow-[0_24px_70px_rgba(0,0,0,0.85)] flex flex-col"
          >
            {/* Search Input Bar */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.08] bg-white/[0.02]">
              <Search className="w-4 h-4 text-white/50 shrink-0 pointer-events-none" />
              <input
                ref={inputRef}
                id="command-palette-search"
                role="combobox"
                aria-expanded={filteredItems.length > 0}
                aria-autocomplete="list"
                aria-label="Buscar comandos, jogos ou amigos"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Digite um comando, jogo ou amigo... (↑↓ para navegar)"
                className="w-full bg-transparent text-sm font-body text-white placeholder:text-white/40 focus:outline-none"
              />
              <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded-[4px] border border-white/10 bg-white/[0.04] text-[10px] font-mono text-white/50">
                ESC
              </span>
            </div>

            {/* Results List */}
            <div ref={listRef} className="max-h-[380px] overflow-y-auto p-2 no-scrollbar flex flex-col gap-0.5">
              {filteredItems.length === 0 ? (
                <div className="py-12 text-center text-xs font-body text-white/50">
                  Nenhum comando ou jogo correspondente.
                </div>
              ) : (
                filteredItems.map((item, idx) => {
                  const isSelected = idx === selectedIndex;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      data-index={idx}
                      type="button"
                      onClick={() => executeItem(item)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-[8px] text-left transition-colors duration-100 cursor-pointer ${
                        isSelected ? "bg-white/[0.10] text-white" : "text-white/80 hover:bg-white/[0.05]"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-[6px] flex items-center justify-center shrink-0 ${
                            isSelected ? "bg-white text-black" : "bg-white/[0.06] text-white/70"
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white truncate">{item.title}</p>
                          {item.subtitle && (
                            <p className="text-[11px] text-white/50 truncate font-body">{item.subtitle}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {item.badge && (
                          <span className="px-2 py-0.5 rounded-full border border-white/15 bg-white/[0.05] text-[10px] font-medium text-white/80">
                            {item.badge}
                          </span>
                        )}
                        <span className="text-[10px] font-mono text-white/40 uppercase tracking-wider">
                          {item.category}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Palette Footer */}
            <div className="flex items-center justify-between px-4 py-2 border-t border-white/[0.06] bg-white/[0.01] text-[11px] text-white/40 font-body">
              <span>Pherielium Quick Launcher</span>
              <div className="flex items-center gap-3">
                <span>↵ Executar</span>
                <span>ESC Fechar</span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default CommandPalette;
