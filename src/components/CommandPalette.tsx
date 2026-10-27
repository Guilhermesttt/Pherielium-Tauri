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
  Play,
  Star,
  Volume2,
  Shield,
  Palette,
  RotateCcw,
  KeyRound,
} from "lucide-react";
import type { Game, SocialFriend } from "../types/domain";
import {
  PALETTE_CHIPS,
  chipCounts,
  formatResumeAge,
  parseRecents,
  pickResumeGame,
  pushRecent,
  searchItems,
  type PaletteChip,
  type PaletteKind,
} from "./commandPaletteLogic";
import { modalBackdropMotion, modalMotion } from "../design-system/motion";
import { useModalSounds } from "../hooks/useModalSounds";

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
  kind: PaletteKind;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
  badge?: string;
}

interface Row {
  item: CommandItem;
  /** Título da seção quando esta linha abre uma nova (só sem busca). */
  section?: string;
}

const KIND_LABEL: Record<PaletteKind, string> = {
  game: "Jogo",
  person: "Pessoa",
  mod: "Mods",
  action: "Ação",
};

const RECENTS_KEY = "pherielium_palette_recents";

const readRecents = (): string[] => {
  try {
    return parseRecents(JSON.parse(localStorage.getItem(RECENTS_KEY) || "[]"));
  } catch {
    return [];
  }
};

