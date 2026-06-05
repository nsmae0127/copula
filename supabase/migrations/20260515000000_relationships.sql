create table if not exists public.relationship_pairs (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  first_member_id uuid not null references public.community_members(id) on delete cascade,
  second_member_id uuid not null references public.community_members(id) on delete cascade,
  label text not null default '' check (char_length(label) <= 120),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (first_member_id <> second_member_id)
);

create table if not exists public.circles (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.circle_members (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  circle_id uuid not null references public.circles(id) on delete cascade,
  member_id uuid not null references public.community_members(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (circle_id, member_id)
);

create table if not exists public.commitments (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  note text not null default '',
  due_at timestamptz not null,
  status text not null default 'open' check (status in ('open', 'done')),
  visibility_type text not null default 'community' check (visibility_type in ('community', 'circle', 'pair', 'private')),
  pair_id uuid references public.relationship_pairs(id) on delete set null,
  circle_id uuid references public.circles(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.commitment_assignees (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  commitment_id uuid not null references public.commitments(id) on delete cascade,
  member_id uuid not null references public.community_members(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (commitment_id, member_id)
);

create index if not exists relationship_pairs_community_created_idx
  on public.relationship_pairs(community_id, created_at desc);
create index if not exists circles_community_created_idx
  on public.circles(community_id, created_at desc);
create index if not exists circle_members_circle_idx
  on public.circle_members(circle_id);
create index if not exists commitments_community_due_idx
  on public.commitments(community_id, status, due_at);
create index if not exists commitment_assignees_commitment_idx
  on public.commitment_assignees(commitment_id);

drop trigger if exists relationship_pairs_set_updated_at on public.relationship_pairs;
create trigger relationship_pairs_set_updated_at
before update on public.relationship_pairs
for each row execute function public.set_updated_at();

drop trigger if exists circles_set_updated_at on public.circles;
create trigger circles_set_updated_at
before update on public.circles
for each row execute function public.set_updated_at();

drop trigger if exists commitments_set_updated_at on public.commitments;
create trigger commitments_set_updated_at
before update on public.commitments
for each row execute function public.set_updated_at();

alter table public.relationship_pairs enable row level security;
alter table public.circles enable row level security;
alter table public.circle_members enable row level security;
alter table public.commitments enable row level security;
alter table public.commitment_assignees enable row level security;

create policy "members can read relationship pairs"
on public.relationship_pairs for select
to authenticated
using (public.is_community_member(community_id));

create policy "members can create relationship pairs"
on public.relationship_pairs for insert
to authenticated
with check (public.is_community_member(community_id) and created_by = auth.uid());

create policy "creators and admins can update relationship pairs"
on public.relationship_pairs for update
to authenticated
using (created_by = auth.uid() or public.is_community_admin(community_id))
with check (public.is_community_member(community_id));

create policy "creators and admins can delete relationship pairs"
on public.relationship_pairs for delete
to authenticated
using (created_by = auth.uid() or public.is_community_admin(community_id));

create policy "members can read circles"
on public.circles for select
to authenticated
using (public.is_community_member(community_id));

create policy "members can create circles"
on public.circles for insert
to authenticated
with check (public.is_community_member(community_id) and created_by = auth.uid());

create policy "creators and admins can update circles"
on public.circles for update
to authenticated
using (created_by = auth.uid() or public.is_community_admin(community_id))
with check (public.is_community_member(community_id));

create policy "creators and admins can delete circles"
on public.circles for delete
to authenticated
using (created_by = auth.uid() or public.is_community_admin(community_id));

create policy "members can read circle members"
on public.circle_members for select
to authenticated
using (public.is_community_member(community_id));

create policy "members can create circle members"
on public.circle_members for insert
to authenticated
with check (public.is_community_member(community_id));

create policy "admins can delete circle members"
on public.circle_members for delete
to authenticated
using (public.is_community_admin(community_id));

create policy "members can read commitments"
on public.commitments for select
to authenticated
using (
  public.is_community_member(community_id)
  and (visibility_type <> 'private' or created_by = auth.uid())
);

create policy "members can create commitments"
on public.commitments for insert
to authenticated
with check (public.is_community_member(community_id) and created_by = auth.uid());

create policy "creators and admins can update commitments"
on public.commitments for update
to authenticated
using (created_by = auth.uid() or public.is_community_admin(community_id))
with check (public.is_community_member(community_id));

create policy "creators and admins can delete commitments"
on public.commitments for delete
to authenticated
using (created_by = auth.uid() or public.is_community_admin(community_id));

create policy "members can read commitment assignees"
on public.commitment_assignees for select
to authenticated
using (public.is_community_member(community_id));

create policy "members can create commitment assignees"
on public.commitment_assignees for insert
to authenticated
with check (public.is_community_member(community_id));

create policy "admins can delete commitment assignees"
on public.commitment_assignees for delete
to authenticated
using (public.is_community_admin(community_id));
