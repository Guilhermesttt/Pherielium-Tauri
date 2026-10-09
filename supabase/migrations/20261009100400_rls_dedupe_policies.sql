-- Policies duplicadas (somam por OR, só custam avaliação extra) e uma versão mais fraca que
-- vencia a mais forte. Mantém a versão com (select auth.uid()) (avaliada uma vez por consulta).

-- friendships: pares idênticos
drop policy if exists friendships_delete_participant on public.friendships;
drop policy if exists friendships_select_participant on public.friendships;
drop policy if exists friendships_update_participant on public.friendships;

-- friendships INSERT: a versão "_requester" é a mais forte (barra pedir amizade a si mesmo), mas a
-- fraca somava por OR e anulava a regra. Fica uma só, com os dois checks.
drop policy if exists friendships_insert_requester on public.friendships;
drop policy if exists friendships_insert on public.friendships;
create policy friendships_insert
  on public.friendships
  for insert
  to authenticated
  with check (
    requester_id = (select auth.uid())
    and addressee_id <> (select auth.uid())
  );

-- profiles: INSERT/UPDATE em duplicidade
drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;

-- public_profiles: dois SELECT idênticos
drop policy if exists public_profiles_read_related on public.public_profiles;

-- notification_preferences: _all (ALL) já cobre as três específicas; recria com initplan
drop policy if exists notification_preferences_insert on public.notification_preferences;
drop policy if exists notification_preferences_select on public.notification_preferences;
drop policy if exists notification_preferences_update on public.notification_preferences;
drop policy if exists notification_preferences_all on public.notification_preferences;
create policy notification_preferences_all
  on public.notification_preferences
  for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
