-- "function gen_salt(unknown) does not exist": no Supabase o pgcrypto fica no schema `extensions`,
-- mas create_voice_room/join_voice_room fixavam search_path = public, então crypt()/gen_salt()
-- não eram encontradas. Corrige o search_path e mantém o resto igual.
-- Obs.: join_voice_room (migration 20261009100200) tinha o mesmo problema ao validar senha.

create extension if not exists pgcrypto with schema extensions;

create or replace function public.create_voice_room(
  p_room_name text,
  p_category text default 'resenha_games'::text,
  p_is_private boolean default false,
  p_password text default null::text,
  p_icon text default '🎮'::text,
  p_avatar_url text default null::text,
  p_theme_color text default '#8B5CF6'::text,
  p_max_participants smallint default 10
)
returns public.voice_rooms
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_uid uuid := auth.uid();
  v_room public.voice_rooms;
  v_display_name text;
  v_has_password boolean := coalesce(trim(p_password), '') <> '';
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if coalesce(trim(p_room_name), '') = '' then
    raise exception 'nome da sala obrigatorio';
  end if;

  -- sala privada exige senha (só entra quem a souber)
  if coalesce(p_is_private, false) and not v_has_password then
    raise exception 'sala privada exige uma senha';
  end if;

  select coalesce(nullif(trim(display_name), ''), 'Jogador')
  into v_display_name
  from public.profiles
  where uid = v_uid;

  insert into public.voice_rooms (
    host_uid, room_name, category, is_private, password_hash, icon, avatar_url,
    theme_color, max_participants, status
  )
  values (
    v_uid,
    trim(p_room_name),
    coalesce(nullif(trim(p_category), ''), 'resenha_games'),
    coalesce(p_is_private, false),
    case when v_has_password then crypt(trim(p_password), gen_salt('bf')) else null end,
    coalesce(nullif(trim(p_icon), ''), '🎮'),
    p_avatar_url,
    coalesce(nullif(trim(p_theme_color), ''), '#8B5CF6'),
    greatest(2, least(coalesce(p_max_participants, 10), 10)),
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
$function$;

revoke all on function public.create_voice_room(text, text, boolean, text, text, text, text, smallint) from public, anon;
grant execute on function public.create_voice_room(text, text, boolean, text, text, text, text, smallint) to authenticated;

alter function public.join_voice_room(uuid, text, text, text) set search_path to 'public', 'extensions';
