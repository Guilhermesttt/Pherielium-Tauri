-- Salas de voz.
-- 1) INSERT direto em voice_room_members pulava a senha e o limite de participantes do RPC
--    join_voice_room. O app só entra por RPC (security definer), então a policy de INSERT sai.
-- 2) Quem foi removido (removed_at preenchido) conseguia se "re-adicionar" com UPDATE na própria
--    linha. Agora o próprio usuário só atualiza a linha enquanto está ativo (por ex. para sair).
-- 3) join_voice_room contava e inseria sem lock: entradas simultâneas estouravam max_participants.
--    O FOR UPDATE na sala serializa as entradas daquela sala.

drop policy if exists voice_room_members_insert on public.voice_room_members;

drop policy if exists voice_room_members_update on public.voice_room_members;
create policy voice_room_members_update
  on public.voice_room_members
  for update
  to authenticated
  using (
    (user_id = (select auth.uid()) and removed_at is null)
    or exists (
      select 1 from public.voice_rooms r
      where r.id = voice_room_members.room_id and r.host_uid = (select auth.uid())
    )
  )
  with check (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.voice_rooms r
      where r.id = voice_room_members.room_id and r.host_uid = (select auth.uid())
    )
  );

create or replace function public.join_voice_room(
  p_room_id uuid,
  p_password text default ''::text,
  p_display_name text default null::text,
  p_avatar_url text default null::text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_room public.voice_rooms;
  v_count integer;
  v_participants jsonb;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select * into v_room
  from public.voice_rooms
  where id = p_room_id
    and status = 'active'
  for update;

  if not found then
    raise exception 'sala nao encontrada';
  end if;

  if v_room.password_hash is not null then
    if coalesce(trim(p_password), '') = ''
       or v_room.password_hash <> crypt(trim(p_password), v_room.password_hash) then
      raise exception 'senha incorreta';
    end if;
  elsif v_room.is_private and v_room.host_uid <> v_uid then
    raise exception 'sala privada';
  end if;

  select count(*)::integer into v_count
  from public.voice_room_members
  where room_id = p_room_id
    and removed_at is null;

  if v_count >= v_room.max_participants
     and not exists (
       select 1 from public.voice_room_members
       where room_id = p_room_id and user_id = v_uid and removed_at is null
     ) then
    raise exception 'sala cheia';
  end if;

  insert into public.voice_room_members (room_id, user_id, display_name, avatar_url)
  values (
    p_room_id,
    v_uid,
    coalesce(nullif(trim(p_display_name), ''), 'Jogador'),
    p_avatar_url
  )
  on conflict (room_id, user_id) do update
    set display_name = excluded.display_name,
        avatar_url = excluded.avatar_url,
        joined_at = now(),
        removed_at = null;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'uid', m.user_id,
      'name', m.display_name,
      'avatar', m.avatar_url,
      'joinedAt', m.joined_at
    )
  ), '[]'::jsonb)
  into v_participants
  from public.voice_room_members m
  where m.room_id = p_room_id
    and m.removed_at is null;

  return jsonb_build_object(
    'room', to_jsonb(v_room),
    'participants', v_participants
  );
end;
$function$;