const writeRecents = (ids: string[]) => {
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(ids));
  } catch (error) {
    console.warn("[Paleta] Não foi possível salvar os recentes.", error);
  }
};

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
  useModalSounds(isOpen);
  const [query, setQuery] = useState("");
  const [chip, setChip] = useState<PaletteChip>("all");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentIds, setRecentIds] = useState<string[]>(readRecents);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setChip("all");
      setSelectedIndex(0);
      setRecentIds(readRecents());
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const playGame = useCallback(
    (game: Game) => {
      if (onPlayGame) onPlayGame(game);
      else onSelectGame?.(game);
    },
    [onPlayGame, onSelectGame],
  );

  const resumeGame = useMemo(() => pickResumeGame(games), [games]);

  const items = useMemo<CommandItem[]>(() => {
    const list: CommandItem[] = [];

    if (resumeGame) {
      const age = formatResumeAge(resumeGame.lastPlayedAt);
      list.push({
        id: "resume",
        title: `Retomar ${resumeGame.title}`,
        subtitle: age ? `Última sessão ${age}` : "Continuar de onde parou",
        kind: "game",
        icon: RotateCcw,
        badge: "Ctrl ↵",
        action: () => playGame(resumeGame),
      });
    }

    // Ações: ir para uma tela
    list.push(
      { id: "nav-all", title: "Todos os Jogos", subtitle: "Ver biblioteca completa", kind: "action", icon: Gamepad2, action: () => onNavigate?.("ALL") },
      { id: "nav-favorites", title: "Favoritos", subtitle: "Jogos marcados como preferidos", kind: "action", icon: Star, action: () => onNavigate?.("FAVORITES") },
      { id: "nav-friends", title: "Amigos", subtitle: "Ver lista e status de amigos", kind: "action", icon: Users, action: () => onNavigate?.("FRIENDS") },
      { id: "nav-trophies", title: "Troféus & Conquistas", subtitle: "Progresso, níveis e platinas", kind: "action", icon: Trophy, action: () => onNavigate?.("TROPHIES") },
      { id: "nav-radar", title: "Radar Gamer", subtitle: "Notícias e lançamentos", kind: "action", icon: Activity, action: () => onNavigate?.("FEED") },
      { id: "nav-settings", title: "Ajustes do Launcher", subtitle: "Configurações gerais e conexões", kind: "action", icon: Settings, action: () => onNavigate?.("SETTINGS") },
    );

    list.push({
      id: "game-night",
      title: "Noite de jogo",
      subtitle: "Escolher um jogo, convidar amigos e abrir uma sala de voz",
      kind: "action",
      icon: Users,
      action: () => {
        window.dispatchEvent(new CustomEvent("pherielium:open-game-night"));
      },
    });

    list.push({
      id: "home-layout",
      title: "Alternar layout da Home",
      subtitle: "Trocar entre a Home minimalista (jogo em foco + grade) e a clássica",
      kind: "action",
      icon: Settings,
      action: () => {
        window.dispatchEvent(new CustomEvent("pherielium:toggle-home-layout"));
      },
    });

    // Mods
    list.push(
      { id: "nav-mods", title: "Gerenciador de Mods", subtitle: "Instalar e gerenciar mods", kind: "mod", icon: Layers, action: () => onNavigate?.("MODS") },
      { id: "mods-nexus", title: "Chave da Nexus Mods", subtitle: "Conectar a conta para baixar mods", kind: "mod", icon: KeyRound, action: () => onNavigate?.("MODS") },
    );

    // Ajustes
    list.push(
      {
        id: "set-audio",
        title: "Ajustes de Áudio & Som",
        subtitle: "Volumes de efeitos, música e temas sonoros",
        kind: "action",
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
        kind: "action",
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
        kind: "action",
        icon: Shield,
        action: () => {
          onNavigate?.("SETTINGS");
          onOpenSettingsTab?.("connections");
        },
      },
      {
        id: "tour-welcome",
        title: "Guia de Boas-Vindas",
        subtitle: "Apresentação e tour pelo ecossistema Pherielium",
        kind: "action",
        icon: Sparkles,
        action: () => {
          window.dispatchEvent(new CustomEvent("phelierium:open-welcome-modal"));
        },
      },
    );

    // Pessoas
    friends.forEach((friend) => {
      const online = friend.status === "online" || friend.status === "playing";
      list.push({
        id: `friend-chat-${friend.id}`,
        title: `Abrir chat com ${friend.name}`,
        subtitle: friend.playing ? `Jogando ${friend.playing}` : friend.status,
        kind: "person",
        icon: MessageSquare,
        badge: online ? "Online" : undefined,
        action: () => onOpenChat?.(friend),
      });

      if (online) {
        list.push({
          id: `friend-call-${friend.id}`,
          title: `Ligar para ${friend.name}`,
          subtitle: "Canal de voz direto",
          kind: "person",
          icon: Phone,
          action: () => onStartCall?.(friend),
        });
      }
    });

    // Jogos
    games.forEach((game) => {
      list.push({
        id: `game-play-${game.id}`,
        title: `Jogar ${game.title}`,
        subtitle: `${game.launcherType || "Local"} · ${game.category || "Jogo"}`,
        kind: "game",
        icon: Play,
        badge: game.isFavorite ? "Favorito" : undefined,
        action: () => playGame(game),
      });
    });

    return list;
  }, [games, friends, resumeGame, playGame, onNavigate, onOpenSettingsTab, onStartCall, onOpenChat]);

  const counts = useMemo(() => chipCounts(items, query), [items, query]);

  const rows = useMemo<Row[]>(() => {
    const trimmed = query.trim();
    if (trimmed) return searchItems(items, trimmed, chip).map((item) => ({ item }));

    // Sem busca: Retomar e Recentes primeiro, depois o resto do chip
    const inChip = searchItems(items, "", chip, 60);
    const out: Row[] = [];
    const used = new Set<string>();
    const push = (item: CommandItem | undefined, section?: string) => {
      if (!item || used.has(item.id)) return;
      used.add(item.id);
      out.push({ item, section });
    };
    if (chip === "all" || chip === "games") push(inChip.find((i) => i.id === "resume"), "Retomar");
    recentIds.forEach((id, index) => push(inChip.find((i) => i.id === id), index === 0 ? "Recentes" : undefined));
    const restLabel = chip === "all" ? "Tudo" : (PALETTE_CHIPS.find((c) => c.id === chip)?.label ?? "Tudo");
    let firstRest = true;
    inChip.slice(0, 40).forEach((item) => {
      const before = out.length;
      push(item, firstRest && out.length > 0 ? restLabel : undefined);
      if (out.length > before) firstRest = false;
    });
    return out;
  }, [items, query, chip, recentIds]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, chip]);

  const executeItem = useCallback(
    (item: CommandItem) => {
      playSound?.("select");
      if (item.id !== "resume") {
        const next = pushRecent(readRecents(), item.id);
        writeRecents(next);
        setRecentIds(next);
      }
      item.action();
      onClose();
    },
    [playSound, onClose],
  );

  const cycleChip = (direction: 1 | -1) => {
    const index = PALETTE_CHIPS.findIndex((c) => c.id === chip);
    const next = PALETTE_CHIPS[(index + direction + PALETTE_CHIPS.length) % PALETTE_CHIPS.length];
    setChip(next.id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "Tab") {
      // Tab troca o filtro, no lugar de sair do campo
      e.preventDefault();
      cycleChip(e.shiftKey ? -1 : 1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, rows.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + rows.length) % Math.max(1, rows.length));
    } else if (e.key === "Enter" && rows[selectedIndex]) {
      e.preventDefault();
      executeItem(rows[selectedIndex].item);
    }
  };

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${selectedIndex}"]`)?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const activeId = rows[selectedIndex] ? `palette-option-${selectedIndex}` : undefined;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[12vh]">
          <motion.div
            {...modalBackdropMotion}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={onClose}
            aria-hidden="true"
          />

          <motion.div
            role="dialog"
            aria-label="Busca e comandos"
            {...modalMotion}
            className="relative z-10 w-full max-w-2xl overflow-hidden rounded-[var(--corner-lg)] bg-[var(--tone-1)] shadow-[var(--hairline),0_24px_64px_rgba(0,0,0,0.55)]"
          >
            <div className="flex items-center gap-3 px-5 pt-4">
              <Search className="pointer-events-none h-5 w-5 shrink-0 text-[var(--ink-muted)]" aria-hidden="true" />
              <input
                ref={inputRef}
                id="command-palette-search"
                role="combobox"
                aria-expanded={rows.length > 0}
                aria-controls="command-palette-list"
                aria-activedescendant={activeId}
                aria-autocomplete="list"
                aria-label="Buscar jogos, pessoas, mods e ações"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Buscar jogos, pessoas, mods e ações"
                className="h-11 w-full bg-transparent text-[length:var(--step-2)] text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus:outline-none focus-visible:!shadow-none focus-visible:!outline-none"
              />
              <span className="font-metric hidden shrink-0 rounded-[var(--node)] bg-[var(--tone-3)] px-2.5 py-1 text-[length:var(--step-0)] text-[var(--ink-muted)] sm:inline-flex">
                Esc
              </span>
            </div>

            <div role="group" aria-label="Filtrar por tipo" className="flex flex-wrap gap-2 px-5 pb-3 pt-3">
              {PALETTE_CHIPS.map((c) => {
                const active = chip === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setChip(c.id);
                      inputRef.current?.focus();
                    }}
                    aria-pressed={active}
                    className={`flex h-8 cursor-pointer items-center gap-2 rounded-[var(--node)] px-3.5 text-[length:var(--step-0)] font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)] ${
                      active
                        ? "bg-[var(--nav-active-bg)] text-[var(--nav-active-ink)]"
                        : "bg-[var(--tone-2)] text-[var(--ink-muted)] hover:bg-[var(--tone-3)] hover:text-[var(--ink)]"
                    }`}
                  >
                    {c.label}
                    <span className={`font-metric ${active ? "opacity-70" : "text-[var(--ink-faint)]"}`}>{counts[c.id]}</span>
                  </button>
                );
              })}
            </div>

            <div
              ref={listRef}
              id="command-palette-list"
              role="listbox"
              aria-label="Resultados"
              className="no-scrollbar flex max-h-[400px] flex-col gap-0.5 overflow-y-auto px-3 pb-3 pt-1 shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]"
            >
              {rows.length === 0 ? (
                <div className="px-4 py-12 text-center text-[length:var(--step-1)] text-[var(--ink-muted)]">
                  Nada encontrado para <span className="text-[var(--ink)]">“{query.trim()}”</span>
                  {chip !== "all" && ". Tente em Tudo."}
                </div>
              ) : (
                rows.map(({ item, section }, idx) => {
                  const selected = idx === selectedIndex;
                  const Icon = item.icon;
                  return (
                    <React.Fragment key={item.id}>
                      {section && (
                        <p className="px-3 pb-1 pt-3 text-[length:var(--step-0)] font-medium text-[var(--ink-faint)]">{section}</p>
                      )}
                      <button
                        id={`palette-option-${idx}`}
                        data-index={idx}
                        role="option"
                        aria-selected={selected}
                        type="button"
                        onClick={() => executeItem(item)}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={`flex h-14 w-full cursor-pointer items-center justify-between gap-3 rounded-[var(--node)] px-3 text-left transition-colors duration-100 ${
                          selected ? "bg-[var(--tone-3)]" : "hover:bg-[var(--tone-2)]"
                        }`}
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          <span
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                              selected ? "bg-[var(--nav-active-bg)] text-[var(--nav-active-ink)]" : "bg-[var(--tone-3)] text-[var(--ink-muted)]"
                            }`}
                          >
                            <Icon className="h-4 w-4" />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-[length:var(--step-1)] font-semibold text-[var(--ink)]">{item.title}</span>
                            {item.subtitle && (
                              <span className="block truncate text-[length:var(--step-0)] text-[var(--ink-muted)]">{item.subtitle}</span>
                            )}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          {item.badge && (
                            <span className="font-metric rounded-[var(--node)] bg-[var(--tone-3)] px-2.5 py-0.5 text-[length:var(--step-0)] text-[var(--ink-muted)]">
                              {item.badge}
                            </span>
                          )}
                          <span className="w-12 text-right text-[length:var(--step-0)] text-[var(--ink-faint)]">{KIND_LABEL[item.kind]}</span>
                        </span>
                      </button>
                    </React.Fragment>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-between px-5 py-3 text-[length:var(--step-0)] text-[var(--ink-faint)] shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]">
              <span>
                <span className="font-metric">Ctrl ↵</span> retoma o último jogo, em qualquer tela
              </span>
              <span className="flex items-center gap-4">
                <span><span className="font-metric">↵</span> Abrir</span>
                <span><span className="font-metric">Tab</span> Filtro</span>
                <span><span className="font-metric">Esc</span> Fechar</span>
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default CommandPalette;
