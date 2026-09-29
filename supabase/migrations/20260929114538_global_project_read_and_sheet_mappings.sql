-- All allowlisted application users can browse every Group and Project.
-- Mutation policies continue to use the existing edit/manage/delete checks.
create or replace function private.can_view_project(requested_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.has_app_access()) and exists (
    select 1 from public.projects p where p.id = requested_project_id
  );
$$;

revoke all on function private.can_view_project(uuid) from public, anon;
grant execute on function private.can_view_project(uuid) to authenticated;

create or replace function private.can_access_project(requested_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_view_project(requested_project_id);
$$;

revoke all on function private.can_access_project(uuid) from public, anon;
grant execute on function private.can_access_project(uuid) to authenticated;

create or replace function private.can_access_group(requested_group_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.has_app_access()) and exists (
    select 1 from public.groups g where g.id = requested_group_id
  );
$$;

revoke all on function private.can_access_group(text) from public, anon;
grant execute on function private.can_access_group(text) to authenticated;

create or replace function public.list_project_access(requested_group_id text)
returns table(project_id uuid, can_view boolean, can_edit boolean, can_manage boolean, can_delete boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    (select private.can_view_project(p.id)),
    (select private.can_edit_project(p.id)),
    (select private.can_manage_project(p.id)),
    ((select private.is_system_owner()) or p.owner_id = (select auth.uid()))
  from public.projects p
  where p.group_id = requested_group_id
    and (select private.has_app_access());
$$;

revoke all on function public.list_project_access(text) from public, anon;
grant execute on function public.list_project_access(text) to authenticated;
