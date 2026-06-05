-- Create one_second_logs table
create table if not exists public.one_second_logs (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  video_url text not null,
  caption text not null default '',
  created_at timestamptz not null default now()
);

-- UTC 기준 날짜 추출 함수가 없을 경우 생성 (Immutable)
create or replace function public.date_utc(t timestamptz) returns date as $$
  select (t at time zone 'utc')::date;
$$ language sql immutable;

-- 하루에 멤버당 하나의 영상만 등록할 수 있도록 유니크 인덱스 추가
create unique index if not exists one_second_logs_community_user_date_idx 
on public.one_second_logs (community_id, user_id, public.date_utc(created_at));

-- Enable RLS
alter table public.one_second_logs enable row level security;

-- Policies
create policy "members can read one_second_logs"
on public.one_second_logs for select
to authenticated
using (public.is_community_member(community_id));

create policy "members can create own one_second_logs"
on public.one_second_logs for insert
to authenticated
with check (
  public.is_community_member(community_id) 
  and user_id = auth.uid()
);

create policy "creators and admins can delete one_second_logs"
on public.one_second_logs for delete
to authenticated
using (
  user_id = auth.uid() 
  or public.is_community_admin(community_id)
);
