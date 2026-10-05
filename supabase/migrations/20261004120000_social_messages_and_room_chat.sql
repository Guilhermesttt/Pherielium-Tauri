-- Message actions on direct chats, and a text channel bound to each voice room.
-- Existing inserts keep working: the new chat columns are optional.

alter table public.chat_messages
  add column if not exists reply_to uuid,
  add column if not exists edited_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists mentions jsonb not null default '[]'::jsonb,
  add column if not exists reactions jsonb not null default '{}'::jsonb;

do $$
begin
  alter publication supabase_realtime add table public.chat_messages;
exception when duplicate_object then null;
end $$;

create table if not exists public.voice_room_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.voice_rooms(id) on delete cascade,
  sender_id uuid not null,
  sender_name text,
  text text not null default '',
  reply_to uuid,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists voice_room_messages_room_created_idx
  on public.voice_room_messages (room_id, created_at);

alter table public.voice_room_messages enable row level security;
grant select, insert, update on public.voice_room_messages to authenticated;

create or replace function public.is_voice_room_member(_room_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.voice_room_members
    where room_id = _room_id
      and user_id = _user_id
      and removed_at is null
  );
$$;

revoke all on function public.is_voice_room_member(uuid, uuid) from public;
grant execute on function public.is_voice_room_member(uuid, uuid) to authenticated;

drop policy if exists voice_room_messages_select on public.voice_room_messages;
drop policy if exists voice_room_messages_insert on public.voice_room_messages;
drop policy if exists voice_room_messages_update on public.voice_room_messages;

create policy voice_room_messages_select
  on public.voice_room_messages
  for select
  to authenticated
  using (public.is_voice_room_member(room_id, (select auth.uid())));

create policy voice_room_messages_insert
  on public.voice_room_messages
  for insert
  to authenticated
  with check (
    sender_id = (select auth.uid())
    and public.is_voice_room_member(room_id, (select auth.uid()))
  );

create policy voice_room_messages_update
  on public.voice_room_messages
  for update
  to authenticated
  using (public.is_voice_room_member(room_id, (select auth.uid())))
  with check (public.is_voice_room_member(room_id, (select auth.uid())));

do $$
begin
  alter publication supabase_realtime add table public.voice_room_messages;
exception when duplicate_object then null;
end $$;
