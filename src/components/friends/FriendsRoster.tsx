import React, { useEffect, useMemo, useState } from "react";
import { Gamepad2, Loader2, MessageSquare, Phone, Search, User, UserMinus, Video } from "lucide-react";
import type { SocialFriend } from "../../types/domain";
import type { SoundEffectType } from "../../hooks/useSoundEffects";
import { getCheckpointFriendProfile } from "../../services/checkpointFriends";
import { friendLevelFromProfile } from "../../utils/friendLevel";
import type { PlayerLevelInfo } from "../../utils/trophyTiers";

const levelCache = new Map<string, PlayerLevelInfo | null>();

/** Nível de cada amigo do Pherielium, buscado no perfil público (cache por sessão, 3 por vez). */
function useFriendLevels(friends: SocialFriend[]): Record<string, PlayerLevelInfo | null> {
  const [, bump] = useState(0);
  const key = friends.map((f) => f.id).join("|");
  useEffect(() => {
    let cancelled = false;
    const queue = friends
      .filter((f) => f.source === "checkpoint" && !levelCache.has(f.id))
      .map((f) => f.id);
    const worker = async () => {
      for (let id = queue.shift(); id && !cancelled; id = queue.shift()) {
        const uid = id.split(":")[1];
        try {
          const { profile } = await getCheckpointFriendProfile(uid);
          levelCache.set(id, friendLevelFromProfile(profile));
        } catch {
          levelCache.set(id, null);
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
  return Object.fromEntries(friends.map((f) => [f.id, levelCache.get(f.id) ?? null]));
}

export type RosterFilter = "ALL" | "ONLINE" | "PLAYING" | "OFFLINE";

const ONLINE_STATUSES = new Set(["online", "playing", "streaming", "in_call", "idle", "dnd"]);

const isOnline = (f: SocialFriend) => ONLINE_STATUSES.has(f.status);

/** "há 5 min", "há 3 h", "há 2 d" a partir de lastSeen; vazio quando não há dado. */
export function formatLastSeen(lastSeen: SocialFriend["lastSeen"], now = Date.now()): string {
  if (lastSeen == null || lastSeen === "") return "";
  const t = typeof lastSeen === "number" ? lastSeen : new Date(lastSeen).getTime();
  if (!Number.isFinite(t)) return "";
  const min = Math.max(0, Math.round((now - t) / 60000));
  if (min < 1) return "agora há pouco";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  return `há ${Math.round(h / 24)} d`;
}

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

const presenceClass = (f: SocialFriend) =>
  f.status === "playing"
    ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
    : isOnline(f)
      ? "bg-white/80"
      : "bg-white/20";

const Avatar: React.FC<{ friend: SocialFriend; size: number; ring?: boolean }> = ({ friend, size, ring }) => (
  <div className="relative shrink-0" style={{ width: size, height: size }}>
    <div
      className={`h-full w-full overflow-hidden rounded-[28%] bg-white/[0.06] ${ring ? "ring-2 ring-emerald-400/70" : ""} ${isOnline(friend) ? "" : "opacity-60"}`}
    >
      {friend.avatar ? (
        <img src={friend.avatar} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-white/45">
          <User style={{ width: size * 0.5, height: size * 0.5 }} />
        </div>
      )}
    </div>
    <span
      className={`absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-[#121216] ${presenceClass(friend)}`}
      style={{ width: Math.min(18, Math.max(10, size * 0.26)), height: Math.min(18, Math.max(10, size * 0.26)) }}
    />
  </div>
);

export interface FriendsRosterProps {
  friends: SocialFriend[];
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

const FILTERS: { id: RosterFilter; label: string }[] = [
  { id: "ALL", label: "Todos" },
  { id: "PLAYING", label: "Jogando" },
  { id: "ONLINE", label: "Online" },
  { id: "OFFLINE", label: "Offline" },
];

/**
 * Amigos no formato lista + painel (como Steam/Xbox): a lista agrupa por presença e o painel
 * da direita mostra o amigo selecionado com as ações. Cada linha é um botão, então o D-pad
 * percorre a lista e o painel pelo foco espacial normal.
 */
export const FriendsRoster: React.FC<FriendsRosterProps> = ({
  friends,
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
  const levels = useFriendLevels(friends);
  const q = search.trim().toLowerCase();
  const visible = useMemo(
    () =>
      friends.filter((f) => {
        if (q && !f.name.toLowerCase().includes(q) && !(f.playing ?? "").toLowerCase().includes(q)) return false;
        if (filter === "PLAYING") return f.status === "playing";
        if (filter === "ONLINE") return isOnline(f);
        if (filter === "OFFLINE") return f.status === "offline";
        return true;
      }),
    [friends, q, filter],
  );

  const groups = useMemo(
    () => [
      { id: "playing", title: "Jogando agora", items: visible.filter((f) => f.status === "playing") },
      { id: "online", title: "Online", items: visible.filter((f) => isOnline(f) && f.status !== "playing") },
      { id: "offline", title: "Offline", items: visible.filter((f) => !isOnline(f)) },
    ],
    [visible],
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  // mantém a seleção válida: se o amigo some do filtro, cai no primeiro da lista
  useEffect(() => {
    if (selectedId && visible.some((f) => f.id === selectedId)) return;
    setSelectedId(visible[0]?.id ?? null);
  }, [visible, selectedId]);

  const selected = visible.find((f) => f.id === selectedId) ?? null;
  const unread = (f: SocialFriend) => unreadByFriend[f.id.split(":")[1]] || 0;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(300px,380px)_1fr] lg:items-start">
      {/* Lista */}
      <section aria-label="Lista de amigos" className="flex flex-col gap-3 rounded-[22px] bg-[#121216] p-3 ring-1 ring-white/[0.07]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <input
            id="friends-search-input"
            aria-label="Buscar amigos"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar por nome ou jogo"
            className="h-10 w-full rounded-full bg-[#0d0d10] pl-10 pr-4 text-[13px] text-white outline-none placeholder:text-white/35 focus:ring-2 focus:ring-white/25"
          />
        </div>

        <div role="tablist" aria-label="Filtrar por presença" className="flex gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              role="tab"
              type="button"
              aria-selected={filter === f.id}
              onClick={() => {
                playSound?.("select");
                onFilterChange(f.id);
              }}
              className={`h-8 rounded-full px-3.5 text-[12px] font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-white/40 ${
                filter === f.id ? "bg-white text-black" : "bg-white/[0.07] text-white/65 hover:bg-white/[0.12] hover:text-white"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="max-h-[calc(100vh-22rem)] min-h-[16rem] overflow-y-auto pr-1 no-scrollbar">
          {visible.length === 0 ? (
            <p className="px-3 py-10 text-center text-[13px] text-white/45">
              Ninguém por aqui com esse filtro. Tente outro nome ou volte para Todos.
            </p>
          ) : (
            groups
              .filter((g) => g.items.length > 0)
              .map((g) => (
                <div key={g.id} className="mb-2">
                  <h3 className="sticky top-0 z-10 flex items-center gap-2 bg-[#121216] px-2 py-1.5 text-[12px] font-semibold text-white/55">
                    {g.title}
                    <span className="font-normal text-white/35">{g.items.length}</span>
                  </h3>
                  <ul className="flex flex-col gap-0.5">
                    {g.items.map((f) => {
                      const active = f.id === selectedId;
                      return (
                        <li key={f.id}>
                          <button
                            type="button"
                            aria-current={active}
                            onMouseEnter={() => playSound?.("hover")}
                            onClick={() => {
                              playSound?.("select");
                              setSelectedId(f.id);
                            }}
                            className={`group flex w-full items-center gap-3 rounded-2xl px-2.5 py-2 text-left transition-colors focus-visible:ring-2 focus-visible:ring-white/40 ${
                              active ? "bg-white/[0.11]" : "hover:bg-white/[0.06]"
                            }`}
                          >
                            <Avatar friend={f} size={40} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[14px] font-semibold text-white">{f.name}</span>
                              <span
                                className={`flex items-center gap-1 truncate text-[12px] ${
                                  f.status === "playing" ? "text-emerald-300" : "text-white/50"
                                }`}
                              >
                                {f.status === "playing" && <Gamepad2 className="h-3 w-3 shrink-0" />}
                                <span className="truncate">{statusLine(f)}</span>
                              </span>
                            </span>
                            {levels[f.id] && (
                              <span className="shrink-0 rounded-full bg-white/[0.08] px-2 py-0.5 text-[11px] font-semibold text-white/70">
                                Nv {levels[f.id]!.level}
                              </span>
                            )}
                            {unread(f) > 0 && (
                              <span className="min-w-5 rounded-full bg-white px-1.5 text-center text-[11px] font-bold leading-5 text-black">
                                {unread(f)}
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))
          )}
        </div>

        {discord && (
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#0d0d10] px-3.5 py-2.5 text-[13px]">
            <span className="text-white/65">
              {discord.connected ? "Discord conectado" : "Veja seus amigos do Discord aqui"}
            </span>
            {!discord.connected && (
              <button
                type="button"
                onClick={discord.onConnect}
                className="rounded-full bg-white px-3.5 py-1 text-[12px] font-semibold text-black active:scale-95 focus-visible:ring-2 focus-visible:ring-white/50"
              >
                Conectar
              </button>
            )}
          </div>
        )}
      </section>

      {/* Painel do amigo */}
      <section aria-label="Detalhes do amigo" className="relative min-h-[26rem] overflow-hidden rounded-[22px] bg-[#121216] ring-1 ring-white/[0.07]">
        {selected ? (
          <FriendPanel
            friend={selected}
            level={levels[selected.id]}
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
          <div className="flex min-h-[18rem] items-center justify-center px-8 text-center text-[14px] text-white/45">
            Selecione um amigo para conversar, ligar ou ver o perfil.
          </div>
        )}
      </section>
    </div>
  );
};

const FriendPanel: React.FC<{
  friend: SocialFriend;
  level: PlayerLevelInfo | null;
  unread: number;
  inCall: boolean;
  loading: boolean;
  onOpenChat: (f: SocialFriend) => void;
  onStartVoiceCall?: (f: SocialFriend, withVideo?: boolean) => void;
  onViewProfile: (f: SocialFriend) => void;
  onRemoveFriend: (f: SocialFriend) => void;
  playSound?: (t: SoundEffectType) => void;
}> = ({ friend, level, unread, inCall, loading, onOpenChat, onStartVoiceCall, onViewProfile, onRemoveFriend, playSound }) => {
  const [confirmRemove, setConfirmRemove] = useState(false);
  useEffect(() => setConfirmRemove(false), [friend.id]);
  const playing = friend.status === "playing";
  const seen = !isOnline(friend) ? formatLastSeen(friend.lastSeen) : "";

  const action =
    "inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-[13px] font-semibold transition-transform active:scale-[0.96] focus-visible:ring-2 focus-visible:ring-white/50";

  return (
    <div>
      {/* faixa: o próprio avatar desfocado dá a cor, o jogo atual aparece em destaque */}
      <div className="relative h-36 overflow-hidden">
        {friend.avatar && (
          <img
            src={friend.avatar}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full scale-125 object-cover opacity-45 blur-2xl"
          />
        )}
        <div
          className="absolute inset-0"
          style={{
            background: playing
              ? "linear-gradient(180deg, #123a2e, #121216)"
              : "linear-gradient(180deg, #1d1d24, #121216)",
          }}
        />
      </div>

      <div className="relative -mt-14 px-6 pb-6">
        <div className="flex items-end gap-4">
          <div className="relative">
            <Avatar friend={friend} size={96} ring={playing} />
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center rounded-[28%] bg-black/60">
                <Loader2 className="h-5 w-5 animate-spin text-white" />
              </div>
            )}
          </div>
          <div className="min-w-0 pb-1">
            <h2 className="truncate font-display text-[28px] font-bold leading-tight text-white">{friend.name}</h2>
            <p className={`flex items-center gap-1.5 text-[14px] ${playing ? "font-semibold text-emerald-300" : "text-white/60"}`}>
              {playing && <Gamepad2 className="h-4 w-4 shrink-0" />}
              <span className="truncate">{statusLine(friend)}</span>
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              playSound?.("select");
              onOpenChat(friend);
            }}
            className={`${action} bg-white text-black`}
          >
            <MessageSquare className="h-4 w-4" />
            Conversar
            {unread > 0 && <span className="rounded-full bg-black px-1.5 text-[11px] text-white">{unread}</span>}
          </button>
          {onStartVoiceCall && (
            <>
              <button
                type="button"
                onClick={() => onStartVoiceCall(friend, false)}
                className={`${action} ${inCall ? "animate-pulse bg-emerald-400 text-black" : "bg-white/[0.1] text-white hover:bg-white/[0.16]"}`}
              >
                <Phone className="h-4 w-4" />
                {inCall ? "Em chamada" : "Ligar"}
              </button>
              <button
                type="button"
                onClick={() => onStartVoiceCall(friend, true)}
                className={`${action} bg-white/[0.1] text-white hover:bg-white/[0.16]`}
              >
                <Video className="h-4 w-4" />
                Chamada de vídeo
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => {
              playSound?.("select");
              onViewProfile(friend);
            }}
            className={`${action} bg-white/[0.1] text-white hover:bg-white/[0.16]`}
          >
            Ver perfil
          </button>
        </div>

        <div className="mt-6 flex flex-wrap items-stretch gap-3">
          <div className="min-w-[15rem] flex-1 rounded-2xl bg-[#0d0d10] p-4">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[13px] text-white/45">Nível</p>
              {level && <p className="text-[12px] font-semibold" style={{ color: level.rankColor }}>{level.rank}</p>}
            </div>
            <p className="mt-0.5 font-display text-[34px] font-bold leading-none text-white">{level ? level.level : "—"}</p>
            {level && level.xpForNextLevel > 0 && (
              <div className="mt-3">
                <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.min(100, Math.max(0, level.progress))}%`, background: level.rankColor }}
                  />
                </div>
                <p className="mt-1.5 text-[12px] text-white/40">{Math.round(level.progress)}% para o próximo nível</p>
              </div>
            )}
            {!level && <p className="mt-2 text-[12px] text-white/40">O nível aparece quando o perfil do amigo carregar.</p>}
          </div>
          <dl className="grid min-w-[12rem] grid-cols-1 gap-3 rounded-2xl bg-[#0d0d10] p-4 text-[13px]">
            <div>
              <dt className="text-white/40">Origem</dt>
              <dd className="mt-0.5 font-semibold text-white">
                {friend.source === "checkpoint" ? "Pherielium" : friend.source?.startsWith("discord") ? "Discord" : "Local"}
              </dd>
            </div>
            {seen && (
              <div>
                <dt className="text-white/40">Última vez online</dt>
                <dd className="mt-0.5 font-semibold text-white">{seen}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="mt-6 border-t border-white/[0.07] pt-4">
          {confirmRemove ? (
            <div className="flex flex-wrap items-center gap-3 text-[13px]">
              <span className="text-white/70">Remover {friend.name} dos amigos?</span>
              <button
                type="button"
                onClick={() => onRemoveFriend(friend)}
                className="rounded-full bg-rose-500/90 px-4 py-1.5 font-semibold text-white hover:bg-rose-500"
              >
                Remover
              </button>
              <button type="button" onClick={() => setConfirmRemove(false)} className="text-white/55 hover:text-white">
                Cancelar
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmRemove(true)}
              className="inline-flex items-center gap-2 text-[13px] text-white/45 hover:text-rose-300"
            >
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
