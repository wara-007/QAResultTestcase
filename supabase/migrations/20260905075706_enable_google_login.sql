-- End temporary anonymous access now that Google login is required.
drop policy if exists projects_select_public_catalog on public.projects;
drop policy if exists projects_insert_public_catalog on public.projects;
drop policy if exists source_files_select_public on public.source_files;
drop policy if exists source_files_insert_public on public.source_files;
drop policy if exists source_files_update_public on public.source_files;
drop policy if exists test_cases_select_public on public.test_cases;
drop policy if exists test_cases_insert_public on public.test_cases;
drop policy if exists test_cases_update_public on public.test_cases;
drop policy if exists test_executions_select_public on public.test_executions;
drop policy if exists test_executions_insert_public on public.test_executions;
drop policy if exists test_executions_update_public on public.test_executions;
drop policy if exists testcase_source_files_select_public on storage.objects;
drop policy if exists testcase_source_files_insert_public on storage.objects;

revoke all on public.projects, public.source_files, public.test_cases, public.test_executions from anon;

-- Existing projects were created before login and have no owner. Signed-in
-- users may see and work with them during the transition. New projects are
-- always owned and remain protected by the existing membership policies.
create or replace function private.can_access_project(requested_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.projects p
    where p.id = requested_project_id
      and (
        p.owner_id is null
        or p.owner_id = (select auth.uid())
        or exists (
          select 1 from public.project_members pm
          where pm.project_id = requested_project_id
            and pm.user_id = (select auth.uid())
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
  select (select auth.uid()) is not null and exists (
    select 1 from public.projects p
    where p.id = requested_project_id
      and (
        p.owner_id is null
        or p.owner_id = (select auth.uid())
        or exists (
          select 1 from public.project_members pm
          where pm.project_id = requested_project_id
            and pm.user_id = (select auth.uid())
            and pm.role in ('admin', 'qa_lead', 'qa')
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
  select (select auth.uid()) is not null and exists (
    select 1 from public.projects p
    where p.id = requested_project_id
      and (
        p.owner_id is null
        or p.owner_id = (select auth.uid())
        or exists (
          select 1 from public.project_members pm
          where pm.project_id = requested_project_id
            and pm.user_id = (select auth.uid())
            and pm.role in ('admin', 'qa_lead')
        )
      )
  );
$$;

grant select, insert, update, delete on public.projects, public.project_members, public.source_files, public.test_cases, public.test_executions, public.evidence, public.defects, public.export_jobs to authenticated;

drop policy if exists testcase_source_files_select_authenticated on storage.objects;
create policy testcase_source_files_select_authenticated
on storage.objects for select to authenticated
using (bucket_id = 'testcase-source-files');

drop policy if exists testcase_source_files_insert_authenticated on storage.objects;
create policy testcase_source_files_insert_authenticated
on storage.objects for insert to authenticated
with check (bucket_id = 'testcase-source-files');
