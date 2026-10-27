-- Amigos do Discord que já têm conta no Pherielium.
--
-- O app já guarda a lista de amigos do Discord de quem conectou a conta (profiles.discord_friends).
-- Para o usuário poder ADICIONAR quem já está aqui (e CONVIDAR quem não está), o cliente precisa
-- cruzar esses ids com profiles.discord_id. Só que discord_id NÃO é legível por outros usuários
-- (20261009110000_profiles_privacy: grant de SELECT por coluna). Por isso o cruzamento acontece
-- dentro de um RPC security definer que devolve o mínimo: uid, discord_id, nome e foto.
--
-- Privacidade:
--   * perfis com profile_visibility = 'private' nunca são devolvidos;
--   * quem desligou "Ser encontrado pelos amigos do Discord" (discord_discoverable = false)
--     também não. O padrão é TRUE (opt-out): o laço já existe no Discord, e o RPC só responde
--     para ids que o chamador já tem na própria lista de amigos do Discord. Decisão em aberto
--     registrada em docs/discord-friends-discovery.md;
--   * o chamador nunca recebe a si mesmo;
--   * máximo de 200 ids por chamada (o excedente é ignorado), para não servir de varredura em massa.
--
-- Passo aditivo: uma coluna nova com default e uma função nova. Nada existente muda.

alter table public.profiles
  add column if not exists discord_discoverable boolean not null default true;

create or replace function public.match_discord_friends(p_discord_ids text[])
returns table (uid text, discord_id text, display_name text, photo_url text)
language sql
stable
security definer
set search_path = public
as $$
  select p.uid::text, p.discord_id::text, p.display_name::text, p.photo_url::text
  from public.profiles p
  where (select auth.uid()) is not null
    and p.discord_id = any (p_discord_ids[1:200])
    and p.uid::text <> (select auth.uid())::text
    and coalesce(p.profile_visibility, 'public') <> 'private'
    and p.discord_discoverable;
$$;

revoke all on function public.match_discord_friends(text[]) from public, anon;
grant execute on function public.match_discord_friends(text[]) to authenticated;

-- ROLLBACK:
--   drop function if exists public.match_discord_friends(text[]);
--   alter table public.profiles drop column if exists discord_discoverable;
