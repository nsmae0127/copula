alter type public.notification_kind add value if not exists 'message';

create table if not exists public.community_messages (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  sender_member_id uuid not null references public.community_members(id) on delete cascade,
  sender_user_id uuid not null references public.profiles(id) on delete restrict,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, community_id)
);

create table if not exists public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  message_id uuid not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null check (emoji in ('❤️', '👍', '😂', '🎉')),
  created_at timestamptz not null default now(),
  unique (message_id, user_id, emoji),
  foreign key (message_id, community_id) references public.community_messages(id, community_id) on delete cascade
);

create index if not exists community_messages_community_created_idx
  on public.community_messages(community_id, created_at desc);
create index if not exists message_reactions_message_created_idx
  on public.message_reactions(message_id, created_at);

drop trigger if exists community_messages_set_updated_at on public.community_messages;
create trigger community_messages_set_updated_at
before update on public.community_messages
for each row execute function public.set_updated_at();

alter table public.community_messages enable row level security;
alter table public.message_reactions enable row level security;

drop policy if exists "members can read community messages" on public.community_messages;
create policy "members can read community messages"
on public.community_messages for select
to authenticated
using (public.is_community_member(community_id));

drop policy if exists "members can create community messages" on public.community_messages;
create policy "members can create community messages"
on public.community_messages for insert
to authenticated
with check (
  public.is_community_member(community_id)
  and sender_user_id = auth.uid()
  and exists (
    select 1
    from public.community_members member
    where member.id = sender_member_id
      and member.community_id = community_messages.community_id
      and member.user_id = auth.uid()
  )
);

drop policy if exists "members can read message reactions" on public.message_reactions;
create policy "members can read message reactions"
on public.message_reactions for select
to authenticated
using (public.is_community_member(community_id));

drop policy if exists "members can create own message reactions" on public.message_reactions;
create policy "members can create own message reactions"
on public.message_reactions for insert
to authenticated
with check (
  public.is_community_member(community_id)
  and user_id = auth.uid()
);

drop policy if exists "members can delete own message reactions" on public.message_reactions;
create policy "members can delete own message reactions"
on public.message_reactions for delete
to authenticated
using (
  public.is_community_member(community_id)
  and user_id = auth.uid()
);
