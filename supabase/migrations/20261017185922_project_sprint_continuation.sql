begin;

create table if not exists public.project_sprint_participations (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects on delete cascade,
 sprint_id uuid not null references public.sprints on delete restrict, entered_at timestamptz, exited_at timestamptz,
 previous_id uuid references public.project_sprint_participations, next_id uuid references public.project_sprint_participations,
 actor_name text not null default '', reason text not null default '',
 snapshot_kind text not null default 'none' check(snapshot_kind in ('none','full','legacy-summary')),
 history_id uuid unique
);
create unique index if not exists project_sprint_one_active on public.project_sprint_participations(project_id) where exited_at is null;
create index if not exists project_sprint_participations_sprint on public.project_sprint_participations(sprint_id,project_id,exited_at desc);
create table if not exists public.project_sprint_snapshots (
 id uuid primary key references public.project_sprint_participations on delete cascade,
 project_id uuid not null references public.projects on delete cascade,
 header jsonb not null, case_count integer not null default 0
);
create table if not exists public.project_sprint_snapshot_cases (
 id uuid primary key default gen_random_uuid(), snapshot_id uuid not null references public.project_sprint_snapshots on delete cascade,
 project_id uuid not null references public.projects on delete cascade,
 position integer not null, payload jsonb not null, unique(snapshot_id,position)
);
create index if not exists project_sprint_snapshot_cases_project on public.project_sprint_snapshot_cases(project_id);
alter table public.project_sprint_snapshots add column if not exists personal_cases jsonb not null default '[]'::jsonb;
alter table public.project_sprint_participations add column if not exists baseline_results jsonb not null default '[]'::jsonb;
alter table public.project_sprint_participations enable row level security;
alter table public.project_sprint_snapshots enable row level security;
alter table public.project_sprint_snapshot_cases enable row level security;
revoke all on public.project_sprint_participations,public.project_sprint_snapshots,public.project_sprint_snapshot_cases from public,anon,authenticated;
grant select on public.project_sprint_participations,public.project_sprint_snapshots,public.project_sprint_snapshot_cases to authenticated;
drop policy if exists participation_read on public.project_sprint_participations;
create policy participation_read on public.project_sprint_participations for select to authenticated using(private.can_view_project(project_id));
drop policy if exists snapshot_read on public.project_sprint_snapshots;
create policy snapshot_read on public.project_sprint_snapshots for select to authenticated using(private.can_view_project(project_id));
drop policy if exists snapshot_case_read on public.project_sprint_snapshot_cases;
create policy snapshot_case_read on public.project_sprint_snapshot_cases for select to authenticated using(private.can_view_project(project_id));

-- Unknown entrance dates stay unknown. Re-running never creates an extra episode.
insert into public.project_sprint_participations(project_id,sprint_id)
select p.id,p.sprint_id from public.projects p where p.sprint_id is not null and not exists(
 select 1 from public.project_sprint_participations e where e.project_id=p.id and e.exited_at is null);
insert into public.project_sprint_participations(project_id,sprint_id,exited_at,actor_name,reason,snapshot_kind,history_id)
select h.project_id,(h.before_data->>'sprintId')::uuid,h.created_at,h.actor_email,coalesce(h.after_data->>'reason',''),'legacy-summary',h.id
from public.project_history h join public.projects p on p.id=h.project_id
join public.sprints s on s.id::text=h.before_data->>'sprintId' and s.group_id=p.group_id
where h.after_data->>'kind'='sprint_move' on conflict(history_id) do nothing;
insert into public.project_sprint_snapshots(id,project_id,header)
select e.id,e.project_id,jsonb_build_object('version',1,
 'participation',jsonb_build_object('id',e.id,'projectId',e.project_id,'sprintId',e.sprint_id,'enteredAt',null,'exitedAt',e.exited_at,'previousId',null,'nextId',null,'actorName',e.actor_name,'reason',e.reason,'snapshotKind','legacy-summary'),
 'project',jsonb_build_object('id',e.project_id,'name',h.before_data->>'name','description',coalesce(h.before_data->>'description',''),'environment',coalesce(h.before_data->>'environment','')),
 'counts',coalesce(h.after_data->'moveSnapshot','{}'::jsonb),'qa','[]'::jsonb,
 'approval',jsonb_build_object('projectId',e.project_id,'total',0,'approved',0,'pending',0,'changesRequested',0),'source',null,
 'destination',jsonb_build_object('sprintId',h.after_data->>'sprintId','sprintName',h.after_data->>'sprint','year',h.after_data->'year'))
from public.project_sprint_participations e join public.project_history h on h.id=e.history_id on conflict(id) do nothing;

