-- friendships: o cliente (JWT de usuário) conseguia criar o pedido já como 'accepted' e o
-- solicitante conseguia aceitar o próprio pedido (as policies só checam "sou uma das partes").
-- O app grava amizades pela API (service role); este trigger só barra uso direto indevido.

create or replace function public.friendships_guard()
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

  if tg_op = 'INSERT' then
    if new.status is distinct from 'pending' then
      raise exception 'um pedido de amizade nasce pendente' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.requester_id is distinct from old.requester_id
     or new.addressee_id is distinct from old.addressee_id then
    raise exception 'as partes da amizade nao mudam' using errcode = '42501';
  end if;

  if new.status = 'accepted' and old.status is distinct from 'accepted' and v_uid <> old.addressee_id then
    raise exception 'somente quem recebeu o pedido pode aceitar' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists friendships_guard on public.friendships;
create trigger friendships_guard
  before insert or update on public.friendships
  for each row execute function public.friendships_guard();
