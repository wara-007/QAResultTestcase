alter table private.app_authorizations
  add column if not exists user_type text not null default 'qa';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'app_authorizations_user_type_check'
      and conrelid = 'private.app_authorizations'::regclass
  ) then
    alter table private.app_authorizations
      add constraint app_authorizations_user_type_check
      check (user_type in ('qa', 'po'));
  end if;
end;
$$;

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
      and access_entry.user_type = 'qa'
  );
$$;

create or replace function public.get_my_app_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  with current_user_email as (
    select lower(u.email) as email
    from auth.users u
    where u.id = (select auth.uid())
  )
  select case
    when (select private.is_system_owner()) then 'qa'
    when exists (
      select 1 from private.app_authorizations access_entry
      join current_user_email current_user on current_user.email = access_entry.email
      where access_entry.enabled and access_entry.user_type = 'qa'
    ) then 'qa'
    when exists (
      select 1 from private.app_authorizations access_entry
      join current_user_email current_user on current_user.email = access_entry.email
      where access_entry.enabled and access_entry.user_type = 'po'
    ) or exists (
      select 1 from public.project_approval_requests approval_request
      join current_user_email current_user on current_user.email = approval_request.recipient_email
      where approval_request.status <> 'revoked'
    ) then 'po'
    else null
  end;
$$;

drop function if exists public.list_system_users();
create function public.list_system_users()
returns table(user_id uuid, email text, display_name text, is_authorized boolean, is_system_owner boolean, app_role text, last_sign_in_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  with known_emails as (
    select access_entry.email from private.app_authorizations access_entry
    union
    select lower(u.email) from auth.users u where u.email is not null
    union
    select approval_request.recipient_email
    from public.project_approval_requests approval_request
    where approval_request.status <> 'revoked'
  )
  select
    u.id,
    known.email,
    coalesce(profile.display_name, split_part(known.email, '@', 1)),
    system_owner.user_id is not null
      or coalesce(access_entry.enabled, false)
      or exists (
        select 1 from public.project_approval_requests approval_request
        where approval_request.recipient_email = known.email
          and approval_request.status <> 'revoked'
      ),
    system_owner.user_id is not null,
    case
      when system_owner.user_id is not null then 'qa'
      when access_entry.user_type is not null then access_entry.user_type
      when exists (
        select 1 from public.project_approval_requests approval_request
        where approval_request.recipient_email = known.email
          and approval_request.status <> 'revoked'
      ) then 'po'
      else 'qa'
    end,
    u.last_sign_in_at
  from known_emails known
  left join auth.users u on lower(u.email) = known.email
  left join public.profiles profile on profile.id = u.id
  left join private.app_authorizations access_entry on access_entry.email = known.email
  left join private.system_owners system_owner on system_owner.user_id = u.id
  where (select private.is_system_owner())
  order by known.email;
$$;

drop function if exists public.set_app_user_access(text, boolean);
create function public.set_app_user_access(requested_email text, requested_enabled boolean, requested_role text default 'qa')
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
  if requested_role not in ('qa', 'po') then
    raise exception 'Invalid user role';
  end if;
  if not requested_enabled and exists (
    select 1
    from private.system_owners system_owner
    join auth.users u on u.id = system_owner.user_id
    where lower(u.email) = normalized_email
  ) then
    raise exception 'System Owner access cannot be revoked';
  end if;

  insert into private.app_authorizations (email, enabled, user_type, granted_by, updated_at)
  values (normalized_email, requested_enabled, requested_role, (select auth.uid()), now())
  on conflict (email) do update
    set enabled = excluded.enabled,
        user_type = excluded.user_type,
        granted_by = excluded.granted_by,
        updated_at = now();
end;
$$;

revoke all on function public.get_my_app_role() from public, anon;
revoke all on function public.list_system_users() from public, anon;
revoke all on function public.set_app_user_access(text, boolean, text) from public, anon;
grant execute on function public.get_my_app_role() to authenticated;
grant execute on function public.list_system_users() to authenticated;
grant execute on function public.set_app_user_access(text, boolean, text) to authenticated;