-- Snapshot case counting follows the register-membership rules, not tab count.
create or replace function private.continuation_counts(requested_project_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 with latest as (
 select tc.*,e.status,private.result_payload(e.result_reference) payload from public.test_cases tc
 left join lateral(select status,result_reference from public.test_executions where test_case_id=tc.id order by attempt_no desc,id limit 1) e on true
 where tc.project_id=requested_project_id),
 register as(select * from latest where lower(trim(testcase_key)) not in ('cover','summary','test summary','สรุป')
 and coalesce(payload->>'sourceSheetName','')=''
 and (coalesce(source_row,0)>0 or testcase_key ~* '(^|[ _-])TC[ _-]*[0-9]+$' or length(trim(coalesce(steps,'')))>0 or length(trim(coalesce(expected_result,'')))>0)),
 counts as(select count(*) total,count(*) filter(where status='Pass') pass,count(*) filter(where status='Failed') failed,
 count(*) filter(where status='Skip') skip,count(*) filter(where status='In Progress') in_progress,count(*) filter(where coalesce(status,'Not Start')='Not Start') not_start from register)
 select private.project_move_snapshot(requested_project_id)||jsonb_build_object('totalCases',total,'pass',pass,'failed',failed,'skip',skip,'inProgress',in_progress,'notStart',not_start) from counts;
$$;
revoke all on function private.continuation_counts(uuid) from public,anon,authenticated;

create or replace function private.capture_project_continuation() returns trigger
language plpgsql security definer set search_path='' as $$
declare episode public.project_sprint_participations; next_episode uuid:=gen_random_uuid(); stamp timestamptz:=clock_timestamp();
 actor text; source_data jsonb; source_row_data record; destination jsonb; header_data jsonb;
begin
 if tg_op='INSERT' then
  insert into public.project_sprint_participations(project_id,sprint_id,entered_at) values(new.id,new.sprint_id,stamp);
  return new;
 end if;
 if new.sprint_id is not distinct from old.sprint_id then return new; end if;
 if auth.uid() is null or not private.can_manage_project(old.id) then raise exception 'Permission denied'; end if;
 if not exists(select 1 from public.sprints where id=new.sprint_id and group_id=old.group_id) then raise exception 'Sprint must belong to this Group'; end if;
 if length(trim(coalesce(new.last_move_reason,''))) not between 1 and 2000 then raise exception 'Continuation reason is required'; end if;
 select * into source_row_data from public.source_files where project_id=old.id order by version_no desc,id desc limit 1;
 if found then
  if exists(select 1 from jsonb_each_text(coalesce(source_row_data.column_mapping->'sheetImport'->'states','{}'::jsonb)) state where state.value in ('queued','loading','error')) then
   raise exception 'กรุณานำเข้าข้อมูลให้ครบก่อนนำ Project ไปทำต่อใน Sprint';
  end if;
  source_data:=jsonb_build_object('id',source_row_data.id,'fileName',source_row_data.original_name,'sheetName',source_row_data.sheet_name,
   'documentType',source_row_data.column_mapping->>'documentType',
   'sheetPath',coalesce(source_row_data.column_mapping->>'sheetPath',''),'columns',coalesce((select jsonb_object_agg(key,value) from jsonb_each(source_row_data.column_mapping) where jsonb_typeof(value)='string' and key not in ('sheetPath','documentType')),'{}'::jsonb),
   'sheets',coalesce(source_row_data.column_mapping->'sheets','[]'::jsonb),'coverSnapshot',source_row_data.column_mapping->'coverSnapshot',
   'sheetImport',source_row_data.column_mapping->'sheetImport','storageKey',source_row_data.storage_key,'chunkCount',source_row_data.column_mapping->'chunkCount');
 end if;
 select * into episode from public.project_sprint_participations where project_id=old.id and exited_at is null for update;
 if not found or episode.sprint_id<>old.sprint_id then raise exception 'Participation changed; reload before continuing'; end if;
 select coalesce(email,'') into actor from auth.users where id=auth.uid();
 select jsonb_build_object('sprintId',s.id,'sprintName',s.name,'year',y.year) into destination from public.sprints s join public.workspace_years y on y.id=s.year_id where s.id=new.sprint_id;
 -- Both links are set only after both rows exist (self-referential FKs).
 update public.project_sprint_participations set exited_at=stamp,actor_name=coalesce(actor,''),reason=trim(new.last_move_reason),snapshot_kind='full' where id=episode.id;
 insert into public.project_sprint_participations(id,project_id,sprint_id,entered_at,previous_id) values(next_episode,old.id,new.sprint_id,stamp,episode.id);
 update public.project_sprint_participations set next_id=next_episode where id=episode.id;
 header_data:=jsonb_build_object('version',1,'participation',jsonb_build_object('id',episode.id,'projectId',old.id,'sprintId',old.sprint_id,
 'enteredAt',episode.entered_at,'exitedAt',stamp,'previousId',episode.previous_id,'nextId',next_episode,'actorName',coalesce(actor,''),'reason',trim(new.last_move_reason),'snapshotKind','full'),
 'project',jsonb_build_object('id',old.id,'name',old.name,'description',old.description,'environment',old.environment),
 'counts',private.continuation_counts(old.id),'source',source_data,'destination',destination,
 'qa',(select coalesce(jsonb_agg(jsonb_build_object('userId',a.user_id,'name',coalesce(nullif(p.display_name,''),u.email,''),'email',coalesce(u.email,''),'role','qa')),'[]'::jsonb) from public.project_qa_assignments a left join public.profiles p on p.id=a.user_id left join auth.users u on u.id=a.user_id where a.project_id=old.id),
 'approval',(select jsonb_build_object('projectId',old.id,'total',count(*),'approved',count(*) filter(where status='approved'),'pending',count(*) filter(where status='pending'),'changesRequested',count(*) filter(where status='changes_requested')) from public.project_approval_requests where project_id=old.id));
 insert into public.project_sprint_snapshots(id,project_id,header,personal_cases)
 select episode.id,old.id,header_data,coalesce(jsonb_agg(to_jsonb(m)||jsonb_build_object('current_sprint_id',old.sprint_id,'project_name',old.name)),'[]'::jsonb)
 from private.personal_sprint_cases(new.sprint_id) m where m.project_id=old.id;
 update public.project_sprint_participations set baseline_results=(
   select coalesce(jsonb_agg(jsonb_build_object('projectId',old.id,'caseId',m->>'testcase_key','sourceSheet',coalesce(r->>'sourceSheet',''),'resultId',r->>'id')),'[]'::jsonb)
   from public.project_sprint_snapshots s cross join lateral jsonb_array_elements(s.personal_cases) m
   cross join lateral jsonb_array_elements(m->'results') r where s.id=episode.id
 ) where id=next_episode;
 insert into public.project_sprint_snapshot_cases(snapshot_id,project_id,position,payload)
 select episode.id,old.id,row_number() over(order by tc.sort_order,tc.id)-1,
 to_jsonb(tc)||jsonb_build_object('test_executions',coalesce((select jsonb_agg(to_jsonb(e)) from (select * from public.test_executions where test_case_id=tc.id order by attempt_no desc,id limit 1) e),'[]'::jsonb))
 from public.test_cases tc where tc.project_id=old.id;
 update public.project_sprint_snapshots set case_count=(select count(*) from public.project_sprint_snapshot_cases where snapshot_id=episode.id) where id=episode.id;
 return new;
end;
$$;
revoke all on function private.capture_project_continuation() from public,anon,authenticated;
-- Capture precedes the existing audit trigger; any failure rolls back both.
drop trigger if exists project_continuation_capture on public.projects;
create trigger project_continuation_capture after insert or update on public.projects for each row execute function private.capture_project_continuation();

-- The existing audit trigger runs after capture. Link its authoritative event
-- so a later migration rerun cannot backfill this full episode as legacy.
create or replace function private.link_continuation_history() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.after_data->>'kind'='sprint_move' then
  update public.project_sprint_participations e set history_id=new.id
  where e.project_id=new.project_id and e.snapshot_kind='full' and e.history_id is null
  and e.sprint_id::text=new.before_data->>'sprintId'
  and e.next_id=(select a.id from public.project_sprint_participations a where a.project_id=new.project_id and a.exited_at is null);
 end if;
 return new;
end;
$$;
revoke all on function private.link_continuation_history() from public,anon,authenticated;
drop trigger if exists continuation_history_link on public.project_history;
create trigger continuation_history_link after insert on public.project_history for each row execute function private.link_continuation_history();

-- A Result/source writer holds SHARE on Project until commit. A Sprint UPDATE
-- needs a conflicting row lock, so capture cannot race with persisted writes.
create or replace function private.lock_project_for_snapshot() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op<>'INSERT' then perform 1 from public.projects where id=old.project_id for share; end if;
 if tg_op<>'DELETE' then perform 1 from public.projects where id=new.project_id for share; return new; end if;
 return old;
end;
$$;
revoke all on function private.lock_project_for_snapshot() from public,anon,authenticated;
do $$ declare tbl text; begin
 foreach tbl in array array['test_cases','test_executions','source_files','project_qa_assignments','project_approval_requests'] loop
 execute format('drop trigger if exists continuation_writer_lock on public.%I',tbl);
 execute format('create trigger continuation_writer_lock before insert or update or delete on public.%I for each row execute function private.lock_project_for_snapshot()',tbl);
 end loop;
end $$;
-- Case definition and Result are a single save transaction. Project lock is
-- acquired before touching either row, matching continuation's lock order.
create or replace function private.save_test_case_result(requested_project_id uuid,requested_case jsonb,requested_execution jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare case_id uuid; execution_id uuid; saved_reference text; key text:=requested_case->>'id';
begin
 if auth.uid() is null or not private.can_edit_project(requested_project_id) then raise exception 'Permission denied';end if;
 perform 1 from public.projects where id=requested_project_id for update;
 if not found then raise exception 'Project not found';end if;
 if length(trim(coalesce(key,''))) not between 1 and 500 or coalesce(requested_execution->>'status','') not in ('Not Start','In Progress','Pass','Failed','Skip') then raise exception 'Invalid case or Result';end if;
 if nullif(requested_case->>'recordId','') is not null then
   select id into case_id from public.test_cases where id=(requested_case->>'recordId')::uuid and project_id=requested_project_id for update;
   if not found then raise exception 'Test case must belong to this Project';end if;
 else
   insert into public.test_cases(project_id,testcase_key) values(requested_project_id,key)
   on conflict(project_id,testcase_key) do update set testcase_key=excluded.testcase_key returning id into case_id;
 end if;
 update public.test_cases set testcase_key=key,source_row=nullif((requested_case->>'sourceRow')::integer,0),sort_order=coalesce((requested_case->>'sourceRow')::integer,0),
   platform=coalesce(requested_case->>'platform',''),condition_text=coalesce(requested_case->>'condition',''),scenario=coalesce(requested_case->>'scenario',''),case_name=coalesce(requested_case->>'name',''),
   steps=coalesce(requested_case->>'steps',''),expected_result=coalesce(requested_case->>'expected',''),test_data=coalesce(requested_case->>'testData','')
 where id=case_id and project_id=requested_project_id;
 insert into public.test_executions(project_id,test_case_id,attempt_no,status,device,app_version,environment,remark,result_reference,executed_by_name,executed_date,executed_time,executed_by,executed_at)
 values(requested_project_id,case_id,1,requested_execution->>'status',coalesce(requested_execution->>'device',''),coalesce(requested_execution->>'appVersion',''),coalesce(requested_execution->>'environment',''),coalesce(requested_execution->>'remark',''),coalesce(requested_execution->>'resultReference',''),coalesce(requested_execution->>'executedBy',''),coalesce(requested_execution->>'executedDate',''),coalesce(requested_execution->>'executedTime',''),null,clock_timestamp())
 on conflict(test_case_id,attempt_no) do update set status=excluded.status,device=excluded.device,app_version=excluded.app_version,environment=excluded.environment,remark=excluded.remark,
 result_reference=excluded.result_reference,executed_by_name=excluded.executed_by_name,executed_date=excluded.executed_date,executed_time=excluded.executed_time,executed_by=excluded.executed_by,executed_at=excluded.executed_at
 returning id,result_reference into execution_id,saved_reference;
 return jsonb_build_object('recordId',case_id,'executionId',execution_id,'resultReference',saved_reference);
end;
$$;
revoke all on function private.save_test_case_result(uuid,jsonb,jsonb) from public,anon;
grant execute on function private.save_test_case_result(uuid,jsonb,jsonb) to authenticated;
create or replace function public.save_test_case_result(requested_project_id uuid,requested_case jsonb,requested_execution jsonb) returns jsonb
language sql security invoker set search_path='' as $$ select private.save_test_case_result(requested_project_id,requested_case,requested_execution) $$;
revoke all on function public.save_test_case_result(uuid,jsonb,jsonb) from public,anon;
grant execute on function public.save_test_case_result(uuid,jsonb,jsonb) to authenticated;
create or replace function public.project_sprint_continuation_ready() returns boolean language sql stable security invoker set search_path='' as $$ select true $$;
revoke all on function public.project_sprint_continuation_ready() from public,anon;
grant execute on function public.project_sprint_continuation_ready() to authenticated;
-- Explicit server cleanup access even on projects with hardened default grants.
do $$ begin
 if exists(select 1 from pg_roles where rolname='service_role') then
  grant select on public.project_sprint_participations,public.project_sprint_snapshots,public.project_sprint_snapshot_cases to service_role;
  grant execute on function public.project_sprint_continuation_ready() to service_role;
 end if;
end $$;
notify pgrst,'reload schema';
commit;
