do $$
begin
  create type public.community_content_module as enum (
    'calendar',
    'commitments',
    'relationships',
    'albums',
    '1s'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.community_content_modules (
  community_id uuid not null references public.communities(id) on delete cascade,
  module public.community_content_module not null,
  enabled_by uuid references public.profiles(id) on delete set null,
  enabled_at timestamptz not null default now(),
  primary key (community_id, module)
);

create index if not exists community_content_modules_enabled_at_idx
  on public.community_content_modules(community_id, enabled_at);

alter table public.community_content_modules enable row level security;

drop policy if exists "members can read community content modules" on public.community_content_modules;
create policy "members can read community content modules"
on public.community_content_modules for select
to authenticated
using (public.is_community_member(community_id));

drop policy if exists "admins can create community content modules" on public.community_content_modules;
create policy "admins can create community content modules"
on public.community_content_modules for insert
to authenticated
with check (public.is_community_admin(community_id) and enabled_by = auth.uid());

drop policy if exists "admins can delete community content modules" on public.community_content_modules;
create policy "admins can delete community content modules"
on public.community_content_modules for delete
to authenticated
using (public.is_community_admin(community_id));

insert into public.community_content_modules (community_id, module)
select community_id, module::public.community_content_module
from (
  select id as community_id, 'calendar' as module
  from public.communities community
  where exists (
    select 1 from public.calendar_events event where event.community_id = community.id
  )
  or exists (
    select 1 from public.ddays dday where dday.community_id = community.id
  )

  union

  select id as community_id, 'albums' as module
  from public.communities community
  where exists (
    select 1 from public.albums album where album.community_id = community.id
  )

  union

  select id as community_id, 'relationships' as module
  from public.communities community
  where exists (
    select 1 from public.relationship_pairs pair where pair.community_id = community.id
  )
  or exists (
    select 1 from public.circles circle where circle.community_id = community.id
  )

  union

  select id as community_id, 'commitments' as module
  from public.communities community
  where exists (
    select 1 from public.commitments commitment where commitment.community_id = community.id
  )

  union

  select id as community_id, '1s' as module
  from public.communities community
  where exists (
    select 1 from public.one_second_logs vlog where vlog.community_id = community.id
  )
) existing_modules
on conflict (community_id, module) do nothing;
