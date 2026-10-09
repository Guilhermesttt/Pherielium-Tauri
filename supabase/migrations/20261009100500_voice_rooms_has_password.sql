-- O cliente selecionava password_hash só para saber se a sala tem senha. Esta coluna gerada dá
-- a mesma informação sem expor o hash. Passo 1 (aditivo): o front passa a ler has_password;
-- só depois o hash pode ser escondido (ver supabase/proposals/README.md, item 3).

alter table public.voice_rooms
  add column if not exists has_password boolean generated always as (password_hash is not null) stored;
