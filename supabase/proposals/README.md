# Propostas de banco (NÃO aplicadas)

Estes itens **mudam o que o app consegue ler/gravar** e exigem ajuste no front junto. Por isso
ficam fora de `supabase/migrations` (o `supabase db push` não os aplica). Cada um tem o risco, o
que mudar no front e um rascunho de SQL. Aplique um por vez, em ambiente de teste primeiro.

Base: policies/índices/colunas exportados do banco em 2026-10-09.

## 1. `profiles` legível por qualquer um (inclusive `anon`) — PRIORIDADE ALTA
**Problema.** `profiles_select` é `USING (true)` para `anon` e `authenticated`. A tabela guarda
`email`, `discord_friends` (lista de amigos do Discord), `steam_id`, `discord_id`,
`retroachievements_*`, `location`, `profile_visibility`... Qualquer pessoa com a anon key (que vai
no app) consegue listar tudo com um `select *`.

**Front.** Hoje o app lê perfis de outros com colunas específicas (`AuthProvider.tsx:~190`:
`uid,display_name,photo_url,status,playing,presence_updated_at`), mas há `select("*")` em
`checkpointFriends.ts:434,472` e `AuthProvider.tsx:~350`. Com grants por coluna, `select *` falha
("permission denied for column"), então esses pontos precisam listar colunas.

**Rascunho (passo a passo).**
```sql
-- (a) tirar o anon
drop policy if exists profiles_select on public.profiles;           -- era anon + authenticated
-- profiles_select_all (authenticated) continua

-- (b) esconder colunas sensíveis dos outros usuários
revoke select on public.profiles from anon, authenticated;
grant select (uid, display_name, photo_url, banner_url, bio, pronouns, website, favorite_genres,
              status, playing, presence_updated_at, profile_visibility, achievement_summary,
              library_summary, created_at, updated_at)
  on public.profiles to authenticated;
-- email, discord_*, steam_*, retroachievements_*, location, onboarding..., last_steam_sync_at:
-- ficam só via RPC `get_my_profile()` (security definer, filtra por auth.uid()) ou service role.
```
Antes: criar `get_my_profile()` e trocar as leituras do próprio perfil por ela.

## 2. Qualquer usuário pode se colocar em qualquer chat
**Problema.** `chat_participants_insert` aceita `user_id = auth.uid()` para **qualquer** `chat_id`
(basta saber o UUID) e `chats_insert` é `WITH CHECK (true)`. Entrando como participante, a policy
de SELECT libera todas as mensagens do chat.

**Front.** Descobrir como os chats são criados (`ensureChatSession` em `chat.ts`; provável chamada à
API). Se a criação passa pela API (service role), basta derrubar o INSERT do cliente:
```sql
drop policy if exists chat_participants_insert on public.chat_participants;
drop policy if exists chats_insert on public.chats;
```
Se o cliente cria direto, é preciso um RPC `open_direct_chat(uid)` (security definer) antes.

## 3. Esconder `voice_rooms.password_hash`
**Problema.** `voice_rooms_select` entrega a linha inteira (inclusive o hash bcrypt) a quem lista
salas públicas, até `anon`. Dá para atacar a senha offline.

**Passos.** (1) `20261009100500_voice_rooms_has_password.sql` (já na pasta de migrations) cria
`has_password`. (2) Trocar `password_hash` por `has_password` em `voiceRooms.ts` (linhas 21, 57,
153 e a outra seleção ~186). (3) Revogar a coluna. Como o Supabase dá `SELECT` na tabela inteira,
é preciso listar as colunas permitidas — **falta exportar as colunas de `voice_rooms`** (a consulta
4 foi cortada). Rascunho:
```sql
revoke select on public.voice_rooms from anon, authenticated;
grant select (id, host_uid, room_name, category, is_private, has_password, icon, avatar_url,
              theme_color, max_participants, status, created_at /* + demais, exceto password_hash */)
  on public.voice_rooms to anon, authenticated;
```

## 4. Salas: vazamento de membros e edição de mensagens alheias
- `voice_room_members_select` é `true` para `anon`: lista quem está em salas **privadas**.
  Restringir exige funções `security definer` (`can_see_voice_room`) para não gerar recursão de RLS
  com `voice_rooms_select`.
- `voice_room_messages_update`: qualquer membro edita **qualquer** mensagem da sala. Falta um
  trigger igual ao `chat_messages_guard_update` (autor edita; outros só reagem).

## 5. XP e troféus escritos pelo cliente
`level_progress_upsert` (ALL), `xp_events_insert` e `user_trophies_upsert` (ALL) deixam o usuário
gravar o próprio XP, nível, tier e troféus: quem editar a requisição vira nível máximo. O modelo
atual confia no cliente. Caminho: mover a concessão de XP/troféu para RPC `security definer` (ou
para a API com service role), validar a conquista e remover o `ALL` do cliente. Mudança grande;
planejar junto com a unificação da regra de tier/XP (relatório, item 9).

## 6. Realtime privado
Os canais `user_inbox_*`, `user_calls_*` e `checkpoint_presence_bus` são públicos. Depende de
`private: true` no cliente + policies em `realtime.messages`. Ver o relatório (item 5).

## 7. Menores
- `pg_trgm` está no schema `public` (as funções `gin_*_trgm`/`gtrgm_*` aparecem em tudo): mover
  para o schema `extensions` (`alter extension pg_trgm set schema extensions;`) — confirmar que o
  índice `profiles_display_name_trgm` continua válido.
- `activities_select` libera linhas quando `audience_ids IS NULL`/vazio para **qualquer**
  autenticado: confirmar que "sem audiência" realmente significa público.
- `level_progress_select` é `true`: tudo bem para mostrar nível de amigos, mas expõe todos os
  usuários; avaliar limitar a amigos.
