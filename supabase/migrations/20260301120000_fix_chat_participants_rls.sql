-- Fix infinite recursion in chat_participants RLS policies.
-- Policies were self-referencing chat_participants inside chat_participants checks.
-- Use the existing security definer helper instead.

create or replace function public.is_chat_participant(_chat_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from public.chat_participants
    where chat_id = _chat_id
      and user_id = _user_id
  );
$$;

revoke all on function public.is_chat_participant(uuid, uuid) from public;
grant execute on function public.is_chat_participant(uuid, uuid) to authenticated;

-- chat_participants
drop policy if exists chat_participants_select on public.chat_participants;
drop policy if exists chat_participants_insert on public.chat_participants;

create policy chat_participants_select
  on public.chat_participants
  for select
  to authenticated
  using (public.is_chat_participant(chat_id, (select auth.uid())));

create policy chat_participants_insert
  on public.chat_participants
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    or public.is_chat_participant(chat_id, (select auth.uid()))
  );

-- chats
drop policy if exists chats_select on public.chats;

create policy chats_select
  on public.chats
  for select
  to authenticated
  using (public.is_chat_participant(id, (select auth.uid())));

-- chat_messages (remove duplicate policies, keep one per operation)
drop policy if exists chat_messages_select on public.chat_messages;
drop policy if exists chat_messages_read_participant on public.chat_messages;
drop policy if exists chat_messages_insert on public.chat_messages;
drop policy if exists chat_messages_insert_sender on public.chat_messages;
drop policy if exists chat_messages_update on public.chat_messages;
drop policy if exists chat_messages_update_receiver on public.chat_messages;

create policy chat_messages_select
  on public.chat_messages
  for select
  to authenticated
  using (public.is_chat_participant(chat_id, (select auth.uid())));

create policy chat_messages_insert
  on public.chat_messages
  for insert
  to authenticated
  with check (
    sender_id = (select auth.uid())
    and public.is_chat_participant(chat_id, (select auth.uid()))
  );

create policy chat_messages_update
  on public.chat_messages
  for update
  to authenticated
  using (
    receiver_id = (select auth.uid())
    or sender_id = (select auth.uid())
  )
  with check (
    receiver_id = (select auth.uid())
    or sender_id = (select auth.uid())
  );
