import type { SocialFriend } from "../../types/domain";
import type { CallRoomConfig, RoomCategory } from "../../types/voice-governance";
import type { SfSymbolName } from "../../design-system/sf-symbols";
import type { NightKind } from "../../services/voiceCall/channelInvite";
import { MAX_CALL_PARTICIPANTS } from "../../services/voiceCall/limits";

/**
 * Noites: escolher o tipo (jogo, cinema, resenha), convidar amigos e abrir uma sala de voz.
 * Na noite de jogo a sala fica ligada ao jogo escolhido. Regras puras (sem React nem rede) para
 * serem testadas à parte.
 */

export interface NightKindInfo {
  id: NightKind;
  /** rótulo curto do seletor */
  label: string;
  /** como a noite se chama no nome da sala e no aviso ao amigo */
  roomLabel: string;
  /** emoji da sala nas listas de canais de voz */
  icon: string;
  /** ícone do seletor de tipo (SF Symbols) */
  symbol: SfSymbolName;
  category: RoomCategory;
  /** a noite gira em torno de um jogo da biblioteca */
  needsGame: boolean;
  /** campo livre ("o que vão assistir?"); só nas noites sem jogo */
  subjectPlaceholder?: string;
}

export const NIGHT_KINDS: readonly NightKindInfo[] = [
  { id: "game", label: "Jogos", roomLabel: "Noite de jogo", icon: "🎮", symbol: "gamecontroller", category: "resenha_games", needsGame: true },
  { id: "movie", label: "Cinema", roomLabel: "Noite de cinema", icon: "🎬", symbol: "tv", category: "casual_chat", needsGame: false, subjectPlaceholder: "O que vão assistir? (opcional)" },
  { id: "chat", label: "Resenha", roomLabel: "Noite de resenha", icon: "💬", symbol: "bubble.left.and.bubble.right", category: "casual_chat", needsGame: false, subjectPlaceholder: "Sobre o quê? (opcional)" },
];

export const nightKindInfo = (kind: NightKind): NightKindInfo =>
  NIGHT_KINDS.find((info) => info.id === kind) ?? NIGHT_KINDS[0];

const ROOM_NAME_MAX = 40;

const norm = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Nome da sala, no limite do servidor; o assunto (jogo, filme...) é cortado, nunca o prefixo. */
export function nightRoomName(kind: NightKind, subject = ""): string {
  const info = nightKindInfo(kind);
  const text = subject.trim() || (info.needsGame ? "jogo" : "");
  if (!text) return info.roomLabel;
  const room = `${info.roomLabel}: ${text}`;
  if (room.length <= ROOM_NAME_MAX) return room;
  return `${room.slice(0, ROOM_NAME_MAX - 1).trimEnd()}…`;
}

export const gameNightRoomName = (gameTitle: string) => nightRoomName("game", gameTitle);

export interface GameNightOptions {
  /** padrão: noite de jogo */
  kind?: NightKind;
  /** jogo, filme, matéria... */
  subject?: string;
  /** o mesmo que `subject`, mantido para a noite de jogo */
  gameTitle?: string;
  isPrivate?: boolean;
  password?: string;
  hostName?: string;
}

/** Configuração da sala. Privada exige senha (regra do servidor); sem senha, vira pública. */
export function gameNightRoomConfig(options: GameNightOptions): CallRoomConfig {
  const wantsPrivate = Boolean(options.isPrivate && options.password?.trim());
  const kind = options.kind ?? "game";
  const info = nightKindInfo(kind);
  return {
    roomName: nightRoomName(kind, options.subject ?? options.gameTitle ?? ""),
    category: info.category,
    isPrivate: wantsPrivate,
    password: wantsPrivate ? options.password!.trim() : undefined,
    icon: info.icon,
    description: options.hostName ? `${info.roomLabel} de ${options.hostName}` : info.roomLabel,
  };
}

const ONLINE = new Set(["online", "playing", "streaming", "in_call", "idle", "dnd"]);

/** Só amigos do Pherielium recebem o cartão no chat; amigos do Discord ficam de fora. */
export const isInviteable = (friend: SocialFriend) => friend.source === "checkpoint" || friend.id.startsWith("checkpoint:");

/** UID do amigo no chat (o `id` vem como `checkpoint:<uid>`). */
export const friendUid = (friend: SocialFriend) => (friend.id.includes(":") ? friend.id.split(":")[1] : friend.id);

export interface InviteeList {
  /** já jogando o jogo escolhido: sugeridos e pré-marcados */
  playingIt: SocialFriend[];
  /** online, mas fazendo outra coisa */
  online: SocialFriend[];
  /** offline: também dá para convidar; o cartão espera no chat até a pessoa voltar */
  offline: SocialFriend[];
}

/** Separa os amigos convidáveis em quem já joga o título, quem está online e quem está offline. */
export function groupInvitees(friends: readonly SocialFriend[], gameTitle: string): InviteeList {
  const wanted = norm(gameTitle);
  const byName = (a: SocialFriend, b: SocialFriend) => a.name.localeCompare(b.name);
  const result: InviteeList = { playingIt: [], online: [], offline: [] };
  for (const friend of friends.filter(isInviteable)) {
    if (!ONLINE.has(friend.status)) result.offline.push(friend);
    else if (friend.status === "playing" && wanted && norm(friend.playing ?? "") === wanted) result.playingIt.push(friend);
    else result.online.push(friend);
  }
  result.playingIt.sort(byName);
  result.online.sort(byName);
  result.offline.sort(byName);
  return result;
}

/** O anfitrião ocupa uma vaga: dá para convidar no máximo `limite - 1` amigos. */
export const maxInvitees = (limit = MAX_CALL_PARTICIPANTS) => Math.max(0, limit - 1);

/** Marca/desmarca respeitando o limite de vagas; acima dele, a seleção não cresce. */
export function toggleInvitee(selected: readonly string[], uid: string, limit = maxInvitees()): string[] {
  if (selected.includes(uid)) return selected.filter((id) => id !== uid);
  if (selected.length >= limit) return [...selected];
  return [...selected, uid];
}
