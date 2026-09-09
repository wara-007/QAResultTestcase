create table if not exists public.group_invitations (
  group_id text not null references public.groups(id) on delete cascade,
  email text not null check (email = lower(trim(email)) and position('@' in email) > 1),
  role text not null check (role in ('admin', 'qa_lead', 'qa', 'viewer')),
  invited_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_id, email)
);

alter table public.group_invitations enable row level security;
revoke all on public.group_invitations from public, anon, authenticated;

insert into public.group_members (group_id, user_id, role)
select distinct p.group_id, p.owner_id, 'admin'
from public.projects p
where p.owner_id is not null
on conflict (group_id, user_id) do nothing;

update public.groups g
set owner_id = (
  select gm.user_id
  from public.group_members gm
  where gm.group_id = g.id
  order by gm.created_at
  limit 1
)
where g.owner_id is null
  and exists (select 1 from public.group_members gm where gm.group_id = g.id);

create or replace function private.can_access_group(requested_group_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.groups g
    where g.id = requested_group_id
      and (
        g.owner_id = (select auth.uid())
        or exists (
          select 1 from public.group_members gm
          where gm.group_id = requested_group_id and gm.user_id = (select auth.uid())
        )
      )
  );
$$;

create or replace function private.can_manage_group(requested_group_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.groups g
    where g.id = requested_group_id
      and (
        g.owner_id = (select auth.uid())
        or exists (
          select 1 from public.group_members gm
          where gm.group_id = requested_group_id
            and gm.user_id = (select auth.uid())
            and gm.role in ('admin', 'qa_lead')
        )
      )
  );
$$;

create or replace function private.can_access_project(requested_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.projects p
    where p.id = requested_project_id
      and (select private.can_access_group(p.group_id))
  );
$$;

create or replace function private.can_edit_project(requested_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.projects p
    join public.groups g on g.id = p.group_id
    where p.id = requested_project_id
      and (
        g.owner_id = (select auth.uid())
        or exists (
          select 1 from public.group_members gm
          where gm.group_id = p.group_id
            and gm.user_id = (select auth.uid())
            and gm.role in ('admin', 'qa_lead', 'qa')
        )
      )
  );
$$;

create or replace function private.can_manage_project(requested_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.projects p
    join public.groups g on g.id = p.group_id
    where p.id = requested_project_id
      and (
        g.owner_id = (select auth.uid())
        or exists (
          select 1 from public.group_members gm
          where gm.group_id = p.group_id
            and gm.user_id = (select auth.uid())
            and gm.role in ('admin', 'qa_lead')
        )
      )
  );
$$;

create or replace function public.claim_group_invitations()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_email text;
  claimed_count integer;
begin
  select lower(email) into current_email from auth.users where id = (select auth.uid());
  if current_email is null then raise exception 'Authentication required'; end if;
  insert into public.group_members (group_id, user_id, role)
  select invitation.group_id, (select auth.uid()), invitation.role
  from public.group_invitations invitation
  where invitation.email = current_email
  on conflict (group_id, user_id) do update set role = excluded.role;
  get diagnostics claimed_count = row_count;
  delete from public.group_invitations where email = current_email;
  return claimed_count;
end;
$$;

create or replace function public.invite_group_member(requested_group_id text, requested_email text, requested_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_email text := lower(trim(requested_email));
  existing_user_id uuid;
begin
  if not (select private.can_manage_group(requested_group_id)) then raise exception 'Permission denied'; end if;
  if requested_role not in ('admin', 'qa_lead', 'qa', 'viewer') then raise exception 'Invalid role'; end if;
  if position('@' in normalized_email) <= 1 then raise exception 'Invalid email'; end if;
  select id into existing_user_id from auth.users where lower(email) = normalized_email limit 1;
  if existing_user_id is not null then
    insert into public.group_members (group_id, user_id, role) values (requested_group_id, existing_user_id, requested_role)
    on conflict (group_id, user_id) do update set role = excluded.role;
    delete from public.group_invitations where group_id = requested_group_id and email = normalized_email;
  else
    insert into public.group_invitations (group_id, email, role, invited_by)
    values (requested_group_id, normalized_email, requested_role, (select auth.uid()))
    on conflict (group_id, email) do update set role = excluded.role, invited_by = excluded.invited_by, created_at = now();
  end if;
end;
$$;

create or replace function public.list_group_members(requested_group_id text)
returns table(member_id text, email text, display_name text, role text, pending boolean, is_owner boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select g.owner_id::text, coalesce(u.email, ''), coalesce(p.display_name, split_part(coalesce(u.email, ''), '@', 1)), 'admin', false, true
  from public.groups g
  left join auth.users u on u.id = g.owner_id
  left join public.profiles p on p.id = g.owner_id
  where g.id = requested_group_id and g.owner_id is not null and (select private.can_access_group(requested_group_id))
  union all
  select gm.user_id::text, coalesce(u.email, ''), coalesce(p.display_name, split_part(coalesce(u.email, ''), '@', 1)), gm.role, false, false
  from public.group_members gm
  join auth.users u on u.id = gm.user_id
  left join public.profiles p on p.id = gm.user_id
  where gm.group_id = requested_group_id
    and gm.user_id <> (select g.owner_id from public.groups g where g.id = requested_group_id)
    and (select private.can_access_group(requested_group_id))
  union all
  select null, invitation.email, split_part(invitation.email, '@', 1), invitation.role, true, false
  from public.group_invitations invitation
  where invitation.group_id = requested_group_id and (select private.can_manage_group(requested_group_id));
$$;

create or replace function public.remove_group_member(requested_group_id text, requested_member_id text, requested_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select private.can_manage_group(requested_group_id)) then raise exception 'Permission denied'; end if;
  if requested_member_id is not null and requested_member_id <> '' then
    if requested_member_id::uuid = (select owner_id from public.groups where id = requested_group_id) then raise exception 'Cannot remove group owner'; end if;
    delete from public.group_members where group_id = requested_group_id and user_id = requested_member_id::uuid;
  else
    delete from public.group_invitations where group_id = requested_group_id and email = lower(trim(requested_email));
  end if;
end;
$$;

revoke all on function public.claim_group_invitations() from public, anon;
revoke all on function public.invite_group_member(text, text, text) from public, anon;
revoke all on function public.list_group_members(text) from public, anon;
revoke all on function public.remove_group_member(text, text, text) from public, anon;
grant execute on function public.claim_group_invitations() to authenticated;
grant execute on function public.invite_group_member(text, text, text) to authenticated;
grant execute on function public.list_group_members(text) to authenticated;
grant execute on function public.remove_group_member(text, text, text) to authenticated;

-- END OF GROUP SHARED ACCESS MIGRATION
