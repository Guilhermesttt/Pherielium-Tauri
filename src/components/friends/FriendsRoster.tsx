import React, { useEffect, useMemo, useState } from "react";
import { Gamepad2, Loader2, MessageSquare, Phone, Search, User, UserMinus, Video } from "lucide-react";
import type { Game, SocialFriend } from "../../types/domain";
import type { SoundEffectType } from "../../hooks/useSoundEffects";
import { getCheckpointFriendProfile } from "../../services/checkpointFriends";
import { friendLevelFromProfile } from "../../utils/friendLevel";
import type { PlayerLevelInfo } from "../../utils/trophyTiers";
import { buildBoard, formatLastSeen, isFriendOnline, titleHue, type GameGroup } from "./friendsBoard";

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

/** Avatar quadrado arredondado; o ponto de presença fica no canto, sem sair do alinhamento. */
const Avatar: React.FC<{ friend: SocialFriend; size: number; ring?: boolean }> = ({ friend, size, ring }) => (
  <span className="relative inline-block shrink-0 align-middle" style={{ width: size, height: size }}>
    <span
      className={`block h-full w-full overflow-hidden rounded-[28%] bg-white/[0.06] ${ring ? "ring-2 ring-emerald-400/80" : ""} ${isFriendOnline(friend) ? "" : "opacity-55"}`}
    >
      {friend.avatar ? (
        <img src={friend.avatar} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-white/45">
          <User style={{ width: size * 0.5, height: size * 0.5 }} />
        </span>
      )}
    </span>
    <span
      className={`absolute rounded-full border-2 border-[#121216] ${
        friend.status === "playing" ? "bg-emerald-400" : isFriendOnline(friend) ? "bg-white/85" : "bg-white/25"
      }`}
      style={{
        right: -2,
        bottom: -2,
        width: Math.min(16, Math.max(10, size * 0.26)),
        height: Math.min(16, Math.max(10, size * 0.26)),
      }}
    />
  </span>
);

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
}

const SectionTitle: React.FC<{ children: React.ReactNode; count?: number; hint?: string }> = ({ children, count, hint }) => (
  <div className="mb-3 flex items-baseline gap-2.5 px-1">
    <h3 className="font-display text-[20px] font-semibold leading-none text-white">{children}</h3>
    {count !== undefined && <span className="text-[14px] tabular-nums text-white/40">{count}</span>}
    {hint && <span className="text-[13px] text-white/35">{hint}</span>}
  </div>
);

