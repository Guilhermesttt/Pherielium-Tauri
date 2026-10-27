import { shouldOpenEdgeDrawer } from "../edgeDrawer";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SoundEffectType } from "../../hooks/useSoundEffects";
import { useOpenCloseSound } from "../../hooks/useOpenCloseSound";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Gamepad2, UserPlus, Users } from "lucide-react";
import type { SocialFriend } from "../../types/domain";
import { NodeDot, type NodeState } from "../ui/refined/NodeDot";
import { formatLastSeen, isFriendOnline, railSections } from "./friendsBoard";

/**
 * Gaveta de amigos, espelho da sidebar: fica escondida e abre ao encostar o mouse na borda
 * direita da janela (ou controlada por `open`). Mesmo vocabulário da sidebar: tom `--tone-1`,
 * borda interna de 1px, fundo escurecido e mola sem quicar.
 *
 * Nível 1: quem está jogando e o quê. Nível 2: quem está online. Nível 3: contagens (mono).
 */
export interface FriendsRailProps {
  friends: readonly SocialFriend[];
  pendingRequests?: number;
  onOpenFriend: (friendId: string) => void;
  onOpenFriends: () => void;
  /** Abre a "Noite de jogo" (escolher jogo, convidar amigos, abrir sala de voz). */
  onOpenGameNight?: () => void;
  /** Tela do jogo aberta por cima: a gaveta não abre (nem pela borda) e fecha se estava aberta. */
  locked?: boolean;
  /** Abre a gaveta sem depender do mouse (laboratório e testes). */
  defaultOpen?: boolean;
  /** Toca os sons do tema sonoro escolhido (abrir e fechar a gaveta). */
  playSound?: (type: SoundEffectType) => void;
}

const MAX_ROWS = 10;
const DRAWER_WIDTH = 320;
/** Faixa da borda direita que abre a gaveta, em px (a sidebar usa 12 na esquerda). */
const EDGE_PX = 12;
/** Altura da barra de título: o canto dos botões da janela não pode abrir a gaveta. */
const TITLEBAR_PX = 36;
const CLOSE_DELAY_MS = 250;

const nodeState = (f: SocialFriend): NodeState => {
  if (!isFriendOnline(f)) return "off";
  if (f.status === "playing" || f.status === "in_call" || f.status === "streaming") return "live";
  if (f.status === "idle" || f.status === "dnd") return "away";
  return "idle";
};

const initials = (name: string) => name.trim().slice(0, 2).toUpperCase() || "?";

const FriendAvatar: React.FC<{ friend: SocialFriend }> = ({ friend }) => (
  <span className="relative shrink-0">
    {friend.avatar ? (
      <img src={friend.avatar} alt="" className="h-10 w-10 rounded-full object-cover" draggable={false} />
    ) : (
      <span
        aria-hidden="true"
        className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--tone-3)] text-[length:var(--step-0)] font-semibold text-[var(--ink-muted)]"
      >
        {initials(friend.name)}
      </span>
    )}
    <NodeDot
      state={nodeState(friend)}
      label={!isFriendOnline(friend) ? "Offline" : friend.status === "playing" ? "Jogando" : "Online"}
      className="absolute -bottom-0.5 -right-0.5 rounded-full bg-[var(--tone-1)] p-0.5"
    />
  </span>
);

