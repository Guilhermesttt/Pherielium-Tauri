import type { Game, SocialFriend } from "../../types/domain";

/**
 * Quadro de jogos da aba Amigos: quem está jogando o quê vira o centro da tela (um launcher
 * é feito de jogos), em vez de uma lista de contatos. Funções puras, testadas à parte.
 */

const ONLINE = new Set(["online", "playing", "streaming", "in_call", "idle", "dnd"]);
export const isFriendOnline = (f: SocialFriend) => ONLINE.has(f.status);

const norm = (t: string) => t.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export interface GameGroup {
  /** título como o amigo informou */
  title: string;
  /** arte do jogo na biblioteca de quem está vendo (ou null) */
  art: string | null;
  friends: SocialFriend[];
}

/** Agrupa quem está jogando pelo jogo; os jogos mais cheios primeiro, depois por nome. */
export function groupPlaying(friends: readonly SocialFriend[], games: readonly Game[] = []): GameGroup[] {
  const byGame = new Map<string, GameGroup>();
  for (const f of friends) {
    if (f.status !== "playing") continue;
    const title = (f.playing || "Um jogo").trim() || "Um jogo";
    const key = norm(title) || "um jogo";
    let group = byGame.get(key);
    if (!group) {
      const match = games.find((g) => norm(g.title) === key);
      group = { title, art: match?.cardImage || match?.image || null, friends: [] };
      byGame.set(key, group);
    }
    group.friends.push(f);
  }
  return [...byGame.values()].sort((a, b) => b.friends.length - a.friends.length || a.title.localeCompare(b.title));
}

/** Matiz estável (0..359) a partir do título: cor de reserva quando o jogo não está na biblioteca. */
export function titleHue(title: string): number {
  let h = 0;
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) % 360;
  return h;
}

export interface BoardSections {
  playing: GameGroup[];
  online: SocialFriend[];
  offline: SocialFriend[];
}

export function buildBoard(friends: readonly SocialFriend[], games: readonly Game[] = []): BoardSections {
  return {
    playing: groupPlaying(friends, games),
    online: friends.filter((f) => isFriendOnline(f) && f.status !== "playing").sort((a, b) => a.name.localeCompare(b.name)),
    offline: friends.filter((f) => !isFriendOnline(f)).sort((a, b) => a.name.localeCompare(b.name)),
  };
}

/** "há 5 min", "há 3 h", "há 2 d"; vazio quando não há dado. */
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

export interface RailSections {
  playing: SocialFriend[];
  /** em uma chamada de voz: dá para chamar para a sua sala, mas não adianta convidar para jogar agora */
  inCall: SocialFriend[];
  online: SocialFriend[];
  /** offline, os vistos mais recentemente primeiro; entram na lista (dá para convidar e abrir o chat) */
  offline: SocialFriend[];
}

/**
 * Seções do painel de amigos: quem está jogando primeiro (é o que um launcher quer ver), depois quem
 * está em chamada e online, e por fim os offline (com quando foram vistos), para dar para chamar
 * qualquer amigo, esteja ele online ou não.
 */
const seenAt = (friend: SocialFriend): number => {
  const value = friend.lastSeen;
  if (value == null || value === "") return 0;
  const time = typeof value === "number" ? value : new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
};

export function railSections(friends: readonly SocialFriend[]): RailSections {
  const byName = (a: SocialFriend, b: SocialFriend) => a.name.localeCompare(b.name);
  const byRecentlySeen = (a: SocialFriend, b: SocialFriend) => seenAt(b) - seenAt(a) || byName(a, b);
  return {
    playing: friends.filter((f) => f.status === "playing").sort(byName),
    inCall: friends.filter((f) => f.status === "in_call").sort(byName),
    online: friends.filter((f) => isFriendOnline(f) && f.status !== "playing" && f.status !== "in_call").sort(byName),
    offline: friends.filter((f) => !isFriendOnline(f)).sort(byRecentlySeen),
  };
}
