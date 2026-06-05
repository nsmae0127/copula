alter type public.notification_kind add value if not exists 'commitment';

create or replace function public.current_community_member_id(target_community_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.community_members
  where community_id = target_community_id
    and user_id = auth.uid()
  limit 1;
$$;

drop policy if exists "members can create relationship pairs" on public.relationship_pairs;
create policy "admins can create relationship pairs"
on public.relationship_pairs for insert
to authenticated
with check (public.is_community_admin(community_id) and created_by = auth.uid());

drop policy if exists "members can create circles" on public.circles;
create policy "admins can create circles"
on public.circles for insert
to authenticated
with check (public.is_community_admin(community_id) and created_by = auth.uid());

drop policy if exists "members can create circle members" on public.circle_members;
create policy "admins can create circle members"
on public.circle_members for insert
to authenticated
with check (public.is_community_admin(community_id));

drop policy if exists "admins can delete circle members" on public.circle_members;
create policy "admins can delete circle members"
on public.circle_members for delete
to authenticated
using (public.is_community_admin(community_id));

drop policy if exists "creators and admins can update commitments" on public.commitments;
create policy "creators assignees and admins can update commitments"
on public.commitments for update
to authenticated
using (
  created_by = auth.uid()
  or public.is_community_admin(community_id)
  or exists (
    select 1
    from public.commitment_assignees assignee
    where assignee.commitment_id = commitments.id
      and assignee.member_id = public.current_community_member_id(commitments.community_id)
  )
)
with check (public.is_community_member(community_id));

drop policy if exists "members can create commitment assignees" on public.commitment_assignees;
create policy "commitment creators and admins can create assignees"
on public.commitment_assignees for insert
to authenticated
with check (
  public.is_community_member(community_id)
  and exists (
    select 1
    from public.commitments commitment
    where commitment.id = commitment_id
      and commitment.community_id = commitment_assignees.community_id
      and (commitment.created_by = auth.uid() or public.is_community_admin(commitment.community_id))
  )
);

drop policy if exists "admins can delete commitment assignees" on public.commitment_assignees;
create policy "commitment creators and admins can delete assignees"
on public.commitment_assignees for delete
to authenticated
using (
  exists (
    select 1
    from public.commitments commitment
    where commitment.id = commitment_id
      and commitment.community_id = commitment_assignees.community_id
      and (commitment.created_by = auth.uid() or public.is_community_admin(commitment.community_id))
  )
);
