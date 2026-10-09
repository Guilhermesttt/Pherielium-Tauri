-- profiles estava legível por qualquer um (inclusive anon) com todas as colunas: e-mail, lista de
-- amigos do Discord, steam_id, location... Agora:
--  1) anon não lê mais profiles (a página pública usa public_profiles);
--  2) authenticated lê só as colunas públicas;
--  3) o próprio usuário lê a linha inteira pelo RPC get_my_profile().
-- DEPLOY: publique o front novo junto (ele troca select("*") por colunas explícitas e pelo RPC).
-- ROLLBACK: grant select on public.profiles to anon, authenticated;

create or replace function public.get_my_profile()
returns setof public.profiles
language sql
stable
security definer
set search_path = public
as $$
  select * from public.profiles where uid = (select auth.uid());
$$;

revoke all on function public.get_my_profile() from public, anon;
grant execute on function public.get_my_profile() to authenticated;

drop policy if exists profiles_select on public.profiles; -- anon + authenticated
-- profiles_select_all (authenticated, true) permanece

revoke select on public.profiles from anon, authenticated;
grant select (
  uid, display_name, photo_url, banner_url, bio, pronouns, website, favorite_genres,
  status, playing, presence_updated_at, profile_visibility, achievement_summary,
  library_summary, steam_username, steam_avatar, discord_username, discord_avatar,
  created_at, updated_at
) on public.profiles to authenticated;