const Row: React.FC<{ friend: SocialFriend; onOpen: (id: string) => void }> = ({ friend, onOpen }) => {
  const playing = friend.status === "playing";
  const offline = !isFriendOnline(friend);
  const seen = offline ? formatLastSeen(friend.lastSeen) : "";
  const line = playing
    ? `Jogando ${friend.playing || "um jogo"}`
    : friend.status === "in_call"
      ? "Em uma chamada de voz"
      : friend.status === "idle"
        ? "Ausente"
        : friend.status === "dnd"
          ? "Não perturbe"
          : offline
            ? seen
              ? `Visto ${seen}`
              : "Offline"
            : "Online";
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(friend.id)}
        title={`${friend.name}: ${line}`}
        className="group flex h-14 w-full items-center gap-3 rounded-[var(--node)] px-3 text-left transition-colors duration-150 hover:bg-[var(--tone-2)]"
      >
        <FriendAvatar friend={friend} />
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-[length:var(--step-1)] font-semibold ${offline ? "text-[var(--ink-muted)]" : "text-[var(--ink)]"}`}>{friend.name}</span>
          <span className={`block truncate text-[length:var(--step-0)] ${playing ? "text-[var(--ink)]" : offline ? "text-[var(--ink-faint)]" : "text-[var(--ink-muted)]"}`}>
            {line}
          </span>
        </span>
      </button>
    </li>
  );
};

const Section: React.FC<{
  title: string;
  friends: SocialFriend[];
  onOpen: (id: string) => void;
  onMore: () => void;
}> = ({ title, friends, onOpen, onMore }) => {
  if (friends.length === 0) return null;
  const visible = friends.slice(0, MAX_ROWS);
  const hidden = friends.length - visible.length;
  return (
    <section aria-label={title} className="flex flex-col gap-1">
      <h3 className="mb-1 flex items-center justify-between px-4 text-[length:var(--step-0)] font-medium text-[var(--ink-faint)]">
        <span>{title}</span>
        <span className="font-metric">{friends.length}</span>
      </h3>
      <ul className="flex flex-col gap-1">
        {visible.map((friend) => (
          <Row key={friend.id} friend={friend} onOpen={onOpen} />
        ))}
      </ul>
      {hidden > 0 && (
        <button
          type="button"
          onClick={onMore}
          className="px-4 py-1 text-left text-[length:var(--step-0)] text-[var(--ink-muted)] hover:text-[var(--ink)]"
        >
          Ver mais {hidden}
        </button>
      )}
    </section>
  );
};

export const FriendsRail: React.FC<FriendsRailProps> = ({
  friends,
  pendingRequests = 0,
  onOpenFriend,
  onOpenFriends,
  onOpenGameNight,
  locked = false,
  defaultOpen = false,
  playSound,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  useOpenCloseSound(isOpen, playSound, { open: "sidebarOpen", close: "sidebarClose" });
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { playing, inCall, online, offline } = useMemo(() => railSections(friends), [friends]);
  const onlineTotal = playing.length + inCall.length + online.length;

  const open = useCallback(() => {
    if (locked) return;
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setIsOpen(true);
  }, [locked]);

  const closeSoon = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setIsOpen(false), CLOSE_DELAY_MS);
  }, []);

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  // A tela do jogo abriu por cima: se a gaveta estava aberta, fecha
  useEffect(() => {
    if (locked) setIsOpen(false);
  }, [locked]);

  // O mouse na borda direita (abaixo da barra de título) abre a gaveta, como a sidebar na esquerda
  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      if (
        event.clientY > TITLEBAR_PX &&
        shouldOpenEdgeDrawer({ locked, side: "right", clientX: event.clientX, viewportWidth: window.innerWidth, edgePx: EDGE_PX })
      ) {
        open();
      }
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [open, locked]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  const slide = prefersReducedMotion ? { opacity: 0 } : { x: DRAWER_WIDTH };

  const openFriend = (id: string) => {
    setIsOpen(false);
    onOpenFriend(id);
  };
  const openAll = () => {
    setIsOpen(false);
    onOpenFriends();
  };

  return (
    <>
      {!locked && (
        <div
          aria-hidden="true"
          onMouseEnter={open}
          className="pointer-events-auto fixed bottom-0 right-0 z-40 w-3.5"
          style={{ top: TITLEBAR_PX }}
        />
      )}

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              key="friends-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs"
              aria-hidden="true"
            />

            <motion.aside
              key="friends-drawer"
              aria-label="Amigos"
              data-captures-keys
              initial={slide}
              animate={{ x: 0, opacity: 1 }}
              exit={slide}
              transition={{ type: "spring", bounce: 0, duration: 0.35 }}
              onMouseEnter={open}
              onMouseLeave={closeSoon}
              style={{ width: DRAWER_WIDTH }}
              className="fixed bottom-0 right-0 top-0 z-50 flex select-none flex-col bg-[var(--tone-1)] p-4 shadow-[inset_1px_0_0_rgb(255_255_255/0.06)]"
            >
              <header className="mb-4 flex items-center justify-between px-1 pt-1">
                <span className="flex items-center gap-3 font-display text-[length:var(--step-3)] font-semibold tracking-[-0.03em] text-[var(--ink)]">
                  <Users className="h-5 w-5 text-[var(--ink-muted)]" aria-hidden="true" />
                  Amigos
                </span>
                <span className="font-metric text-[length:var(--step-0)] text-[var(--ink-muted)]">{onlineTotal} online</span>
              </header>

              <div className="no-scrollbar flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto">
                {friends.length === 0 ? (
                  <p className="px-4 text-[length:var(--step-1)] leading-relaxed text-[var(--ink-muted)]">
                    Você ainda não tem amigos por aqui. Adicione alguém para jogar junto.
                  </p>
                ) : (
                  <>
                    {onlineTotal === 0 && (
                      <p className="px-4 text-[length:var(--step-1)] leading-relaxed text-[var(--ink-muted)]">
                        Ninguém online agora. Chame alguém para jogar.
                      </p>
                    )}
                    <Section title="Jogando agora" friends={playing} onOpen={openFriend} onMore={openAll} />
                    <Section title="Em chamada" friends={inCall} onOpen={openFriend} onMore={openAll} />
                    <Section title="Online" friends={online} onOpen={openFriend} onMore={openAll} />
                    <Section title="Offline" friends={offline} onOpen={openFriend} onMore={openAll} />
                  </>
                )}
              </div>

              <footer className="mt-3 flex flex-col gap-1">
                {onOpenGameNight && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      onOpenGameNight();
                    }}
                    className="mb-1 flex h-12 cursor-pointer items-center justify-center gap-2.5 rounded-[var(--node)] bg-[var(--ink)] px-4 text-[length:var(--step-1)] font-semibold text-[var(--tone-0)] transition-[transform,opacity] duration-150 hover:scale-[1.02] active:scale-[0.97]"
                  >
                    <Gamepad2 className="h-5 w-5" aria-hidden="true" />
                    Noite de jogo
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onOpenFriends();
                  }}
                  className="flex h-11 items-center justify-between gap-3 rounded-[var(--node)] px-4 text-left text-[length:var(--step-1)] font-medium text-[var(--ink-muted)] transition-colors hover:bg-[var(--tone-2)] hover:text-[var(--ink)]"
                >
                  <span className="flex items-center gap-3">
                    <UserPlus className="h-5 w-5" aria-hidden="true" />
                    Todos os amigos
                  </span>
                  {pendingRequests > 0 && (
                    <span className="font-metric flex h-6 min-w-6 items-center justify-center rounded-[var(--node)] bg-[var(--ink)] px-2 text-[length:var(--step-0)] font-semibold text-[var(--tone-0)]">
                      {pendingRequests}
                    </span>
                  )}
                </button>
              </footer>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
