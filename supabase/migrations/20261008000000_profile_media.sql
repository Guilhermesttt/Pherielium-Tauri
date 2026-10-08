-- Banner e mídias animadas (GIF) do perfil.
-- Aplique no projeto Supabase (SQL Editor ou `supabase db push`).

-- 1) Coluna do banner (URL pública). A foto continua em photo_url, agora também como URL.
alter table public.profiles        add column if not exists banner_url text;
alter table public.public_profiles add column if not exists banner_url text;

-- 2) Bucket público: qualquer pessoa lê (perfis são públicos); só o dono escreve na própria pasta.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-media',
  'profile-media',
  true,
  10485760, -- 10 MB (banner animado)
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "profile-media public read" on storage.objects;
create policy "profile-media public read"
  on storage.objects for select
  using (bucket_id = 'profile-media');

drop policy if exists "profile-media owner insert" on storage.objects;
create policy "profile-media owner insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'profile-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "profile-media owner update" on storage.objects;
create policy "profile-media owner update"
  on storage.objects for update to authenticated
  using (bucket_id = 'profile-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "profile-media owner delete" on storage.objects;
create policy "profile-media owner delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'profile-media' and (storage.foldername(name))[1] = auth.uid()::text);
