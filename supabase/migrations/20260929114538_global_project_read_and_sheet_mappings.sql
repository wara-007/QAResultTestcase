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

create table public.project_sheet_mappings (
  project_id uuid not null references public.projects(id) on delete cascade,
  spreadsheet_id text not null check (length(trim(spreadsheet_id)) > 0),
  sheet_id bigint not null check (sheet_id >= 0),
  sheet_name text not null check (length(trim(sheet_name)) > 0),
  testcase_key text not null check (length(trim(testcase_key)) > 0),
  mapped_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (project_id, spreadsheet_id, sheet_id)
);

create index project_sheet_mappings_testcase_idx on public.project_sheet_mappings (project_id, testcase_key);

create trigger project_sheet_mappings_set_updated_at
before update on public.project_sheet_mappings
for each row execute function private.set_updated_at();

alter table public.project_sheet_mappings enable row level security;
revoke all on table public.project_sheet_mappings from public, anon, authenticated;
grant select, insert, update, delete on table public.project_sheet_mappings to authenticated;

create policy project_sheet_mappings_select_viewer
on public.project_sheet_mappings for select to authenticated
using ((select private.can_view_project(project_id)));

create policy project_sheet_mappings_insert_editor
on public.project_sheet_mappings for insert to authenticated
with check ((select private.can_edit_project(project_id)) and mapped_by = (select auth.uid()));

create policy project_sheet_mappings_update_editor
on public.project_sheet_mappings for update to authenticated
using ((select private.can_edit_project(project_id)))
with check ((select private.can_edit_project(project_id)) and mapped_by = (select auth.uid()));

create policy project_sheet_mappings_delete_editor
on public.project_sheet_mappings for delete to authenticated
using ((select private.can_edit_project(project_id)));
