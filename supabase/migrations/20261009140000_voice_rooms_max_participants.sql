-- O app oferece salas de até 10 pessoas (MAX_CALL_PARTICIPANTS = 10), mas a constraint do banco
-- (default 4) recusava o INSERT: "violates check constraint voice_rooms_max_participants_check".
-- Alinha o banco ao app: de 2 a 10 pessoas, default 10.

alter table public.voice_rooms drop constraint if exists voice_rooms_max_participants_check;
alter table public.voice_rooms
  add constraint voice_rooms_max_participants_check check (max_participants between 2 and 10);
alter table public.voice_rooms alter column max_participants set default 10;
