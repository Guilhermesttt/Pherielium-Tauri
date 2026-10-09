/**
 * Colunas de `profiles` que qualquer usuário autenticado pode ler (migration
 * 20261009110000_profiles_privacy). As sensíveis (e-mail, discord_id, discord_friends, steam_id,
 * retroachievements_*, location, last_steam_sync_at, onboarding_completed_at) só saem pelo RPC
 * `get_my_profile()`, que devolve a linha do próprio usuário.
 */
export const PUBLIC_PROFILE_COLUMNS = [
  "uid", "display_name", "photo_url", "banner_url", "bio", "pronouns", "website", "favorite_genres",
  "status", "playing", "presence_updated_at", "profile_visibility", "achievement_summary",
  "library_summary", "steam_username", "steam_avatar", "discord_username", "discord_avatar",
  "created_at", "updated_at",
].join(",");
