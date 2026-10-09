-- chat_messages: a policy de UPDATE deixa remetente E destinatário alterarem qualquer coluna
-- (inclusive o texto da mensagem do outro). A regra "só o remetente edita/apaga" vivia só no cliente.
-- Este trigger a aplica no banco. Chamadas sem JWT de usuário (service role, SQL direto) passam.

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
     or new.reply_to    is distinct from old.reply_to then
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

drop trigger if exists chat_messages_guard_update on public.chat_messages;
create trigger chat_messages_guard_update
  before update on public.chat_messages
  for each row execute function public.chat_messages_guard_update();
