-- Personalização de salas de voz: descrição, banner e edição segura pelo host.
-- 1) colunas novas  2) bucket de imagens  3) RPC update_voice_room (host; a senha é re-hasheada no
-- banco, e o hash nunca sai).  O front antigo continua funcionando (colunas opcionais).

alter table public.voice_rooms add column if not exists description text;
alter table public.voice_rooms add column if not exists banner_url text;
alter table public.voice_rooms drop constraint if exists voice_rooms_description_len;
alter table public.voice_rooms
  add constraint voice_rooms_description_len check (description is null or char_length(description) <= 200);

-- as colunas de voice_rooms têm GRANT por coluna (password_hash escondido): libera as novas
grant select (description, banner_url) on public.voice_rooms to authenticated;

-- imagens das salas (banner e ícone): leitura pública, escrita só na pasta do próprio usuário
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('voice-room-media', 'voice-room-media', true, 10485760,
        array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "voice-room-media public read" on storage.objects;
create policy "voice-room-media public read"
  on storage.objects for select using (bucket_id = 'voice-room-media');

drop policy if exists "voice-room-media owner insert" on storage.objects;
create policy "voice-room-media owner insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'voice-room-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "voice-room-media owner delete" on storage.objects;
create policy "voice-room-media owner delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'voice-room-media' and (storage.foldername(name))[1] = auth.uid()::text);

-- edição pelo host. Campos nulos = não muda. p_clear_password remove a senha.
create or replace function public.update_voice_room(
  p_room_id uuid,
  p_name text default null,
  p_category text default null,
  p_is_private boolean default null,
  p_password text default null,
  p_clear_password boolean default false,
  p_icon text default null,
  p_avatar_url text default null,
  p_theme_color text default null,
  p_description text default null,
  p_banner_url text default null,
  p_clear_banner boolean default false
)
returns public.voice_rooms
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_uid uuid := auth.uid();
  v_room public.voice_rooms;
  v_private boolean;
  v_has_pw boolean;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  select * into v_room from public.voice_rooms
  where id = p_room_id and host_uid = v_uid and status = 'active'
  for update;
  if not found then raise exception 'sala nao encontrada ou voce nao e o dono'; end if;

  if p_name is not null and char_length(trim(p_name)) = 0 then
    raise exception 'nome da sala obrigatorio';
  end if;
  if p_description is not null and char_length(p_description) > 200 then
    raise exception 'descricao muito longa (maximo 200)';
  end if;

  v_private := coalesce(p_is_private, v_room.is_private);
  v_has_pw := case
    when p_clear_password then false
    when coalesce(trim(p_password), '') <> '' then true
    else v_room.password_hash is not null
  end;
  if v_private and not v_has_pw then
    raise exception 'sala privada exige uma senha';
  end if;

  update public.voice_rooms r set
    room_name = coalesce(nullif(trim(p_name), ''), r.room_name),
    category = coalesce(nullif(trim(p_category), ''), r.category),
    is_private = v_private,
    password_hash = case
      when p_clear_password then null
      when coalesce(trim(p_password), '') <> '' then crypt(trim(p_password), gen_salt('bf'))
      else r.password_hash end,
    icon = coalesce(nullif(trim(p_icon), ''), r.icon),
    avatar_url = coalesce(p_avatar_url, r.avatar_url),
    theme_color = coalesce(nullif(trim(p_theme_color), ''), r.theme_color),
    description = case when p_description is null then r.description else nullif(trim(p_description), '') end,
    banner_url = case when p_clear_banner then null else coalesce(p_banner_url, r.banner_url) end,
    updated_at = now()
  where r.id = p_room_id
  returning * into v_room;

  return v_room;
end;
$function$;

revoke all on function public.update_voice_room(uuid, text, text, boolean, text, boolean, text, text, text, text, text, boolean) from public, anon;
grant execute on function public.update_voice_room(uuid, text, text, boolean, text, boolean, text, text, text, text, text, boolean) to authenticated;
