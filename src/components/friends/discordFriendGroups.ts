import type { SocialFriend } from "../../types/domain";

/** Página pública de download do Pherielium (README.md, seção de links). */
export const PHERIELIUM_DOWNLOAD_URL = "https://pherielium.netlify.app/download";

/** Um perfil do Pherielium que o RPC `match_discord_friends` ligou a um amigo do Discord. */
export interface DiscordMatch {
  uid: string;
  discordId: string;
  displayName: string | null;
  photoURL: string | null;
}

/**
 * Situação de um amigo do Discord em relação ao Pherielium:
 * - `friend`: já é amigo aqui;
 * - `pending_out`: você já enviou o pedido;
 * - `pending_in`: ele enviou um pedido para você (aceitar na aba Solicitações);
 * - `addable`: tem conta e pode ser adicionado;
 * - `invite`: sem conta (ou conta que não quer ser encontrada): só dá para convidar.
 */
export type DiscordFriendState =
  | { kind: "friend"; uid: string }
  | { kind: "pending_out"; uid: string }
  | { kind: "pending_in"; uid: string }
  | { kind: "addable"; uid: string }
  | { kind: "invite" };

export interface DiscordFriendRelations {
  /** uids dos amigos do Pherielium */
  friendUids: ReadonlySet<string>;
  /** uids para quem você enviou pedido */
  outgoingUids: ReadonlySet<string>;
  /** uids que enviaram pedido para você */
  incomingUids: ReadonlySet<string>;
}

/** O id do Discord (snowflake) dentro de `discord-friend:<id>`. */
export const discordIdOf = (friend: SocialFriend): string | null => {
  const prefix = "discord-friend:";
  return friend.id.startsWith(prefix) ? friend.id.slice(prefix.length) : null;
};

const stateFor = (match: DiscordMatch | undefined, rel: DiscordFriendRelations): DiscordFriendState => {
  if (!match) return { kind: "invite" };
  if (rel.friendUids.has(match.uid)) return { kind: "friend", uid: match.uid };
  if (rel.outgoingUids.has(match.uid)) return { kind: "pending_out", uid: match.uid };
  if (rel.incomingUids.has(match.uid)) return { kind: "pending_in", uid: match.uid };
  return { kind: "addable", uid: match.uid };
};

export interface DiscordFriendGroups {
  /** situação de cada amigo do Discord, pelo `SocialFriend.id` */
  stateById: Record<string, DiscordFriendState>;
  friends: SocialFriend[];
  pending: SocialFriend[];
  addable: SocialFriend[];
  invite: SocialFriend[];
}

/** Agrupa os amigos do Discord pela situação deles no Pherielium. Ignora linhas que não são `discord_friend`. */
export function groupDiscordFriends(
  discordFriends: readonly SocialFriend[],
  matches: readonly DiscordMatch[],
  relations: DiscordFriendRelations,
): DiscordFriendGroups {
  const byDiscordId = new Map(matches.map((m) => [m.discordId, m]));
  const groups: DiscordFriendGroups = { stateById: {}, friends: [], pending: [], addable: [], invite: [] };

  for (const friend of discordFriends) {
    if (friend.source !== "discord_friend") continue;
    const discordId = discordIdOf(friend);
    if (!discordId) continue;
    const state = stateFor(byDiscordId.get(discordId), relations);
    groups.stateById[friend.id] = state;
    if (state.kind === "friend") groups.friends.push(friend);
    else if (state.kind === "pending_out" || state.kind === "pending_in") groups.pending.push(friend);
    else if (state.kind === "addable") groups.addable.push(friend);
    else groups.invite.push(friend);
  }
  return groups;
}

/**
 * Texto copiado ao "Convidar". O app não envia DM do Discord: a pessoa cola a mensagem no Discord.
 */
export const buildInviteMessage = (inviterName?: string | null): string => {
  const who = inviterName?.trim() ? `${inviterName.trim()} te chamou` : "Te chamei";
  return `${who} para o Pherielium, o launcher de jogos com amigos, chat e chamadas de voz. Baixe grátis em ${PHERIELIUM_DOWNLOAD_URL}`;
};
