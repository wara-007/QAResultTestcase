create table if not exists private.system_owners (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

revoke all on private.system_owners from public, anon, authenticated;

insert into private.system_owners (user_id)
select id
from auth.users
where lower(email) in ('warawut_pum@truecorp.co.th', 'warawut.pp@gmail.com')
on conflict (user_id) do nothing;

create or replace function private.is_system_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1 from private.system_owners so
      where so.user_id = (select auth.uid())
    );
$$;

revoke execute on function private.is_system_owner() from public, anon;
grant execute on function private.is_system_owner() to authenticated;

drop policy if exists groups_select_member on public.groups;
drop policy if exists groups_select_catalog on public.groups;
create policy groups_select_catalog on public.groups
for select to authenticated
using (true);

create or replace function private.can_access_group(requested_group_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.is_system_owner()) or (
    (select auth.uid()) is not null and exists (
      select 1 from public.groups g
      where g.id = requested_group_id
        and (
          g.owner_id = (select auth.uid())
          or exists (
            select 1 from public.group_members gm
            where gm.group_id = requested_group_id
              and gm.user_id = (select auth.uid())
          )
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
  select (select private.is_system_owner()) or (
    (select auth.uid()) is not null and exists (
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
  select (select private.is_system_owner()) or exists (
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
  select (select private.is_system_owner()) or exists (
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
  select (select private.is_system_owner()) or exists (
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

create or replace function public.is_system_owner()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.is_system_owner();
$$;

create or replace function public.list_group_access()
returns table(group_id text, can_access boolean, can_manage boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    g.id,
    (select private.can_access_group(g.id)),
    (select private.can_manage_group(g.id))
  from public.groups g
  where (select auth.uid()) is not null;
$$;

create or replace function public.list_system_users()
returns table(user_id uuid, email text, display_name text, is_system_owner boolean, last_sign_in_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select
    u.id,
    coalesce(u.email, ''),
    coalesce(p.display_name, split_part(coalesce(u.email, ''), '@', 1)),
    so.user_id is not null,
    u.last_sign_in_at
  from auth.users u
  left join public.profiles p on p.id = u.id
  left join private.system_owners so on so.user_id = u.id
  where (select private.is_system_owner())
  order by lower(coalesce(u.email, ''));
$$;

create or replace function public.set_system_owner(requested_user_id uuid, requested_enabled boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select private.is_system_owner()) then
    raise exception 'Permission denied';
  end if;

  if not exists (select 1 from auth.users where id = requested_user_id) then
    raise exception 'User not found';
  end if;

  if requested_enabled then
    insert into private.system_owners (user_id, granted_by)
    values (requested_user_id, (select auth.uid()))
    on conflict (user_id) do nothing;
  else
    if requested_user_id = (select auth.uid()) then
      raise exception 'You cannot remove your own System Owner permission';
    end if;
    if (select count(*) from private.system_owners) <= 1 then
      raise exception 'At least one System Owner is required';
    end if;
    delete from private.system_owners where user_id = requested_user_id;
  end if;
end;
$$;

revoke all on function public.is_system_owner() from public, anon;
revoke all on function public.list_group_access() from public, anon;
revoke all on function public.list_system_users() from public, anon;
revoke all on function public.set_system_owner(uuid, boolean) from public, anon;
grant execute on function public.is_system_owner() to authenticated;
grant execute on function public.list_group_access() to authenticated;
grant execute on function public.list_system_users() to authenticated;
grant execute on function public.set_system_owner(uuid, boolean) to authenticated;
