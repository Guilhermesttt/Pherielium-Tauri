-- Identidade de cliente para mensagens de chat.
--
-- Toda mensagem chega ao destinatário duas vezes: primeiro pelo broadcast
-- (caminho rápido, id temporário gerado no cliente) e depois pelo INSERT
-- replicado do Postgres (id definitivo). Sem um identificador comum, o cliente
-- parea os dois por heurística -- "mesmo autor e mesmo texto dentro de 15s".
-- Isso erra dos dois lados: com o banco lento a janela estoura e a mensagem
-- aparece duplicada; duas mensagens idênticas enviadas em sequência são
-- fundidas numa só.
--
-- `client_id` é gerado pelo remetente antes de qualquer ida à rede e viaja nos
-- dois caminhos, então o pareamento passa a ser exato.

alter table public.chat_messages
  add column if not exists client_id text;

-- Reenvio da mesma mensagem (retry de rede, clique duplo) vira no-op em vez de
-- uma segunda linha. Parcial: linhas antigas e qualquer insert sem client_id
-- ficam de fora do índice.
create unique index if not exists chat_messages_chat_client_id_uniq
  on public.chat_messages (chat_id, client_id)
  where client_id is not null;

comment on column public.chat_messages.client_id is
  'Id gerado pelo remetente, usado para parear o broadcast rápido com a linha persistida. Imutável após o insert.';

-- `client_id` entra na lista de colunas que o cliente nunca pode alterar depois
-- do insert: ele é a âncora do pareamento e de novo-ou-repetido.
create or replace function public.chat_messages_guard_update()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return new; -- backend/service role
  end if;

  -- identidade e posição da mensagem nunca mudam pelo cliente
  if new.id          is distinct from old.id
     or new.chat_id     is distinct from old.chat_id
     or new.sender_id   is distinct from old.sender_id
     or new.receiver_id is distinct from old.receiver_id
     or new.created_at  is distinct from old.created_at
     or new.sequence_id is distinct from old.sequence_id
     or new.reply_to    is distinct from old.reply_to
     or new.client_id   is distinct from old.client_id then
    raise exception 'campo imutavel da mensagem' using errcode = '42501';
  end if;

  if v_uid = old.sender_id then
    return new; -- o autor pode editar/apagar o próprio conteúdo
  end if;

  -- destinatário: só marca como lida e reage
  if new.text            is distinct from old.text
     or new.edited_at       is distinct from old.edited_at
     or new.deleted_at      is distinct from old.deleted_at
     or new.mentions        is distinct from old.mentions
     or new.attachment_name is distinct from old.attachment_name
     or new.attachment_url  is distinct from old.attachment_url
     or new.attachment_type is distinct from old.attachment_type
     or new.attachment_size is distinct from old.attachment_size
     or new.attachment_path is distinct from old.attachment_path then
    raise exception 'apenas o autor pode editar ou apagar a mensagem' using errcode = '42501';
  end if;

  return new;
end;
$$;
