-- Run this in the Supabase SQL editor if the app tables/RPCs exist but
-- the private album-media storage bucket is missing.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'album-media',
  'album-media',
  false,
  20971520,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'video/mp4', 'video/quicktime']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "members can read album media" on storage.objects;
drop policy if exists "members can upload album media" on storage.objects;
drop policy if exists "owners can update own album media" on storage.objects;
drop policy if exists "owners and admins can delete album media" on storage.objects;

create policy "members can read album media"
on storage.objects for select
to authenticated
using (
  bucket_id = 'album-media'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and public.is_community_member(((storage.foldername(name))[1])::uuid)
);

create policy "members can upload album media"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'album-media'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and (storage.foldername(name))[2] = auth.uid()::text
  and public.is_community_member(((storage.foldername(name))[1])::uuid)
);

create policy "owners can update own album media"
on storage.objects for update
to authenticated
using (
  bucket_id = 'album-media'
  and (storage.foldername(name))[2] = auth.uid()::text
)
with check (
  bucket_id = 'album-media'
  and (storage.foldername(name))[2] = auth.uid()::text
);

create policy "owners and admins can delete album media"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'album-media'
  and (
    (storage.foldername(name))[2] = auth.uid()::text
    or (
      (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and public.is_community_admin(((storage.foldername(name))[1])::uuid)
    )
  )
);
