create or replace function private.can_delete_project(requested_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.has_app_access()) and (
    (select private.is_system_owner()) or exists (
      select 1
      from public.projects p
      where p.id = requested_project_id
        and p.owner_id = (select auth.uid())
    )
  );
$$;

revoke execute on function private.can_delete_project(uuid) from public, anon;
grant execute on function private.can_delete_project(uuid) to authenticated;

drop policy if exists projects_delete_manager on public.projects;
drop policy if exists projects_delete_owner_or_system_owner on public.projects;
create policy projects_delete_owner_or_system_owner
on public.projects
for delete
to authenticated
using ((select private.can_delete_project(id)));
