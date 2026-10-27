import { supabase } from "./supabase";
import type { DiscordMatch } from "../components/friends/discordFriendGroups";

/** Limite do RPC `match_discord_friends` por chamada (o servidor ignora o excedente). */
export const MATCH_DISCORD_BATCH_SIZE = 200;

interface MatchRow {
  uid?: unknown;
  discord_id?: unknown;
  display_name?: unknown;
  photo_url?: unknown;
}

/** Valida uma linha do RPC na borda; linhas malformadas são descartadas. */
export const parseMatchRows = (rows: unknown): DiscordMatch[] => {
  if (!Array.isArray(rows)) return [];
  const matches: DiscordMatch[] = [];
  for (const row of rows as MatchRow[]) {
    if (typeof row?.uid !== "string" || typeof row.discord_id !== "string") continue;
    matches.push({
      uid: row.uid,
      discordId: row.discord_id,
      displayName: typeof row.display_name === "string" ? row.display_name : null,
      photoURL: typeof row.photo_url === "string" ? row.photo_url : null,
    });
  }
  return matches;
};

/** Quais destes ids do Discord têm conta (visível) no Pherielium. Perfis privados ou que optaram por sair não voltam. */
export const matchDiscordFriends = async (discordIds: readonly string[]): Promise<DiscordMatch[]> => {
  const unique = [...new Set(discordIds.filter(Boolean))];
  const matches: DiscordMatch[] = [];
  for (let i = 0; i < unique.length; i += MATCH_DISCORD_BATCH_SIZE) {
    const { data, error } = await supabase.rpc("match_discord_friends", {
      p_discord_ids: unique.slice(i, i + MATCH_DISCORD_BATCH_SIZE),
    });
    if (error) throw error;
    matches.push(...parseMatchRows(data));
  }
  return matches;
};

/** Liga/desliga "ser encontrado pelos amigos do Discord" no próprio perfil. */
export const saveDiscordDiscoverable = async (discoverable: boolean): Promise<boolean> => {
  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user.id;
  if (!uid) throw new Error("Faça login novamente para alterar a privacidade.");
  const { data, error } = await supabase
    .from("profiles")
    .update({ discord_discoverable: discoverable })
    .eq("uid", uid)
    .select("discord_discoverable")
    .single();
  if (error) throw error;
  return data?.discord_discoverable !== false;
};
