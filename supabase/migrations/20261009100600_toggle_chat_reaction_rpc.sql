-- Reação atômica. O cliente lia o jsonb de reações, mexia e gravava de volta: duas reações
-- simultâneas na mesma mensagem se sobrescreviam. Aqui é um único UPDATE por linha.
-- Formato preservado: { "😀": ["uid1", "uid2"] }. Security invoker: valem a RLS e o trigger de guarda.

create or replace function public.toggle_chat_reaction(p_message_id uuid, p_emoji text)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_me jsonb;
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if p_emoji is null or length(trim(p_emoji)) = 0 or length(p_emoji) > 16 then
    raise exception 'emoji invalido';
  end if;
  v_me := to_jsonb(v_uid::text);

  update public.chat_messages m
  set reactions = case
    when coalesce(m.reactions -> p_emoji, '[]'::jsonb) @> jsonb_build_array(v_me) then
      case
        when jsonb_array_length(coalesce(m.reactions -> p_emoji, '[]'::jsonb)) <= 1
          then m.reactions - p_emoji
        else jsonb_set(
          m.reactions,
          array[p_emoji],
          (select coalesce(jsonb_agg(e), '[]'::jsonb)
             from jsonb_array_elements(m.reactions -> p_emoji) e
            where e <> v_me)
        )
      end
    else jsonb_set(
      coalesce(m.reactions, '{}'::jsonb),
      array[p_emoji],
      coalesce(m.reactions -> p_emoji, '[]'::jsonb) || jsonb_build_array(v_me),
      true
    )
  end
  where m.id = p_message_id
    and (m.sender_id = v_uid or m.receiver_id = v_uid)
  returning m.reactions into v_result;

  if not found then
    raise exception 'mensagem nao encontrada';
  end if;
  return v_result;
end;
$$;

revoke all on function public.toggle_chat_reaction(uuid, text) from public, anon;
grant execute on function public.toggle_chat_reaction(uuid, text) to authenticated;
