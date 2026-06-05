-- 1. cover-images 버킷 생성 (public: true)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cover-images',
  'cover-images',
  true, -- public을 true로 설정!
  10485760, -- 10MB 제한
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- RLS 정책 초기화
drop policy if exists "anyone can view cover images" on storage.objects;
drop policy if exists "members can upload cover images" on storage.objects;
drop policy if exists "members can update cover images" on storage.objects;
drop policy if exists "admins can delete cover images" on storage.objects;

-- 2. 누구나 커버 이미지를 볼 수 있음 (select)
create policy "anyone can view cover images"
on storage.objects for select
using (bucket_id = 'cover-images');

-- 3. 커뮤니티 멤버만 업로드할 수 있음 (insert)
create policy "members can upload cover images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'cover-images'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and public.is_community_member(((storage.foldername(name))[1])::uuid)
);

-- 4. 커뮤니티 멤버만 업데이트할 수 있음 (update)
create policy "members can update cover images"
on storage.objects for update
to authenticated
using (
  bucket_id = 'cover-images'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and public.is_community_member(((storage.foldername(name))[1])::uuid)
);

-- 5. 커뮤니티 관리자/소유자만 삭제할 수 있음 (delete)
create policy "admins can delete cover images"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'cover-images'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and public.is_community_admin(((storage.foldername(name))[1])::uuid)
);
