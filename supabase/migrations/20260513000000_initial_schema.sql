create extension if not exists pgcrypto;

do $$
begin
  create type public.community_role as enum ('owner', 'admin', 'member');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.album_item_kind as enum ('photo', 'video', 'note');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.dday_kind as enum ('anniversary', 'trip', 'birthday', 'event');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.notification_kind as enum ('invite', 'calendar', 'album', 'dday', 'notice');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  handle text not null check (handle ~ '^@[A-Za-z0-9_]{2,30}$'),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_handle_lower_unique
  on public.profiles (lower(handle));

create table if not exists public.communities (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  description text not null default '',
  accent text not null default '#8c74ba',
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_members (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.community_role not null default 'member',
  joined_at timestamptz not null default now(),
  unique (community_id, user_id)
);

create table if not exists public.invite_codes (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  code text not null unique check (code = upper(code) and char_length(code) between 4 and 32),
  created_by uuid not null references public.profiles(id) on delete restrict,
  expires_at timestamptz,
  max_uses integer check (max_uses is null or max_uses > 0),
  use_count integer not null default 0 check (use_count >= 0),
  disabled_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  notes text not null default '',
  location text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz check (ends_at is null or ends_at >= starts_at),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.albums (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  description text not null default '',
  cover_url text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, community_id)
);

create table if not exists public.album_items (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null,
  album_id uuid not null,
  title text not null check (char_length(title) between 1 and 120),
  kind public.album_item_kind not null default 'photo',
  media_url text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (album_id, community_id) references public.albums(id, community_id) on delete cascade
);

create table if not exists public.ddays (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  target_date date not null,
  kind public.dday_kind not null default 'event',
  note text not null default '',
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notices (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  body text not null default '',
  pinned boolean not null default false,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  community_id uuid references public.communities(id) on delete cascade,
  kind public.notification_kind not null,
  title text not null check (char_length(title) between 1 and 120),
  body text not null default '',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists community_members_user_id_idx on public.community_members(user_id);
create index if not exists community_members_community_id_idx on public.community_members(community_id);
create index if not exists invite_codes_community_id_idx on public.invite_codes(community_id);
create index if not exists calendar_events_community_starts_idx on public.calendar_events(community_id, starts_at);
create index if not exists albums_community_created_idx on public.albums(community_id, created_at desc);
create index if not exists album_items_album_created_idx on public.album_items(album_id, created_at desc);
create index if not exists ddays_community_target_idx on public.ddays(community_id, target_date);
create index if not exists notices_community_pinned_idx on public.notices(community_id, pinned desc, created_at desc);
create index if not exists notifications_user_created_idx on public.notifications(user_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists communities_set_updated_at on public.communities;
create trigger communities_set_updated_at
before update on public.communities
for each row execute function public.set_updated_at();

drop trigger if exists calendar_events_set_updated_at on public.calendar_events;
create trigger calendar_events_set_updated_at
before update on public.calendar_events
for each row execute function public.set_updated_at();

drop trigger if exists albums_set_updated_at on public.albums;
create trigger albums_set_updated_at
before update on public.albums
for each row execute function public.set_updated_at();

drop trigger if exists ddays_set_updated_at on public.ddays;
create trigger ddays_set_updated_at
before update on public.ddays
for each row execute function public.set_updated_at();

drop trigger if exists notices_set_updated_at on public.notices;
create trigger notices_set_updated_at
before update on public.notices
for each row execute function public.set_updated_at();

create or replace function public.ensure_profile(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, handle)
  values (
    target_user_id,
    'New member',
    '@' || substr(replace(target_user_id::text, '-', ''), 1, 12)
  )
  on conflict (id) do nothing;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, handle, avatar_url)
  values (
    new.id,
    left(coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), 'New member'), 80),
    '@' || substr(replace(new.id::text, '-', ''), 1, 12),
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_community_member(target_community_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.community_members
    where community_id = target_community_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.current_member_role(target_community_id uuid)
returns public.community_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.community_members
  where community_id = target_community_id
    and user_id = auth.uid()
  limit 1;
$$;

create or replace function public.is_community_admin(target_community_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_member_role(target_community_id) in ('owner', 'admin'), false);
$$;

create or replace function public.shares_community_with_user(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.community_members viewer
    join public.community_members target
      on target.community_id = viewer.community_id
    where viewer.user_id = auth.uid()
      and target.user_id = target_user_id
  );
$$;

create or replace function public.make_invite_code(seed_text text)
returns text
language plpgsql
as $$
declare
  prefix text;
begin
  prefix := upper(substr(regexp_replace(coalesce(seed_text, ''), '[^A-Za-z0-9]', '', 'g'), 1, 4));
  if prefix = '' then
    prefix := 'COPU';
  end if;

  return rpad(prefix, 4, 'X') || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
end;
$$;

create or replace function public.create_community(
  p_name text,
  p_description text default '',
  p_accent text default '#8c74ba',
  p_invite_code text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  new_community_id uuid;
  new_code text;
begin
  if current_user_id is null then
    raise exception 'auth_required';
  end if;

  perform public.ensure_profile(current_user_id);

  insert into public.communities (name, description, accent, created_by)
  values (trim(p_name), coalesce(trim(p_description), ''), coalesce(nullif(trim(p_accent), ''), '#8c74ba'), current_user_id)
  returning id into new_community_id;

  insert into public.community_members (community_id, user_id, role)
  values (new_community_id, current_user_id, 'owner');

  new_code := coalesce(nullif(upper(trim(p_invite_code)), ''), public.make_invite_code(p_name));

  insert into public.invite_codes (community_id, code, created_by)
  values (new_community_id, new_code, current_user_id);

  return new_community_id;
end;
$$;

create or replace function public.regenerate_invite_code(p_community_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  community_name text;
  new_code text;
  attempt integer := 0;
begin
  if current_user_id is null then
    raise exception 'auth_required';
  end if;

  if not public.is_community_admin(p_community_id) then
    raise exception 'insufficient_permission';
  end if;

  select name
  into community_name
  from public.communities
  where id = p_community_id;

  if not found then
    raise exception 'community_not_found';
  end if;

  update public.invite_codes
  set disabled_at = coalesce(disabled_at, now())
  where community_id = p_community_id
    and disabled_at is null;

  loop
    attempt := attempt + 1;
    new_code := public.make_invite_code(community_name);

    begin
      insert into public.invite_codes (community_id, code, created_by)
      values (p_community_id, new_code, current_user_id);
      return new_code;
    exception when unique_violation then
      if attempt >= 5 then
        raise;
      end if;
    end;
  end loop;
end;
$$;

create or replace function public.join_community_with_invite_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  invite_row public.invite_codes%rowtype;
  already_member boolean;
begin
  if current_user_id is null then
    raise exception 'auth_required';
  end if;

  perform public.ensure_profile(current_user_id);

  select *
  into invite_row
  from public.invite_codes
  where code = upper(trim(p_code))
    and disabled_at is null
    and (expires_at is null or expires_at > now())
    and (max_uses is null or use_count < max_uses)
  for update;

  if not found then
    raise exception 'invalid_invite_code';
  end if;

  select exists (
    select 1
    from public.community_members
    where community_id = invite_row.community_id
      and user_id = current_user_id
  )
  into already_member;

  if not already_member then
    insert into public.community_members (community_id, user_id, role)
    values (invite_row.community_id, current_user_id, 'member');

    update public.invite_codes
    set use_count = use_count + 1
    where id = invite_row.id;
  end if;

  return invite_row.community_id;
end;
$$;

create or replace function public.leave_community(p_community_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  member_role public.community_role;
  remaining_owner_count integer;
begin
  if current_user_id is null then
    raise exception 'auth_required';
  end if;

  select role
  into member_role
  from public.community_members
  where community_id = p_community_id
    and user_id = current_user_id;

  if not found then
    raise exception 'not_member';
  end if;

  if member_role = 'owner' then
    select count(*)
    into remaining_owner_count
    from public.community_members
    where community_id = p_community_id
      and user_id <> current_user_id
      and role = 'owner';

    if remaining_owner_count = 0 then
      raise exception 'last_owner_cannot_leave';
    end if;
  end if;

  delete from public.community_members
  where community_id = p_community_id
    and user_id = current_user_id;
end;
$$;

create or replace function public.update_community_member_role(
  p_community_id uuid,
  p_member_id uuid,
  p_role public.community_role
)
returns public.community_members
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  actor_role public.community_role;
  target_member public.community_members%rowtype;
  updated_member public.community_members%rowtype;
  remaining_owner_count integer;
begin
  if current_user_id is null then
    raise exception 'auth_required';
  end if;

  select role
  into actor_role
  from public.community_members
  where community_id = p_community_id
    and user_id = current_user_id;

  if not found then
    raise exception 'not_member';
  end if;

  if actor_role not in ('owner', 'admin') then
    raise exception 'insufficient_permission';
  end if;

  select *
  into target_member
  from public.community_members
  where community_id = p_community_id
    and id = p_member_id
  for update;

  if not found then
    raise exception 'member_not_found';
  end if;

  if actor_role <> 'owner' and (target_member.role = 'owner' or p_role = 'owner') then
    raise exception 'owner_only';
  end if;

  if target_member.role = 'owner' and p_role <> 'owner' then
    select count(*)
    into remaining_owner_count
    from public.community_members
    where community_id = p_community_id
      and id <> p_member_id
      and role = 'owner';

    if remaining_owner_count = 0 then
      raise exception 'last_owner_cannot_change';
    end if;
  end if;

  update public.community_members
  set role = p_role
  where community_id = p_community_id
    and id = p_member_id
  returning * into updated_member;

  return updated_member;
end;
$$;

create or replace function public.remove_community_member(
  p_community_id uuid,
  p_member_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  actor_role public.community_role;
  target_member public.community_members%rowtype;
  remaining_owner_count integer;
begin
  if current_user_id is null then
    raise exception 'auth_required';
  end if;

  select role
  into actor_role
  from public.community_members
  where community_id = p_community_id
    and user_id = current_user_id;

  if not found then
    raise exception 'not_member';
  end if;

  select *
  into target_member
  from public.community_members
  where community_id = p_community_id
    and id = p_member_id
  for update;

  if not found then
    raise exception 'member_not_found';
  end if;

  if target_member.user_id = current_user_id then
    perform public.leave_community(p_community_id);
    return;
  end if;

  if actor_role not in ('owner', 'admin') then
    raise exception 'insufficient_permission';
  end if;

  if actor_role <> 'owner' and target_member.role = 'owner' then
    raise exception 'owner_only';
  end if;

  if target_member.role = 'owner' then
    select count(*)
    into remaining_owner_count
    from public.community_members
    where community_id = p_community_id
      and id <> p_member_id
      and role = 'owner';

    if remaining_owner_count = 0 then
      raise exception 'last_owner_cannot_remove';
    end if;
  end if;

  delete from public.community_members
  where community_id = p_community_id
    and id = p_member_id;
end;
$$;

alter table public.profiles enable row level security;
alter table public.communities enable row level security;
alter table public.community_members enable row level security;
alter table public.invite_codes enable row level security;
alter table public.calendar_events enable row level security;
alter table public.albums enable row level security;
alter table public.album_items enable row level security;
alter table public.ddays enable row level security;
alter table public.notices enable row level security;
alter table public.notifications enable row level security;

create policy "profiles are visible to self and shared communities"
on public.profiles for select
to authenticated
using (id = auth.uid() or public.shares_community_with_user(id));

create policy "users can insert own profile"
on public.profiles for insert
to authenticated
with check (id = auth.uid());

create policy "users can update own profile"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "members can read their communities"
on public.communities for select
to authenticated
using (public.is_community_member(id));

create policy "authenticated users can create communities"
on public.communities for insert
to authenticated
with check (created_by = auth.uid());

create policy "admins can update communities"
on public.communities for update
to authenticated
using (public.is_community_admin(id))
with check (public.is_community_admin(id));

create policy "owners can delete communities"
on public.communities for delete
to authenticated
using (public.current_member_role(id) = 'owner');

create policy "members can read community members"
on public.community_members for select
to authenticated
using (public.is_community_member(community_id));

create policy "community member inserts go through RPC"
on public.community_members for insert
to authenticated
with check (false);

create policy "community member updates go through RPC"
on public.community_members for update
to authenticated
using (false)
with check (false);

create policy "community member deletes go through RPC"
on public.community_members for delete
to authenticated
using (false);

create policy "admins can read invite codes"
on public.invite_codes for select
to authenticated
using (public.is_community_admin(community_id));

create policy "admins can create invite codes"
on public.invite_codes for insert
to authenticated
with check (public.is_community_admin(community_id) and created_by = auth.uid());

create policy "admins can update invite codes"
on public.invite_codes for update
to authenticated
using (public.is_community_admin(community_id))
with check (public.is_community_admin(community_id));

create policy "admins can delete invite codes"
on public.invite_codes for delete
to authenticated
using (public.is_community_admin(community_id));

create policy "members can read calendar events"
on public.calendar_events for select
to authenticated
using (public.is_community_member(community_id));

create policy "members can create calendar events"
on public.calendar_events for insert
to authenticated
with check (public.is_community_member(community_id) and created_by = auth.uid());

create policy "creators and admins can update calendar events"
on public.calendar_events for update
to authenticated
using (created_by = auth.uid() or public.is_community_admin(community_id))
with check (public.is_community_member(community_id));

create policy "creators and admins can delete calendar events"
on public.calendar_events for delete
to authenticated
using (created_by = auth.uid() or public.is_community_admin(community_id));

create policy "members can read albums"
on public.albums for select
to authenticated
using (public.is_community_member(community_id));

create policy "members can create albums"
on public.albums for insert
to authenticated
with check (public.is_community_member(community_id) and created_by = auth.uid());

create policy "creators and admins can update albums"
on public.albums for update
to authenticated
using (created_by = auth.uid() or public.is_community_admin(community_id))
with check (public.is_community_member(community_id));

create policy "creators and admins can delete albums"
on public.albums for delete
to authenticated
using (created_by = auth.uid() or public.is_community_admin(community_id));

create policy "members can read album items"
on public.album_items for select
to authenticated
using (public.is_community_member(community_id));

create policy "members can create album items"
on public.album_items for insert
to authenticated
with check (public.is_community_member(community_id) and created_by = auth.uid());

create policy "creators and admins can update album items"
on public.album_items for update
to authenticated
using (created_by = auth.uid() or public.is_community_admin(community_id))
with check (public.is_community_member(community_id));

create policy "creators and admins can delete album items"
on public.album_items for delete
to authenticated
using (created_by = auth.uid() or public.is_community_admin(community_id));

create policy "members can read ddays"
on public.ddays for select
to authenticated
using (public.is_community_member(community_id));

create policy "members can create ddays"
on public.ddays for insert
to authenticated
with check (public.is_community_member(community_id) and created_by = auth.uid());

create policy "creators and admins can update ddays"
on public.ddays for update
to authenticated
using (created_by = auth.uid() or public.is_community_admin(community_id))
with check (public.is_community_member(community_id));

create policy "creators and admins can delete ddays"
on public.ddays for delete
to authenticated
using (created_by = auth.uid() or public.is_community_admin(community_id));

create policy "members can read notices"
on public.notices for select
to authenticated
using (public.is_community_member(community_id));

create policy "admins can create notices"
on public.notices for insert
to authenticated
with check (public.is_community_admin(community_id) and created_by = auth.uid());

create policy "admins can update notices"
on public.notices for update
to authenticated
using (public.is_community_admin(community_id))
with check (public.is_community_admin(community_id));

create policy "admins can delete notices"
on public.notices for delete
to authenticated
using (public.is_community_admin(community_id));

create policy "users can read own notifications"
on public.notifications for select
to authenticated
using (user_id = auth.uid());

create policy "users can create own notifications"
on public.notifications for insert
to authenticated
with check (user_id = auth.uid());

create policy "users can update own notifications"
on public.notifications for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "users can delete own notifications"
on public.notifications for delete
to authenticated
using (user_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'album-media',
  'album-media',
  false,
  20971520,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'video/mp4', 'video/quicktime']
)
on conflict (id) do nothing;

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

revoke execute on function public.set_updated_at() from public;
revoke execute on function public.ensure_profile(uuid) from public;
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.make_invite_code(text) from public;
revoke execute on function public.create_community(text, text, text, text) from public;
revoke execute on function public.regenerate_invite_code(uuid) from public;
revoke execute on function public.join_community_with_invite_code(text) from public;
revoke execute on function public.leave_community(uuid) from public;
revoke execute on function public.update_community_member_role(uuid, uuid, public.community_role) from public;
revoke execute on function public.remove_community_member(uuid, uuid) from public;

grant execute on function public.create_community(text, text, text, text) to authenticated;
grant execute on function public.regenerate_invite_code(uuid) to authenticated;
grant execute on function public.join_community_with_invite_code(text) to authenticated;
grant execute on function public.leave_community(uuid) to authenticated;
grant execute on function public.update_community_member_role(uuid, uuid, public.community_role) to authenticated;
grant execute on function public.remove_community_member(uuid, uuid) to authenticated;
