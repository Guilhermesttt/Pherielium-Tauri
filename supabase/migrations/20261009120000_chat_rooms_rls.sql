-- Fecha brechas de RLS em chats e salas de voz. O app só cria chats pela API (service role) e entra
-- em salas por RPC, então estas policies de escrita direta nunca foram necessárias.
-- ROLLBACK (por item) no fim deste arquivo.

-- 1) Chats: qualquer usuário podia se inserir como participante de QUALQUER chat (bastava o UUID) e,
--    sendo participante, lia todas as mensagens. Também criava chats à vontade (WITH CHECK true).
drop policy if exists chat_participants_insert on public.chat_participants;
drop policy if exists chats_insert on public.chats;

-- 2) Mensagens de sala: qualquer membro editava QUALQUER mensagem. Agora só o autor.
drop policy if exists voice_room_messages_update on public.voice_room_messages;
create policy voice_room_messages_update
  on public.voice_room_messages
  for update
  to authenticated
  using (sender_id = (select auth.uid()) and public.is_voice_room_member(room_id, (select auth.uid())))
  with check (sender_id = (select auth.uid()));

-- 3) Membros de salas: eram públicos (inclusive anon), expondo quem está em salas privadas.
--    Função security definer evita recursão de RLS entre voice_rooms e voice_room_members.
create or replace function public.can_view_voice_room(_room_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.voice_rooms r
    where r.id = _room_id
      and (
        (r.status = 'active' and r.is_private = false)
        or r.host_uid = _user_id
        or exists (
          select 1 from public.voice_room_members m
          where m.room_id = r.id and m.user_id = _user_id and m.removed_at is null
        )
      )
  );
$$;
revoke all on function public.can_view_voice_room(uuid, uuid) from public, anon;
grant execute on function public.can_view_voice_room(uuid, uuid) to authenticated;

drop policy if exists voice_room_members_select on public.voice_room_members;
create policy voice_room_members_select
  on public.voice_room_members
  for select
  to authenticated
  using (public.can_view_voice_room(room_id, (select auth.uid())));

-- 4) password_hash de voice_rooms não sai mais para o cliente (o app usa has_password).
--    Concede SELECT em todas as colunas, menos o hash, e tira o anon da tabela.
do $$
declare
  cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'voice_rooms' and column_name <> 'password_hash';

  execute 'revoke select on public.voice_rooms from anon, authenticated';
  execute format('grant select (%s) on public.voice_rooms to authenticated', cols);
end $$;

drop policy if exists voice_rooms_select on public.voice_rooms;
create policy voice_rooms_select
  on public.voice_rooms
  for select
  to authenticated
  using (public.can_view_voice_room(id, (select auth.uid())));

-- NOTA: o Realtime (postgres_changes) em voice_rooms ainda pode entregar a linha completa, hash
-- incluído. O ideal é mover password_hash para uma tabela própria sem publicação realtime.

-- ROLLBACK:
--  create policy chat_participants_insert on public.chat_participants for insert to authenticated
--    with check (user_id = (select auth.uid()) or public.is_chat_participant(chat_id, (select auth.uid())));
--  create policy chats_insert on public.chats for insert to authenticated with check (true);
--  grant select on public.voice_rooms to anon, authenticated;
--  (e recrie voice_room_members_select / voice_rooms_select / voice_room_messages_update antigas)
