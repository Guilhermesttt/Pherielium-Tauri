-- Salas de voz privadas passam a aparecer na lista para todos os usuários autenticados, com o
-- cadeado; entrar continua exigindo a senha (join_voice_room confere o hash).
--
-- O que muda: a linha da sala (nome, categoria, anfitrião, has_password...) fica legível para
-- qualquer usuário autenticado enquanto a sala está ativa. O que NÃO muda:
--   * password_hash segue sem SELECT para o cliente (grant por coluna da migration 20261009120000);
--   * voice_room_members segue restrito por can_view_voice_room: quem não está na sala privada
--     não vê quem está dentro dela;
--   * entrar numa sala privada exige a senha correta (RPC join_voice_room).
-- Passo aditivo: é uma policy nova de SELECT; as existentes continuam valendo (policies se somam).

drop policy if exists voice_rooms_select_active on public.voice_rooms;
create policy voice_rooms_select_active
  on public.voice_rooms
  for select
  to authenticated
  using (status = 'active');

-- ROLLBACK:
--   drop policy if exists voice_rooms_select_active on public.voice_rooms;
