create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 160),
  description text not null default '',
  sprint_no text not null default '',
  jira_url text,
  environment text not null default 'UAT',
  owner_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'qa_lead', 'qa', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create table public.source_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  original_name text not null,
  storage_provider text not null default 'r2' check (storage_provider in ('r2', 'supabase', 'local')),
  storage_key text not null,
  byte_size bigint not null check (byte_size >= 0),
  checksum_sha256 text,
  sheet_name text not null default 'Testcase',
  column_mapping jsonb not null default '{}'::jsonb,
  version_no integer not null default 1 check (version_no > 0),
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (project_id, version_no)
);

create table public.test_cases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  source_file_id uuid references public.source_files(id) on delete set null,
  testcase_key text not null,
  source_row integer check (source_row is null or source_row > 0),
  sort_order integer not null default 0,
  platform text not null default '',
  condition_text text not null default '',
  scenario text not null default '',
  case_name text not null default '',
  steps text not null default '',
  expected_result text not null default '',
  test_data text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, testcase_key)
);

create table public.test_executions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  test_case_id uuid not null references public.test_cases(id) on delete cascade,
  attempt_no integer not null default 1 check (attempt_no > 0),
  status text not null default 'Not Start' check (status in ('Not Start', 'In Progress', 'Pass', 'Failed', 'Skip')),
  device text not null default '',
  app_version text not null default '',
  environment text not null default 'UAT',
  actual_result text not null default '',
  remark text not null default '',
  result_reference text not null default '',
  executed_by uuid references auth.users(id) on delete set null,
  executed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (test_case_id, attempt_no)
);

create table public.evidence (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  execution_id uuid not null references public.test_executions(id) on delete cascade,
  file_name text not null,
  storage_key text not null,
  mime_type text not null,
  byte_size bigint not null check (byte_size >= 0),
  caption text not null default '',
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.defects (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  test_case_id uuid references public.test_cases(id) on delete set null,
  defect_key text not null,
  platform text not null default '',
  app_version text not null default '',
  description text not null default '',
  jira_url text,
  status text not null default 'Open',
  reporter_id uuid references auth.users(id) on delete set null,
  reported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, defect_key)
);

create table public.export_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  source_file_id uuid references public.source_files(id) on delete set null,
  status text not null default 'queued' check (status in ('queued', 'processing', 'completed', 'failed')),
  output_storage_key text,
  error_message text,
  requested_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  entity_type text not null,
  entity_id text not null,
  action text not null,
  changes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index project_members_user_id_idx on public.project_members (user_id, project_id);
create index source_files_project_created_idx on public.source_files (project_id, created_at desc);
create index test_cases_project_sort_idx on public.test_cases (project_id, sort_order, testcase_key);
create index test_cases_source_file_id_idx on public.test_cases (source_file_id);
create index test_executions_project_status_idx on public.test_executions (project_id, status);
create index test_executions_case_created_idx on public.test_executions (test_case_id, created_at desc);
create index test_executions_executed_by_idx on public.test_executions (executed_by);
create index evidence_project_created_idx on public.evidence (project_id, created_at desc);
create index evidence_execution_id_idx on public.evidence (execution_id);
create index defects_project_status_idx on public.defects (project_id, status);
create index defects_test_case_id_idx on public.defects (test_case_id);
create index defects_reporter_id_idx on public.defects (reporter_id);
create index export_jobs_project_created_idx on public.export_jobs (project_id, created_at desc);
create index export_jobs_source_file_id_idx on public.export_jobs (source_file_id);
create index audit_logs_project_created_idx on public.audit_logs (project_id, created_at desc);
create index audit_logs_actor_id_idx on public.audit_logs (actor_id);

