create or replace function public.create_community_notifications(
  p_community_id uuid,
  p_kind public.notification_kind,
  p_title text,
  p_body text default '',
  p_exclude_current_user boolean default true
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  inserted_count integer := 0;
begin
  if current_user_id is null then
    raise exception 'auth_required';
  end if;

  if not public.is_community_member(p_community_id) then
    raise exception 'not_member';
  end if;

  insert into public.notifications (user_id, community_id, kind, title, body)
  select
    member.user_id,
    p_community_id,
    p_kind,
    left(coalesce(nullif(trim(p_title), ''), 'Copula'), 120),
    coalesce(p_body, '')
  from public.community_members member
  where member.community_id = p_community_id
    and (not p_exclude_current_user or member.user_id <> current_user_id);

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke execute on function public.create_community_notifications(uuid, public.notification_kind, text, text, boolean) from public;
grant execute on function public.create_community_notifications(uuid, public.notification_kind, text, text, boolean) to authenticated;
