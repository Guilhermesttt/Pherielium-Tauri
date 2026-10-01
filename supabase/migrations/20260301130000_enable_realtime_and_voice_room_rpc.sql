-- Enable postgres_changes for friendships, voice rooms, and chat metadata.
-- Calls/presence also use Broadcast channels; this fixes table-driven sync.

do $$
begin
  alter publication supabase_realtime add table public.friendships;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.voice_rooms;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.voice_room_members;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.chats;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.chat_participants;
exception when duplicate_object then null;
end $$;

-- Supabase-native voice room create/join (fallback when Render API is unavailable).
create or replace function public.create_voice_room(
  p_room_name text,
  p_category text default 'resenha_games',
  p_is_private boolean default false,
  p_password text default null,
  p_icon text default '🎮',
  p_avatar_url text default null,
  p_theme_color text default '#8B5CF6',
  p_max_participants smallint default 10
)
returns public.voice_rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_room public.voice_rooms;
  v_display_name text;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if coalesce(trim(p_room_name), '') = '' then
    raise exception 'nome da sala obrigatorio';
  end if;

  select coalesce(nullif(trim(display_name), ''), 'Jogador')
  into v_display_name
  from public.profiles
  where uid = v_uid;

  insert into public.voice_rooms (
    host_uid,
    room_name,
    category,
    is_private,
    password_hash,
    icon,
    avatar_url,
    theme_color,
    max_participants,
    status
  )
  values (
    v_uid,
    trim(p_room_name),
    coalesce(nullif(trim(p_category), ''), 'resenha_games'),
    coalesce(p_is_private, false),
    case
      when coalesce(trim(p_password), '') = '' then null
      else crypt(trim(p_password), gen_salt('bf'))
    end,
    coalesce(nullif(trim(p_icon), ''), '🎮'),
    p_avatar_url,
    coalesce(nullif(trim(p_theme_color), ''), '#8B5CF6'),
    greatest(2, least(coalesce(p_max_participants, 10), 50)),
    'active'
  )
  returning * into v_room;

  insert into public.voice_room_members (room_id, user_id, display_name, avatar_url)
  values (v_room.id, v_uid, v_display_name, (select photo_url from public.profiles where uid = v_uid))
  on conflict (room_id, user_id) do update
    set display_name = excluded.display_name,
        avatar_url = excluded.avatar_url,
        joined_at = now(),
        removed_at = null;

  return v_room;
end;
$$;

create or replace function public.join_voice_room(
  p_room_id uuid,
  p_password text default '',
  p_display_name text default null,
  p_avatar_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
    and status = 'active';

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
$$;

revoke all on function public.create_voice_room(text, text, boolean, text, text, text, text, smallint) from public;
revoke all on function public.join_voice_room(uuid, text, text, text) from public;
grant execute on function public.create_voice_room(text, text, boolean, text, text, text, text, smallint) to authenticated;
grant execute on function public.join_voice_room(uuid, text, text, text) to authenticated;
