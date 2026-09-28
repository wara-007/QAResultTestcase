create table if not exists public.test_case_sync_baselines (
  project_id uuid not null references public.projects(id) on delete cascade,
  testcase_key text not null,
  snapshot jsonb not null,
  snapshot_hash text not null,
  synced_by uuid references auth.users(id) on delete set null,
  synced_at timestamptz not null default now(),
  primary key (project_id, testcase_key)
);

create index if not exists test_case_sync_baselines_project_synced_idx
  on public.test_case_sync_baselines (project_id, synced_at desc);

alter table public.test_case_sync_baselines enable row level security;
revoke all on table public.test_case_sync_baselines from anon, authenticated;
grant select, insert, update, delete on table public.test_case_sync_baselines to authenticated;

create policy sync_baselines_select_member
  on public.test_case_sync_baselines for select to authenticated
  using ((select private.can_access_project(project_id)));

create policy sync_baselines_insert_editor
  on public.test_case_sync_baselines for insert to authenticated
  with check ((select private.can_edit_project(project_id)) and synced_by = (select auth.uid()));

create policy sync_baselines_update_editor
  on public.test_case_sync_baselines for update to authenticated
  using ((select private.can_edit_project(project_id)))
  with check ((select private.can_edit_project(project_id)) and synced_by = (select auth.uid()));

create policy sync_baselines_delete_editor
  on public.test_case_sync_baselines for delete to authenticated
  using ((select private.can_edit_project(project_id)));
