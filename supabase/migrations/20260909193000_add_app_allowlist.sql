create table if not exists private.app_authorizations (
  email text primary key check (email = lower(trim(email)) and position('@' in email) > 1),
  enabled boolean not null default true,
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

revoke all on private.app_authorizations from public, anon, authenticated;

-- Preserve access for every account that used the application before allowlisting.
insert into private.app_authorizations (email, enabled)
select lower(email), true
from auth.users
where email is not null
on conflict (email) do update set enabled = true, updated_at = now();

create or replace function private.has_app_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.is_system_owner()) or exists (
    select 1
    from auth.users u
    join private.app_authorizations access_entry on access_entry.email = lower(u.email)
    where u.id = (select auth.uid())
      and access_entry.enabled
  );
$$;

revoke execute on function private.has_app_access() from public, anon;
grant execute on function private.has_app_access() to authenticated;

drop policy if exists groups_select_catalog on public.groups;
create policy groups_select_catalog on public.groups
for select to authenticated
using ((select private.has_app_access()));

drop policy if exists groups_insert_owner on public.groups;
create policy groups_insert_owner on public.groups
for insert to authenticated
with check (
  owner_id = (select auth.uid())
  and (select private.has_app_access())
);

create or replace function private.can_access_group(requested_group_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.has_app_access()) and (
    (select private.is_system_owner()) or exists (
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
  select (select private.has_app_access()) and (
    (select private.is_system_owner()) or exists (
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

create or replace function private.can_edit_project(requested_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.has_app_access()) and (
    (select private.is_system_owner()) or exists (
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
  select (select private.has_app_access()) and (
    (select private.is_system_owner()) or exists (
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
    )
  );
$$;

create or replace function public.is_app_authorized()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.has_app_access();
$$;

drop function if exists public.list_system_users();
create function public.list_system_users()
returns table(user_id uuid, email text, display_name text, is_authorized boolean, is_system_owner boolean, last_sign_in_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select
    u.id,
    coalesce(access_entry.email, lower(u.email)),
    coalesce(p.display_name, split_part(coalesce(access_entry.email, u.email, ''), '@', 1)),
    owner.user_id is not null or coalesce(access_entry.enabled, false),
    owner.user_id is not null,
    u.last_sign_in_at
  from private.app_authorizations access_entry
  full join auth.users u on lower(u.email) = access_entry.email
  left join public.profiles p on p.id = u.id
  left join private.system_owners owner on owner.user_id = u.id
  where (select private.is_system_owner())
  order by lower(coalesce(access_entry.email, u.email, ''));
$$;

create or replace function public.set_app_user_access(requested_email text, requested_enabled boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_email text := lower(trim(requested_email));
begin
  if not (select private.is_system_owner()) then
    raise exception 'Permission denied';
  end if;
  if position('@' in normalized_email) <= 1 then
    raise exception 'Invalid email';
  end if;
  if not requested_enabled and exists (
    select 1
    from private.system_owners owner
    join auth.users u on u.id = owner.user_id
    where lower(u.email) = normalized_email
  ) then
    raise exception 'System Owner access cannot be revoked';
  end if;

  insert into private.app_authorizations (email, enabled, granted_by, updated_at)
  values (normalized_email, requested_enabled, (select auth.uid()), now())
  on conflict (email) do update
    set enabled = excluded.enabled,
        granted_by = excluded.granted_by,
        updated_at = now();
end;
$$;

revoke all on function public.is_app_authorized() from public, anon;
revoke all on function public.list_system_users() from public, anon;
revoke all on function public.set_app_user_access(text, boolean) from public, anon;
grant execute on function public.is_app_authorized() to authenticated;
grant execute on function public.list_system_users() to authenticated;
grant execute on function public.set_app_user_access(text, boolean) to authenticated;
