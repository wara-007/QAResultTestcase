-- Persist uploaded workbooks and testcase results while authentication is
-- intentionally disabled. Access is limited to the tables and bucket used by
-- this MVP; RLS remains enabled.

alter table public.test_executions
  add column executed_by_name text not null default '',
  add column executed_date text not null default '',
  add column executed_time text not null default '';

grant select, insert, update on table public.source_files to anon;
grant select, insert, update on table public.test_cases to anon;
grant select, insert, update on table public.test_executions to anon;

create policy source_files_select_public
on public.source_files for select to anon using (true);

create policy source_files_insert_public
on public.source_files for insert to anon
with check (exists (select 1 from public.projects where id = project_id));

create policy source_files_update_public
on public.source_files for update to anon
using (true)
with check (exists (select 1 from public.projects where id = project_id));

create policy test_cases_select_public
on public.test_cases for select to anon using (true);

create policy test_cases_insert_public
on public.test_cases for insert to anon
with check (exists (select 1 from public.projects where id = project_id));

create policy test_cases_update_public
on public.test_cases for update to anon
using (true)
with check (exists (select 1 from public.projects where id = project_id));

create policy test_executions_select_public
on public.test_executions for select to anon using (true);

create policy test_executions_insert_public
on public.test_executions for insert to anon
with check (
  exists (
    select 1 from public.test_cases
    where id = test_case_id and project_id = test_executions.project_id
  )
);

create policy test_executions_update_public
on public.test_executions for update to anon
using (true)
with check (
  exists (
    select 1 from public.test_cases
    where id = test_case_id and project_id = test_executions.project_id
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'testcase-source-files',
  'testcase-source-files',
  false,
  20971520,
  array[
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/octet-stream'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy testcase_source_files_select_public
on storage.objects for select to anon
using (bucket_id = 'testcase-source-files');

create policy testcase_source_files_insert_public
on storage.objects for insert to anon
with check (bucket_id = 'testcase-source-files');