/**
 * Amigos como um quadro de jogos: em cima, quem está jogando o quê (cada jogo é um bloco com a
 * arte dele); depois quem está online; os offline ficam quietos no fim. Selecionar alguém abre o
 * painel ao lado com as ações.
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
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
      {/* Quadro */}
      <div className="min-w-0">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
            <input
              id="friends-search-input"
              aria-label="Buscar amigos"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar por nome ou jogo"
              className="h-11 w-full rounded-full bg-[#121216] pl-11 pr-4 text-[14px] text-white outline-none ring-1 ring-white/[0.07] placeholder:text-white/35 focus:ring-2 focus:ring-white/30"
            />
          </div>
          <div role="tablist" aria-label="Filtrar por presença" className="flex gap-1.5">
            {FILTERS.map((x) => (
              <button
                key={x.id}
                role="tab"
                type="button"
                aria-selected={filter === x.id}
                onClick={() => {
                  playSound?.("select");
                  onFilterChange(x.id);
                }}
                className={`h-11 rounded-full px-5 text-[13px] font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-white/40 ${
                  filter === x.id ? "bg-white text-black" : "bg-[#121216] text-white/65 ring-1 ring-white/[0.07] hover:text-white"
                }`}
              >
                {x.label}
              </button>
            ))}
          </div>
        </div>

        {visible.length === 0 ? (
          <p className="rounded-[24px] bg-[#121216] px-6 py-14 text-center text-[14px] text-white/45 ring-1 ring-white/[0.07]">
            Ninguém por aqui com esse filtro. Tente outro nome ou volte para Todos.
          </p>
        ) : (
          <div className="space-y-9">
            {board.playing.length > 0 && (
              <section aria-label="Jogando agora">
                <SectionTitle count={board.playing.reduce((n, g) => n + g.friends.length, 0)}>Jogando agora</SectionTitle>
                <div className="space-y-3">
                  {board.playing.map((g) => (
                    <GameBlock key={g.title} group={g} selectedId={selectedId} onPick={pick} unread={unread} />
                  ))}
                </div>
              </section>
            )}

            {board.online.length > 0 && (
              <section aria-label="Online">
                <SectionTitle count={board.online.length}>Online</SectionTitle>
                <ul className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-2.5">
                  {board.online.map((f) => (
                    <li key={f.id}>
                      <button
                        type="button"
                        aria-current={f.id === selectedId}
                        onMouseEnter={() => playSound?.("hover")}
                        onClick={() => pick(f)}
                        className={`flex w-full items-center gap-3.5 rounded-[20px] p-3 text-left ring-1 transition-colors focus-visible:ring-2 focus-visible:ring-white/50 ${
                          f.id === selectedId ? "bg-[#1b1b22] ring-white/30" : "bg-[#121216] ring-white/[0.07] hover:bg-[#17171d]"
                        }`}
                      >
                        <Avatar friend={f} size={48} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-semibold text-white">{f.name}</span>
                          <span className="block truncate text-[13px] text-white/50">{statusLine(f)}</span>
                        </span>
                        {unread(f) > 0 && (
                          <span className="min-w-6 rounded-full bg-white px-2 text-center text-[12px] font-bold leading-6 text-black">{unread(f)}</span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {board.offline.length > 0 && (
              <section aria-label="Offline">
                <SectionTitle count={board.offline.length}>Offline</SectionTitle>
                <ul className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
                  {board.offline.map((f) => (
                    <li key={f.id}>
                      <button
                        type="button"
                        aria-current={f.id === selectedId}
                        onMouseEnter={() => playSound?.("hover")}
                        onClick={() => pick(f)}
                        className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition-colors focus-visible:ring-2 focus-visible:ring-white/40 ${
                          f.id === selectedId ? "bg-white/[0.09]" : "hover:bg-white/[0.05]"
                        }`}
                      >
                        <Avatar friend={f} size={36} />
                        <span className="min-w-0 flex-1 truncate text-[14px] text-white/75">{f.name}</span>
                        <span className="shrink-0 text-[12px] text-white/35">{formatLastSeen(f.lastSeen)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}

        {discord && (
          <div className="mt-8 flex items-center justify-between gap-3 rounded-[20px] bg-[#121216] px-5 py-3.5 text-[14px] ring-1 ring-white/[0.07]">
            <span className="text-white/60">{discord.connected ? "Discord conectado" : "Veja seus amigos do Discord aqui"}</span>
            {!discord.connected && (
              <button
                type="button"
                onClick={discord.onConnect}
                className="rounded-full bg-white px-4 py-1.5 text-[13px] font-semibold text-black active:scale-95 focus-visible:ring-2 focus-visible:ring-white/50"
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
          />
        ) : (
          <div className="flex min-h-[18rem] items-center justify-center rounded-[28px] bg-[#121216] px-8 text-center text-[14px] text-white/45 ring-1 ring-white/[0.07]">
            Selecione um amigo para conversar, ligar ou ver o perfil.
          </div>
        )}
      </aside>
    </div>
  );
};

/** Um jogo com quem está nele: a arte do jogo ocupa o bloco e os amigos aparecem como chips. */
const GameBlock: React.FC<{
  group: GameGroup;
  selectedId: string | null;
  onPick: (f: SocialFriend) => void;
  unread: (f: SocialFriend) => number;
}> = ({ group, selectedId, onPick, unread }) => {
  const hue = titleHue(group.title);
  return (
    <article className="overflow-hidden rounded-[26px] bg-[#121216] ring-1 ring-white/[0.07]">
      <div
        className="relative h-[120px] overflow-hidden"
        style={{ background: `linear-gradient(120deg, hsl(${hue} 45% 24%), hsl(${(hue + 40) % 360} 40% 14%))` }}
      >
        {group.art && (
          <img src={group.art} alt="" aria-hidden className="absolute right-0 top-0 h-full w-3/5 object-cover object-center" loading="lazy" />
        )}
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(90deg, #121216 0%, rgba(18,18,22,0.78) 38%, rgba(18,18,22,0) 100%)" }}
        />
        <div className="absolute inset-x-6 bottom-4">
          <h4 className="truncate font-display text-[28px] font-bold leading-none text-white">{group.title}</h4>
          <p className="mt-1.5 flex items-center gap-1.5 text-[14px] text-emerald-300">
            <Gamepad2 className="h-4 w-4" />
            {group.friends.length === 1 ? "1 amigo jogando" : `${group.friends.length} amigos jogando`}
          </p>
        </div>
      </div>
      <ul className="flex flex-wrap gap-2 p-3">
        {group.friends.map((f) => (
          <li key={f.id}>
            <button
              type="button"
              aria-current={f.id === selectedId}
              onClick={() => onPick(f)}
              className={`flex items-center gap-2.5 rounded-full py-1.5 pl-1.5 pr-4 ring-1 transition-colors focus-visible:ring-2 focus-visible:ring-white/50 ${
                f.id === selectedId ? "bg-[#1b1b22] text-white ring-2 ring-white" : "bg-[#0d0d10] text-white ring-white/[0.07] hover:bg-[#1b1b22]"
              }`}
            >
              <Avatar friend={f} size={32} />
              <span className="text-[14px] font-semibold">{f.name}</span>
              {unread(f) > 0 && <span className="rounded-full bg-emerald-400 px-1.5 text-[11px] font-bold text-black">{unread(f)}</span>}
            </button>
          </li>
        ))}
      </ul>
    </article>
  );
};

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
}> = ({ friend, level, banner, unread, inCall, loading, onOpenChat, onStartVoiceCall, onViewProfile, onRemoveFriend, playSound }) => {
  const [confirmRemove, setConfirmRemove] = useState(false);
  useEffect(() => setConfirmRemove(false), [friend.id]);
  const playing = friend.status === "playing";
  const seen = !isFriendOnline(friend) ? formatLastSeen(friend.lastSeen) : "";
  const small =
    "inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-white/[0.09] px-4 text-[13px] font-semibold text-white transition hover:bg-white/[0.16] active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-white/50";

  return (
    <div className="overflow-hidden rounded-[28px] bg-[#121216] ring-1 ring-white/[0.07]">
      {/* Capa: avatar e nome ficam juntos na base, alinhados pelo centro */}
      <div className="relative h-[168px] overflow-hidden bg-[#1d1d24]">
        {banner ? (
          <img src={banner} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          friend.avatar && (
            <img src={friend.avatar} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-125 object-cover opacity-45 blur-2xl" />
          )
        )}
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(18,18,22,0) 20%, rgba(18,18,22,0.92) 100%)" }} />
        <div className="absolute inset-x-5 bottom-4 flex items-center gap-4">
          <span className="relative">
            <Avatar friend={friend} size={76} ring={playing} />
            {loading && (
              <span className="absolute inset-0 flex items-center justify-center rounded-[28%] bg-black/60">
                <Loader2 className="h-5 w-5 animate-spin text-white" />
              </span>
            )}
          </span>
          <div className="min-w-0">
            <h2 className="truncate font-display text-[26px] font-bold leading-tight text-white">{friend.name}</h2>
            <p className={`flex items-center gap-1.5 text-[14px] ${playing ? "font-semibold text-emerald-300" : "text-white/60"}`}>
              {playing && <Gamepad2 className="h-4 w-4 shrink-0" />}
              <span className="truncate">{statusLine(friend)}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-5 p-5">
        <button
          type="button"
          onClick={() => {
            playSound?.("select");
            onOpenChat(friend);
          }}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white text-[14px] font-semibold text-black transition active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-white/60"
        >
          <MessageSquare className="h-4 w-4" />
          Conversar
          {unread > 0 && <span className="rounded-full bg-black px-2 text-[11px] text-white">{unread}</span>}
        </button>
        <div className="flex gap-2">
          {onStartVoiceCall && (
            <>
              <button
                type="button"
                onClick={() => onStartVoiceCall(friend, false)}
                className={`${small} ${inCall ? "animate-pulse bg-emerald-400! text-black!" : ""}`}
              >
                <Phone className="h-4 w-4" />
                {inCall ? "Em chamada" : "Ligar"}
              </button>
              <button type="button" onClick={() => onStartVoiceCall(friend, true)} className={small}>
                <Video className="h-4 w-4" />
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
            className={small}
          >
            Perfil
          </button>
        </div>

        {/* Nível: o número é o destaque, o rank dá a cor */}
        <div className="rounded-[20px] bg-[#0d0d10] p-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[13px] text-white/45">Nível</p>
              <p className="font-display text-[44px] font-bold leading-none tabular-nums text-white">{level ? level.level : "—"}</p>
            </div>
            {level && (
              <p className="pb-1 text-[15px] font-semibold" style={{ color: level.rankColor }}>
                {level.rank}
              </p>
            )}
          </div>
          {level && level.xpForNextLevel > 0 ? (
            <>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, level.progress))}%`, background: level.rankColor }} />
              </div>
              <p className="mt-1.5 text-[12px] text-white/40">{Math.round(level.progress)}% para o próximo nível</p>
            </>
          ) : (
            !level && <p className="mt-2 text-[12px] text-white/40">O nível aparece quando o perfil do amigo carregar.</p>
          )}
        </div>

        <dl className="flex flex-wrap gap-x-8 gap-y-2 text-[13px]">
          <div>
            <dt className="text-white/40">Origem</dt>
            <dd className="font-semibold text-white">
              {friend.source === "checkpoint" ? "Pherielium" : friend.source?.startsWith("discord") ? "Discord" : "Local"}
            </dd>
          </div>
          {seen && (
            <div>
              <dt className="text-white/40">Última vez online</dt>
              <dd className="font-semibold text-white">{seen}</dd>
            </div>
          )}
        </dl>

        <div className="border-t border-white/[0.07] pt-4">
          {confirmRemove ? (
            <div className="flex flex-wrap items-center gap-3 text-[13px]">
              <span className="text-white/70">Remover {friend.name} dos amigos?</span>
              <button type="button" onClick={() => onRemoveFriend(friend)} className="rounded-full bg-rose-500/90 px-4 py-1.5 font-semibold text-white hover:bg-rose-500">
                Remover
              </button>
              <button type="button" onClick={() => setConfirmRemove(false)} className="text-white/55 hover:text-white">
                Cancelar
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmRemove(true)} className="inline-flex items-center gap-2 text-[13px] text-white/45 hover:text-rose-300">
              <UserMinus className="h-4 w-4" />
              Remover amigo
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default FriendsRoster;
