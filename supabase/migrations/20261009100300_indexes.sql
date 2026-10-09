-- Índices que faltavam (levantados a partir de pg_indexes e das consultas do app).
-- As tabelas são pequenas o bastante para criar sem CONCURRENTLY dentro da migration.

-- friendships: a PK é (requester_id, addressee_id), então buscar "pedidos que recebi" varria a tabela
create index if not exists idx_friendships_addressee_status on public.friendships (addressee_id, status);
create index if not exists idx_friendships_requester_status on public.friendships (requester_id, status);

-- chat_participants: PK (chat_id, user_id); "meus chats" filtra por user_id
create index if not exists idx_chat_participants_user on public.chat_participants (user_id);

-- chat_messages: mensagens não lidas por destinatário (badge/contagem)
create index if not exists idx_chat_messages_receiver_unread
  on public.chat_messages (receiver_id, created_at desc)
  where read is not true;

-- voice_room_members: "em qual sala estou?" e listagem de ativos por usuário
create index if not exists idx_voice_room_members_user_active
  on public.voice_room_members (user_id)
  where removed_at is null;

-- activities: a policy de SELECT usa auth.uid() = ANY(audience_ids)
create index if not exists idx_activities_audience_gin on public.activities using gin (audience_ids);
