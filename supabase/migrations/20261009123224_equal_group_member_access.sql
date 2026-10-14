begin;

-- Group roles describe responsibilities, not different mutation permissions.
-- Global browsing is deliberately NOT used to authorize mutations.
create or replace function private.can_manage_group(requested_group_id text)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and (select private.has_app_access()) and exists (
    select 1 from public.groups g where g.id = requested_group_id and (
      (select private.is_system_owner()) or g.owner_id = (select auth.uid()) or exists (
        select 1 from public.group_members gm
        where gm.group_id = g.id and gm.user_id = (select auth.uid())
      )
    )
  );
$$;

create or replace function private.can_plan_group(requested_group_id text)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.can_manage_group(requested_group_id);
$$;

create or replace function private.can_manage_project(requested_project_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and (select private.has_app_access()) and exists (
    select 1 from public.projects p where p.id = requested_project_id
    and (p.owner_id = (select auth.uid()) or private.can_manage_group(p.group_id))
  );
$$;

create or replace function private.can_edit_project(requested_project_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.can_manage_project(requested_project_id);
$$;

create or replace function private.can_delete_project(requested_project_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.can_manage_project(requested_project_id);
$$;

create or replace function private.can_manage_sprint(requested_sprint_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.sprints s where s.id = requested_sprint_id
    and private.can_manage_group(s.group_id));
$$;

create or replace function public.list_project_access(requested_group_id text)
returns table(project_id uuid, can_view boolean, can_edit boolean, can_manage boolean, can_delete boolean)
language sql stable security definer set search_path = '' as $$
  select p.id, private.can_view_project(p.id), private.can_edit_project(p.id),
    private.can_manage_project(p.id), private.can_delete_project(p.id)
  from public.projects p where p.group_id = requested_group_id
    and (select auth.uid()) is not null and (select private.has_app_access());
$$;

revoke all on function private.can_manage_group(text), private.can_plan_group(text),
  private.can_manage_project(uuid), private.can_edit_project(uuid),
  private.can_delete_project(uuid), private.can_manage_sprint(uuid),
  public.list_project_access(text) from public, anon;
grant execute on function private.can_manage_group(text), private.can_plan_group(text),
  private.can_manage_project(uuid), private.can_edit_project(uuid),
  private.can_delete_project(uuid), private.can_manage_sprint(uuid),
  public.list_project_access(text) to authenticated;

-- Keep external-evidence cleanup mandatory: deletion still uses server actions.
-- Do not restore direct Data API DELETE grants.
revoke delete on public.groups, public.projects from anon, authenticated;
drop policy if exists groups_delete_owner_or_system on public.groups;
drop policy if exists groups_delete_manager on public.groups;
create policy groups_delete_manager on public.groups for delete to authenticated
using ((select private.can_manage_group(id)));

notify pgrst, 'reload schema';
commit;