create or replace function private.can_access_project(requested_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and (
    exists (
      select 1 from public.projects p
      where p.id = requested_project_id and p.owner_id = (select auth.uid())
    ) or exists (
      select 1 from public.project_members pm
      where pm.project_id = requested_project_id and pm.user_id = (select auth.uid())
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
  select (select auth.uid()) is not null and (
    exists (
      select 1 from public.projects p
      where p.id = requested_project_id and p.owner_id = (select auth.uid())
    ) or exists (
      select 1 from public.project_members pm
      where pm.project_id = requested_project_id
        and pm.user_id = (select auth.uid())
        and pm.role in ('admin', 'qa_lead', 'qa')
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
  select (select auth.uid()) is not null and (
    exists (
      select 1 from public.projects p
      where p.id = requested_project_id and p.owner_id = (select auth.uid())
    ) or exists (
      select 1 from public.project_members pm
      where pm.project_id = requested_project_id
        and pm.user_id = (select auth.uid())
        and pm.role in ('admin', 'qa_lead')
    )
  );
$$;

revoke execute on function private.can_access_project(uuid) from public, anon;
revoke execute on function private.can_edit_project(uuid) from public, anon;
revoke execute on function private.can_manage_project(uuid) from public, anon;
grant execute on function private.can_access_project(uuid) to authenticated;
grant execute on function private.can_edit_project(uuid) to authenticated;
grant execute on function private.can_manage_project(uuid) to authenticated;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger projects_set_updated_at before update on public.projects for each row execute function private.set_updated_at();
create trigger profiles_set_updated_at before update on public.profiles for each row execute function private.set_updated_at();
create trigger test_cases_set_updated_at before update on public.test_cases for each row execute function private.set_updated_at();
create trigger test_executions_set_updated_at before update on public.test_executions for each row execute function private.set_updated_at();
create trigger defects_set_updated_at before update on public.defects for each row execute function private.set_updated_at();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, ''), '@', 1)));
  return new;
end;
$$;

revoke execute on function private.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.handle_new_user();

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.source_files enable row level security;
alter table public.test_cases enable row level security;
alter table public.test_executions enable row level security;
alter table public.evidence enable row level security;
alter table public.defects enable row level security;
alter table public.export_jobs enable row level security;
alter table public.audit_logs enable row level security;

revoke all on all tables in schema public from anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.projects, public.project_members, public.source_files, public.test_cases, public.test_executions, public.evidence, public.defects, public.export_jobs to authenticated;
grant select, insert on public.audit_logs to authenticated;
grant usage, select on sequence public.audit_logs_id_seq to authenticated;

create policy profiles_select_self on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_update_self on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy projects_select_member on public.projects for select to authenticated using ((select private.can_access_project(id)));
create policy projects_insert_owner on public.projects for insert to authenticated with check (owner_id = (select auth.uid()));
create policy projects_update_manager on public.projects for update to authenticated using ((select private.can_manage_project(id))) with check ((select private.can_manage_project(id)));
create policy projects_delete_manager on public.projects for delete to authenticated using ((select private.can_manage_project(id)));

create policy project_members_select_member on public.project_members for select to authenticated using ((select private.can_access_project(project_id)));
create policy project_members_insert_manager on public.project_members for insert to authenticated with check ((select private.can_manage_project(project_id)));
create policy project_members_update_manager on public.project_members for update to authenticated using ((select private.can_manage_project(project_id))) with check ((select private.can_manage_project(project_id)));
create policy project_members_delete_manager on public.project_members for delete to authenticated using ((select private.can_manage_project(project_id)));

create policy source_files_select_member on public.source_files for select to authenticated using ((select private.can_access_project(project_id)));
create policy source_files_insert_editor on public.source_files for insert to authenticated with check ((select private.can_edit_project(project_id)) and uploaded_by = (select auth.uid()));
create policy source_files_update_manager on public.source_files for update to authenticated using ((select private.can_manage_project(project_id))) with check ((select private.can_manage_project(project_id)));
create policy source_files_delete_manager on public.source_files for delete to authenticated using ((select private.can_manage_project(project_id)));

create policy test_cases_select_member on public.test_cases for select to authenticated using ((select private.can_access_project(project_id)));
create policy test_cases_insert_editor on public.test_cases for insert to authenticated with check ((select private.can_edit_project(project_id)));
create policy test_cases_update_editor on public.test_cases for update to authenticated using ((select private.can_edit_project(project_id))) with check ((select private.can_edit_project(project_id)));
create policy test_cases_delete_manager on public.test_cases for delete to authenticated using ((select private.can_manage_project(project_id)));

create policy test_executions_select_member on public.test_executions for select to authenticated using ((select private.can_access_project(project_id)));
create policy test_executions_insert_editor on public.test_executions for insert to authenticated with check ((select private.can_edit_project(project_id)));
create policy test_executions_update_editor on public.test_executions for update to authenticated using ((select private.can_edit_project(project_id))) with check ((select private.can_edit_project(project_id)));
create policy test_executions_delete_manager on public.test_executions for delete to authenticated using ((select private.can_manage_project(project_id)));

create policy evidence_select_member on public.evidence for select to authenticated using ((select private.can_access_project(project_id)));
create policy evidence_insert_editor on public.evidence for insert to authenticated with check ((select private.can_edit_project(project_id)) and uploaded_by = (select auth.uid()));
create policy evidence_update_editor on public.evidence for update to authenticated using ((select private.can_edit_project(project_id))) with check ((select private.can_edit_project(project_id)));
create policy evidence_delete_editor on public.evidence for delete to authenticated using ((select private.can_edit_project(project_id)));

create policy defects_select_member on public.defects for select to authenticated using ((select private.can_access_project(project_id)));
create policy defects_insert_editor on public.defects for insert to authenticated with check ((select private.can_edit_project(project_id)));
create policy defects_update_editor on public.defects for update to authenticated using ((select private.can_edit_project(project_id))) with check ((select private.can_edit_project(project_id)));
create policy defects_delete_manager on public.defects for delete to authenticated using ((select private.can_manage_project(project_id)));

create policy export_jobs_select_member on public.export_jobs for select to authenticated using ((select private.can_access_project(project_id)));
create policy export_jobs_insert_editor on public.export_jobs for insert to authenticated with check ((select private.can_edit_project(project_id)) and requested_by = (select auth.uid()));
create policy export_jobs_update_manager on public.export_jobs for update to authenticated using ((select private.can_manage_project(project_id))) with check ((select private.can_manage_project(project_id)));
create policy export_jobs_delete_manager on public.export_jobs for delete to authenticated using ((select private.can_manage_project(project_id)));

create policy audit_logs_select_member on public.audit_logs for select to authenticated using ((select private.can_access_project(project_id)));
create policy audit_logs_insert_actor on public.audit_logs for insert to authenticated with check ((select private.can_access_project(project_id)) and actor_id = (select auth.uid()));
