import React, { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDiscord } from "@fortawesome/free-brands-svg-icons";
import { Copy, Gamepad2, Loader2, MessageSquare, Phone, Search, User, UserMinus, UserPlus, Video } from "lucide-react";
import type { Game, SocialFriend } from "../../types/domain";
import type { SoundEffectType } from "../../hooks/useSoundEffects";
import { getCheckpointFriendProfile } from "../../services/checkpointFriends";
import { friendLevelFromProfile } from "../../utils/friendLevel";
import type { PlayerLevelInfo } from "../../utils/trophyTiers";
import { buildBoard, formatLastSeen, isFriendOnline, type GameGroup } from "./friendsBoard";
import type { DiscordFriendState } from "./discordFriendGroups";
import type { DiscordFriendActions } from "../../hooks/useDiscordFriendMatches";
import { IconSwap } from "../ui/IconSwap";
import { HorizontalTabs } from "../ui/HorizontalTabs";
import { RankBadge } from "../ui/RankBadge";
import { SectionTransition } from "../ui/SectionTransition";

export { formatLastSeen } from "./friendsBoard";

interface FriendExtras {
  level: PlayerLevelInfo | null;
  banner: string | null;
}
const levelCache = new Map<string, FriendExtras>();

/** Nível e banner de cada amigo do Pherielium, buscados no perfil público (cache por sessão, 3 por vez). */
function useFriendExtras(friends: SocialFriend[]): Record<string, FriendExtras> {
  const [, bump] = useState(0);
  const key = friends.map((f) => f.id).join("|");
  useEffect(() => {
    let cancelled = false;
    const queue = friends.filter((f) => f.source === "checkpoint" && !levelCache.has(f.id)).map((f) => f.id);
    const worker = async () => {
      for (let id = queue.shift(); id && !cancelled; id = queue.shift()) {
        const uid = id.split(":")[1];
        try {
          const { profile } = await getCheckpointFriendProfile(uid);
          levelCache.set(id, { level: friendLevelFromProfile(profile), banner: profile?.bannerURL ?? null });
        } catch {
          levelCache.set(id, { level: null, banner: null });
        }
        if (!cancelled) bump((n) => n + 1);
      }
    };
    void Promise.all([worker(), worker(), worker()]);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return Object.fromEntries(friends.map((f) => [f.id, levelCache.get(f.id) ?? { level: null, banner: null }]));
}

export type RosterFilter = "ALL" | "ONLINE" | "PLAYING" | "OFFLINE";

function statusLine(f: SocialFriend): string {
  if (f.status === "playing") return `Jogando ${f.playing || "um jogo"}`;
  if (f.status === "streaming") return "Transmitindo";
  if (f.status === "in_call") return "Em uma chamada";
  if (f.status === "dnd") return "Não perturbe";
  if (f.status === "idle") return "Ausente";
  if (f.status === "online") return "Online";
  const seen = formatLastSeen(f.lastSeen);
  return seen ? `Visto ${seen}` : "Offline";
}

/** Ponto de presença antes do nome: verde online, vermelho offline (tokens `--presence-*`). */
const PresenceDot: React.FC<{ friend: SocialFriend; size?: number }> = ({ friend, size = 9 }) => {
  const online = isFriendOnline(friend);
  return (
    <span
      role="img"
      aria-label={online ? "Online" : "Offline"}
      className="inline-block shrink-0 rounded-full"
      style={{
        width: size,
        height: size,
        backgroundColor: online ? "var(--presence-online)" : "var(--presence-offline)",
        boxShadow: `0 0 0 2px color-mix(in srgb, ${online ? "var(--presence-online)" : "var(--presence-offline)"} 22%, transparent)`,
      }}
    />
  );
};

/** Avatar quadrado arredondado. */
const Avatar: React.FC<{ friend: SocialFriend; size: number; ring?: boolean }> = ({ friend, size, ring }) => {
  // foto que não carrega (URL quebrada) cai no ícone em vez do ícone de imagem quebrada
  const [broken, setBroken] = React.useState(false);
  React.useEffect(() => setBroken(false), [friend.avatar]);
  return (
  <span className="relative inline-block shrink-0 align-middle" style={{ width: size, height: size }}>
    <span
      className={`block h-full w-full overflow-hidden rounded-[28%] bg-[var(--tone-3)] ${ring ? "ring-2 ring-[var(--live)]" : ""}`}
    >
      {friend.avatar && !broken ? (
        <img
          src={friend.avatar}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setBroken(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-[var(--ink-faint)]">
          <User style={{ width: size * 0.5, height: size * 0.5 }} />
        </span>
      )}
    </span>
  </span>
);
};

const FILTERS: { id: RosterFilter; label: string }[] = [
  { id: "ALL", label: "Todos" },
  { id: "PLAYING", label: "Jogando" },
  { id: "ONLINE", label: "Online" },
  { id: "OFFLINE", label: "Offline" },
];

export interface FriendsRosterProps {
  friends: SocialFriend[];
  /** biblioteca de quem está vendo: dá a arte dos jogos que os amigos estão jogando */
  games?: Game[];
  unreadByFriend: Record<string, number>;
  search: string;
  onSearchChange: (v: string) => void;
  filter: RosterFilter;
  onFilterChange: (f: RosterFilter) => void;
  isCallActiveWith: (friendId: string) => boolean;
  loadingProfileId?: string | null;
  onOpenChat: (f: SocialFriend) => void;
  onStartVoiceCall?: (f: SocialFriend, withVideo?: boolean) => void;
  onViewProfile: (f: SocialFriend) => void;
  onRemoveFriend: (f: SocialFriend) => void;
  playSound?: (t: SoundEffectType) => void;
  /** Conexão com o Discord (amigos do Discord aparecem na lista quando conectado). */
  discord?: { connected: boolean; onConnect: () => void };
  /** Cruzamento dos amigos do Discord com contas do Pherielium (Adicionar / Convidar). */
  discordMatch?: Pick<DiscordFriendActions, "stateById" | "loading" | "addFriend" | "copyInvite">;
}

const DISCORD_STATE_LABEL: Record<DiscordFriendState["kind"], string> = {
  friend: "Já é amigo",
  pending_out: "Pedido enviado",
  pending_in: "Quer ser seu amigo",
  addable: "Tem conta",
  invite: "Sem conta",
};

/** Ação do amigo do Discord no painel: adicionar quem já tem conta, convidar quem não tem. */
const DiscordFriendAction: React.FC<{
  friend: SocialFriend;
  match: NonNullable<FriendsRosterProps["discordMatch"]>;
}> = ({ friend, match }) => {
  const state = match.stateById[friend.id];
  const [busy, setBusy] = useState(false);
  if (!state) return null;
  const run = async (action: (f: SocialFriend) => Promise<void>) => {
    setBusy(true);
    try {
      await action(friend);
    } finally {
      setBusy(false);
    }
  };
  const primary =
    "inline-flex h-12 w-full items-center justify-center gap-2 rounded-[var(--corner-sm)] bg-[var(--ink)] text-[length:var(--step-1)] font-semibold text-[var(--tone-0)] transition active:scale-[0.98] disabled:opacity-60";
  return (
    <div className="space-y-2 rounded-[var(--corner-md)] bg-[var(--surface-base)] p-4">
      <p className="flex items-center gap-2 text-[length:var(--step-0)] text-[var(--ink-faint)]">
        <FontAwesomeIcon icon={faDiscord} className="h-4 w-4 text-[#8c9eff]" aria-hidden />
        Amigo do Discord · {DISCORD_STATE_LABEL[state.kind]}
      </p>
      {state.kind === "addable" && (
        <button type="button" disabled={busy} onClick={() => void run(match.addFriend)} className={primary}>
          <IconSwap active={busy} a={<UserPlus className="h-4 w-4" />} b={<Loader2 className="h-4 w-4 animate-spin" />} />
          Adicionar no Pherielium
        </button>
      )}
      {state.kind === "invite" && (
        <>
          <button type="button" disabled={busy || match.loading} onClick={() => void run(match.copyInvite)} className={primary}>
            <Copy className="h-4 w-4" />
            Copiar convite
          </button>
          <p className="text-[length:var(--step-0)] text-[var(--ink-faint)]">
            O Pherielium não envia mensagens pelo Discord: copie o convite e cole numa conversa com {friend.name}.
          </p>
        </>
      )}
      {state.kind === "pending_in" && (
        <p className="text-[length:var(--step-0)] text-[var(--ink-muted)]">Aceite o pedido na aba Solicitações.</p>
      )}
      {state.kind === "pending_out" && (
        <p className="text-[length:var(--step-0)] text-[var(--ink-muted)]">Aguardando {friend.name} aceitar.</p>
      )}
      {state.kind === "friend" && (
        <p className="text-[length:var(--step-0)] text-[var(--ink-muted)]">Vocês já são amigos no Pherielium.</p>
      )}
    </div>
  );
};

/** Rótulo de seção no tom do console: caixa alta pequena e a contagem em mono. */
const SectionLabel: React.FC<{ children: React.ReactNode; count?: number }> = ({ children, count }) => (
  <h3 className="mb-3 flex items-baseline gap-2.5 px-0.5 text-[length:var(--fs-label)] font-bold uppercase tracking-[0.08em] text-[var(--ink-muted)]">
    {children}
    {count !== undefined && <span className="font-metric text-[length:var(--step-0)] font-normal tracking-normal text-[var(--ink-faint)]">{count}</span>}
  </h3>
);

const TILE = "rounded-[var(--corner-md)]";
const CONTROL = "rounded-[var(--corner-sm)]";

/**
 * Amigos como uma tela de console: em cima, quem está jogando o quê (cada jogo é um bloco com a
 * arte dele); depois quem está online; os offline ficam quietos no fim. O item selecionado ganha o
 * contorno de tinta, como a lista de conquistas, e o painel ao lado traz as ações.
 */
export const FriendsRoster: React.FC<FriendsRosterProps> = ({
  friends,
  games = [],
  unreadByFriend,
  search,
  onSearchChange,
  filter,
  onFilterChange,
  isCallActiveWith,
  loadingProfileId,
  onOpenChat,
  onStartVoiceCall,
  onViewProfile,
  onRemoveFriend,
  playSound,
  discord,
  discordMatch,
}) => {
  const extras = useFriendExtras(friends);
  const q = search.trim().toLowerCase();
  const visible = useMemo(
    () =>
      friends.filter((f) => {
        if (q && !f.name.toLowerCase().includes(q) && !(f.playing ?? "").toLowerCase().includes(q)) return false;
        if (filter === "PLAYING") return f.status === "playing";
        if (filter === "ONLINE") return isFriendOnline(f);
        if (filter === "OFFLINE") return f.status === "offline";
        return true;
      }),
    [friends, q, filter],
  );
  const board = useMemo(() => buildBoard(visible, games), [visible, games]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    if (selectedId && visible.some((f) => f.id === selectedId)) return;
    const first = board.playing[0]?.friends[0] ?? board.online[0] ?? board.offline[0] ?? null;
    setSelectedId(first?.id ?? null);
  }, [visible, board, selectedId]);

  const selected = visible.find((f) => f.id === selectedId) ?? null;
  const unread = (f: SocialFriend) => unreadByFriend[f.id.split(":")[1]] || 0;
  const pick = (f: SocialFriend) => {
    playSound?.("select");
    setSelectedId(f.id);
  };

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
      {/* Quadro */}
      <div className="min-w-0">
        <div className="mb-8 flex flex-wrap items-center gap-4">
          <div className="relative min-w-[260px] flex-1">
            <Search className="pointer-events-none absolute left-4.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-faint)]" />
            <input
              id="friends-search-input"
              aria-label="Buscar amigos"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar por nome ou jogo"
              className={`${CONTROL} h-12 w-full bg-[var(--tone-2)] pl-12 pr-5 text-[length:var(--step-1)] text-[var(--ink)] outline-none transition-colors placeholder:text-[var(--ink-faint)] focus:bg-[var(--tone-3)]`}
            />
          </div>
          <HorizontalTabs
            activeId={filter}
            onChange={(id) => {
              playSound?.("select");
              onFilterChange(id as RosterFilter);
            }}
            className="t-tabs--squircle"
            tabClassName="flex h-12 items-center text-[length:var(--fs-label)] font-bold uppercase tracking-[0.06em] whitespace-nowrap"
            tabs={FILTERS.map((x) => ({ id: x.id, label: x.label }))}
          />
        </div>

        <SectionTransition id={filter}>
        {visible.length === 0 ? (
          <p className={`${TILE} bg-[var(--tone-1)] px-6 py-14 text-center text-[length:var(--step-1)] text-[var(--ink-muted)]`}>
            Ninguém por aqui com esse filtro. Tente outro nome ou volte para Todos.
          </p>
        ) : (
          <div className="space-y-12">
            {board.playing.length > 0 && (
              <section aria-label="Jogando agora">
                <SectionLabel count={board.playing.reduce((n, g) => n + g.friends.length, 0)}>Jogando agora</SectionLabel>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4">
                  {board.playing.map((g) => (
                    <GameTile key={g.title} group={g} selectedId={selectedId} onPick={pick} unread={unread} />
                  ))}
                </div>
              </section>
            )}

            {board.online.length > 0 && (
              <section aria-label="Online">
                <SectionLabel count={board.online.length}>Online</SectionLabel>
                <ul className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
                  {board.online.map((f) => (
                    <li key={f.id}>
                      <button
                        type="button"
                        aria-current={f.id === selectedId}
                        onMouseEnter={() => playSound?.("hover")}
                        onClick={() => pick(f)}
                        className={`${TILE} flex w-full cursor-pointer items-center gap-4 p-4 text-left transition-colors duration-[var(--dur-focus)] ${
                          f.id === selectedId ? "bg-[var(--tone-4)]" : "bg-[var(--tone-2)] hover:bg-[var(--tone-3)]"
                        }`}
                      >
                        <Avatar friend={f} size={56} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2 text-[length:var(--step-1)] font-semibold text-[var(--ink)]">
                            <PresenceDot friend={f} />
                            <span className="truncate">{f.name}</span>
                          </span>
                          <span className="block truncate text-[length:var(--step-0)] text-[var(--ink-muted)]">{statusLine(f)}</span>
                        </span>
                        {unread(f) > 0 && (
                          <span className="font-metric min-w-6 rounded-full bg-[var(--ink)] px-2 text-center text-[length:var(--step-0)] font-bold leading-6 text-[var(--tone-0)]">{unread(f)}</span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {board.offline.length > 0 && (
              <section aria-label="Offline">
                <SectionLabel count={board.offline.length}>Offline</SectionLabel>
                <ul className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
                  {board.offline.map((f) => (
                    <li key={f.id}>
                      <button
                        type="button"
                        aria-current={f.id === selectedId}
                        onMouseEnter={() => playSound?.("hover")}
                        onClick={() => pick(f)}
                        className={`${CONTROL} flex w-full cursor-pointer items-center gap-3.5 px-4 py-3 text-left transition-colors duration-[var(--dur-focus)] ${
                          f.id === selectedId ? "bg-[var(--tone-4)]" : "hover:bg-[var(--tone-2)]"
                        }`}
                      >
                        <Avatar friend={f} size={44} />
                        <span className="flex min-w-0 flex-1 items-center gap-2 text-[length:var(--step-1)] text-[var(--ink)]">
                          <PresenceDot friend={f} />
                          <span className="truncate">{f.name}</span>
                        </span>
                        <span className="shrink-0 text-[length:var(--step-0)] text-[var(--ink-faint)]">
                          {f.source === "discord_friend" && discordMatch?.stateById[f.id]
                            ? DISCORD_STATE_LABEL[discordMatch.stateById[f.id].kind]
                            : formatLastSeen(f.lastSeen)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}

        </SectionTransition>

        {discord && (
          <div className={`${TILE} mt-10 flex items-center justify-between gap-3 bg-[var(--tone-1)] px-5 py-3.5 text-[length:var(--step-1)]`}>
            <span className="flex items-center gap-2.5 text-[var(--ink-muted)]">
              <FontAwesomeIcon icon={faDiscord} className="h-[18px] w-[18px] shrink-0 text-[#8c9eff]" aria-hidden />
              {discord.connected ? "Discord conectado" : "Veja seus amigos do Discord aqui"}
            </span>
            {!discord.connected && (
              <button
                type="button"
                onClick={discord.onConnect}
                className="cursor-pointer rounded-[var(--corner-sm)] bg-[var(--ink)] px-5 py-2.5 text-[length:var(--step-0)] font-semibold text-[var(--tone-0)] active:scale-95"
              >
                Conectar
              </button>
            )}
          </div>
        )}
      </div>

      {/* Painel do amigo */}
      <aside aria-label="Detalhes do amigo" className="lg:sticky lg:top-4">
        {selected ? (
          <FriendDrawer
            friend={selected}
            level={extras[selected.id]?.level ?? null}
            banner={extras[selected.id]?.banner ?? null}
            unread={unread(selected)}
            inCall={isCallActiveWith(selected.id)}
            loading={loadingProfileId === selected.id}
            onOpenChat={onOpenChat}
            onStartVoiceCall={onStartVoiceCall}
            onViewProfile={onViewProfile}
            onRemoveFriend={onRemoveFriend}
            playSound={playSound}
            discordMatch={discordMatch}
          />
        ) : (
          <div className={`${TILE} flex min-h-[18rem] items-center justify-center bg-[var(--tone-1)] px-8 text-center text-[length:var(--step-1)] text-[var(--ink-muted)]`}>
            Selecione um amigo para conversar, ligar ou ver o perfil.
          </div>
        )}
      </aside>
    </div>
  );
};

/** Um jogo com quem está nele: a arte ocupa o bloco de ponta a ponta e os amigos ficam na base. */
const GameTile: React.FC<{
  group: GameGroup;
  selectedId: string | null;
  onPick: (f: SocialFriend) => void;
  unread: (f: SocialFriend) => number;
}> = ({ group, selectedId, onPick, unread }) => (
  <article className={`${TILE} relative isolate flex min-h-[220px] flex-col justify-end overflow-hidden bg-[var(--tone-1)]`}>
    {group.art && <img src={group.art} alt="" aria-hidden loading="lazy" className="absolute inset-0 -z-10 h-full w-full object-cover object-top" />}
    <div
      className="absolute inset-0 -z-10"
      style={{ background: "linear-gradient(0deg, color-mix(in srgb, var(--tone-0) 92%, transparent) 0%, color-mix(in srgb, var(--tone-0) 55%, transparent) 55%, transparent 100%)" }}
    />
    <div className="p-5">
      <h4 className="truncate text-[length:var(--step-2)] font-semibold leading-tight text-[var(--ink)]">{group.title}</h4>
      <p className="mt-0.5 flex items-center gap-1.5 text-[length:var(--step-0)] font-semibold uppercase tracking-[0.06em] text-[var(--live)]">
        <Gamepad2 className="h-4 w-4" aria-hidden />
        <span className="font-metric">{group.friends.length}</span> {group.friends.length === 1 ? "amigo jogando" : "amigos jogando"}
      </p>
      <ul className="mt-4 flex flex-wrap gap-2">
        {group.friends.map((f) => (
          <li key={f.id}>
            <button
              type="button"
              aria-current={f.id === selectedId}
              aria-label={f.name}
              title={f.name}
              onClick={() => onPick(f)}
              className={`${CONTROL} relative cursor-pointer p-1 transition-colors duration-[var(--dur-focus)] ${
                f.id === selectedId ? "bg-[var(--ink)]" : "bg-[color-mix(in_srgb,var(--tone-0)_55%,transparent)] hover:bg-[var(--tone-4)]"
              }`}
            >
              <Avatar friend={f} size={40} />
              {unread(f) > 0 && (
                <span className="font-metric absolute -right-1.5 -top-1.5 rounded-full bg-[var(--ink)] px-1.5 text-[length:var(--step-0)] font-bold leading-5 text-[var(--tone-0)]">{unread(f)}</span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  </article>
);

const FriendDrawer: React.FC<{
  friend: SocialFriend;
  level: PlayerLevelInfo | null;
  banner: string | null;
  unread: number;
  inCall: boolean;
  loading: boolean;
  onOpenChat: (f: SocialFriend) => void;
  onStartVoiceCall?: (f: SocialFriend, withVideo?: boolean) => void;
  onViewProfile: (f: SocialFriend) => void;
  onRemoveFriend: (f: SocialFriend) => void;
  playSound?: (t: SoundEffectType) => void;
  discordMatch?: FriendsRosterProps["discordMatch"];
}> = ({ friend, level, banner, unread, inCall, loading, onOpenChat, onStartVoiceCall, onViewProfile, onRemoveFriend, playSound, discordMatch }) => {
  const [confirmRemove, setConfirmRemove] = useState(false);
  useEffect(() => setConfirmRemove(false), [friend.id]);
  const playing = friend.status === "playing";
  const seen = !isFriendOnline(friend) ? formatLastSeen(friend.lastSeen) : "";
  const chip =
    "inline-flex h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-[var(--corner-sm)] bg-[var(--tone-3)] px-4 text-[length:var(--step-0)] font-semibold text-[var(--ink)] transition hover:bg-[var(--tone-4)] active:scale-[0.97]";

  return (
    <div className={`${TILE} overflow-hidden bg-[var(--tone-1)]`}>
      {/* Capa: a arte do perfil de ponta a ponta; avatar e nome juntos na base */}
      <div className="relative h-[200px] overflow-hidden bg-[var(--tone-2)]">
        {banner ? (
          <img src={banner} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          friend.avatar && <img src={friend.avatar} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-125 object-cover opacity-45 blur-2xl" />
        )}
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, transparent 15%, color-mix(in srgb, var(--tone-1) 94%, transparent) 100%)" }} />
        <div className="absolute inset-x-5 bottom-4 flex items-center gap-4">
          <span className="relative">
            <Avatar friend={friend} size={80} ring={playing} />
            {loading && (
              <span className="absolute inset-0 flex items-center justify-center rounded-[28%] bg-[var(--surface-base)]/70">
                <Loader2 className="h-5 w-5 animate-spin text-[var(--ink)]" />
              </span>
            )}
          </span>
          <div className="min-w-0">
            <h2 className="flex items-center gap-2.5 text-[length:var(--step-3)] font-semibold leading-tight text-[var(--ink)]">
              <PresenceDot friend={friend} size={11} />
              <span className="truncate">{friend.name}</span>
            </h2>
            <p className={`flex items-center gap-1.5 text-[length:var(--step-0)] ${playing ? "font-semibold text-[var(--live)]" : "text-[var(--ink-muted)]"}`}>
              {playing && <Gamepad2 className="h-4 w-4 shrink-0" aria-hidden />}
              <span className="truncate">{statusLine(friend)}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6 p-6">
        {friend.source === "discord_friend" && discordMatch && <DiscordFriendAction friend={friend} match={discordMatch} />}

        <button
          type="button"
          onClick={() => {
            playSound?.("select");
            onOpenChat(friend);
          }}
          className="flex h-14 w-full cursor-pointer items-center justify-between gap-3 rounded-[var(--corner-sm)] bg-[var(--ink)] pl-6 pr-3 text-[length:var(--fs-label)] font-bold uppercase tracking-[0.06em] text-[var(--tone-0)] transition active:scale-[0.98] hover:opacity-90"
        >
          <span className="flex items-center gap-2.5">
            Conversar
            {unread > 0 && <span className="font-metric rounded-full bg-[var(--tone-0)] px-2 text-[length:var(--step-0)] leading-5 text-[var(--ink)]">{unread}</span>}
          </span>
          <span className="flex h-10 w-10 items-center justify-center rounded-[var(--corner-sm)] bg-[var(--tone-0)] text-[var(--ink)]">
            <MessageSquare className="h-4 w-4" aria-hidden />
          </span>
        </button>

        <div className="flex gap-2">
          {onStartVoiceCall && (
            <>
              <button
                type="button"
                onClick={() => onStartVoiceCall(friend, false)}
                className={`${chip} ${inCall ? "!bg-[var(--live)] !text-[var(--tone-0)]" : ""}`}
              >
                <Phone className="h-4 w-4" aria-hidden />
                {inCall ? "Em chamada" : "Ligar"}
              </button>
              <button type="button" onClick={() => onStartVoiceCall(friend, true)} className={chip}>
                <Video className="h-4 w-4" aria-hidden />
                Vídeo
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => {
              playSound?.("select");
              onViewProfile(friend);
            }}
            className={chip}
          >
            Perfil
          </button>
        </div>

        {/* Nível e rank numa peça só (imagem do rank + número), depois origem e última vez online */}
        <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
          {level ? <RankBadge level={level} size={64} /> : <span className="font-metric text-[length:var(--step-3)] text-[var(--ink-faint)]">—</span>}
          <dl className="console-stats flex flex-wrap items-end gap-x-8 gap-y-3">
            <div>
              <dt>Origem</dt>
              <dd className="console-stats-text">
                {friend.source === "checkpoint" ? "Pherielium" : friend.source?.startsWith("discord") ? "Discord" : "Local"}
              </dd>
            </div>
            {seen && (
              <div>
                <dt>Visto</dt>
                <dd className="console-stats-text">{seen}</dd>
              </div>
            )}
          </dl>
        </div>
        {level && level.xpForNextLevel > 0 ? (
          <div>
            <div className="console-progress">
              <span style={{ width: `${Math.min(100, Math.max(0, level.progress))}%` }} />
            </div>
            <p className="font-metric mt-1.5 text-[length:var(--step-0)] text-[var(--ink-muted)]">{Math.round(level.progress)}% para o próximo nível</p>
          </div>
        ) : (
          !level && <p className="text-[length:var(--step-0)] text-[var(--ink-faint)]">O nível aparece quando o perfil do amigo carregar.</p>
        )}

        <div className="border-t border-[color:var(--tone-3)] pt-4">
          {confirmRemove ? (
            <div className="flex flex-wrap items-center gap-3 text-[length:var(--step-0)]">
              <span className="text-[var(--ink-muted)]">Remover {friend.name} dos amigos?</span>
              <button type="button" onClick={() => onRemoveFriend(friend)} className="cursor-pointer rounded-[var(--corner-sm)] bg-[var(--danger)] px-4 py-2 font-semibold text-[var(--tone-0)]">
                Remover
              </button>
              <button type="button" onClick={() => setConfirmRemove(false)} className="cursor-pointer text-[var(--ink-muted)] hover:text-[var(--ink)]">
                Cancelar
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmRemove(true)} className="inline-flex cursor-pointer items-center gap-2 text-[length:var(--step-0)] text-[var(--ink-faint)] hover:text-[var(--danger)]">
              <UserMinus className="h-4 w-4" aria-hidden />
              Remover amigo
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default FriendsRoster;
