begin;

alter table public.sprints add column if not exists goal text not null default '',
  add column if not exists status text not null default 'Planned' check (status in ('Planned','Active','Completed')),
  add column if not exists updated_at timestamptz not null default now();
alter table public.projects add column if not exists last_move_reason text not null default '';

create table if not exists public.sprint_history (
 id uuid primary key default gen_random_uuid(), sprint_id uuid not null references public.sprints on delete cascade,
 actor_id uuid references auth.users on delete set null, actor_email text not null default '',
 before_data jsonb not null, after_data jsonb not null, created_at timestamptz not null default now()
);
create index if not exists sprint_history_sprint_idx on public.sprint_history(sprint_id,created_at desc);
create table if not exists public.project_qa_assignments (
 project_id uuid not null references public.projects on delete cascade,
 user_id uuid not null references auth.users on delete cascade,
 assigned_by uuid references auth.users on delete set null, created_at timestamptz not null default now(),
 primary key(project_id,user_id)
);
create index if not exists project_qa_user_idx on public.project_qa_assignments(user_id);
create table if not exists public.result_origins (
 project_id uuid not null references public.projects on delete cascade,
 test_case_id uuid not null references public.test_cases on delete cascade,
 result_id text not null, source_sheet text not null default '',
 sprint_id uuid not null references public.sprints on delete restrict,
 sprint_name text not null, year integer not null,
 author_id uuid references auth.users on delete set null, author_name text not null default '',
 inferred boolean not null default false, recorded_at timestamptz not null default now(),
 active boolean not null default true, status text not null default 'Not Start', current_execution_id uuid,
 primary key(project_id,test_case_id,result_id,source_sheet)
);
create index if not exists result_origins_sprint_idx on public.result_origins(sprint_id,active,author_id);
create index if not exists result_origins_case_idx on public.result_origins(test_case_id);
create index if not exists result_origins_execution_idx on public.result_origins(current_execution_id);
alter table public.sprint_history enable row level security;
alter table public.project_qa_assignments enable row level security;
alter table public.result_origins enable row level security;
revoke all on public.sprint_history,public.project_qa_assignments,public.result_origins from public,anon,authenticated;
grant select on public.sprint_history,public.project_qa_assignments,public.result_origins to authenticated;
drop policy if exists sprint_history_read on public.sprint_history;
create policy sprint_history_read on public.sprint_history for select to authenticated using (exists(select 1 from public.sprints s where s.id=sprint_id and private.can_access_group(s.group_id)));
drop policy if exists project_qa_read on public.project_qa_assignments;
create policy project_qa_read on public.project_qa_assignments for select to authenticated using (private.can_view_project(project_id));
drop policy if exists result_origins_read on public.result_origins;
create policy result_origins_read on public.result_origins for select to authenticated using (private.can_view_project(project_id));

create or replace function private.can_manage_sprint(requested_sprint_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and private.has_app_access() and exists(select 1 from public.sprints s
 where s.id=requested_sprint_id and (private.can_manage_group(s.group_id) or (s.created_by=auth.uid() and private.can_plan_group(s.group_id))));
$$;
revoke all on function private.can_manage_sprint(uuid) from public,anon;
grant execute on function private.can_manage_sprint(uuid) to authenticated;
create or replace function public.can_manage_sprint(requested_sprint_id uuid) returns boolean
language sql stable security invoker set search_path='' as $$ select private.can_manage_sprint(requested_sprint_id) $$;
revoke all on function public.can_manage_sprint(uuid) from public,anon;
grant execute on function public.can_manage_sprint(uuid) to authenticated;

create or replace function private.update_sprint(requested_sprint_id uuid, requested_name text, requested_start date,
 requested_end date, requested_goal text, requested_status text, expected_updated_at timestamptz) returns timestamptz
language plpgsql security definer set search_path='' as $$
declare old_data public.sprints; saved_at timestamptz; actor_email text;
begin
 if not private.can_manage_sprint(requested_sprint_id) then raise exception 'Permission denied'; end if;
 select * into old_data from public.sprints where id=requested_sprint_id for update;
 if old_data.updated_at is distinct from expected_updated_at then raise exception 'Sprint changed; reload before editing'; end if;
 if length(trim(coalesce(requested_name,''))) not between 1 and 120 or length(coalesce(requested_goal,''))>2000
 or requested_status is null or requested_status not in ('Planned','Active','Completed') then raise exception 'Invalid Sprint data'; end if;
 if requested_start is not null and requested_end is not null and requested_end<requested_start then raise exception 'Invalid Sprint dates'; end if;
 if (old_data.name,old_data.start_date,old_data.end_date,old_data.goal,old_data.status)
 is not distinct from (trim(requested_name),requested_start,requested_end,trim(coalesce(requested_goal,'')),requested_status) then return old_data.updated_at; end if;
 update public.sprints set name=trim(requested_name),start_date=requested_start,end_date=requested_end,
 goal=trim(coalesce(requested_goal,'')),status=requested_status,updated_at=clock_timestamp()
 where id=requested_sprint_id returning updated_at into saved_at;
 update public.projects set sprint_no=trim(requested_name) where sprint_id=requested_sprint_id;
 select email into actor_email from auth.users where id=auth.uid();
 insert into public.sprint_history(sprint_id,actor_id,actor_email,before_data,after_data)
 select requested_sprint_id,auth.uid(),coalesce(actor_email,''),to_jsonb(old_data),to_jsonb(s) from public.sprints s where s.id=requested_sprint_id;
 return saved_at;
end;
$$;
revoke all on function private.update_sprint(uuid,text,date,date,text,text,timestamptz) from public,anon;
grant execute on function private.update_sprint(uuid,text,date,date,text,text,timestamptz) to authenticated;
create or replace function public.update_sprint(requested_sprint_id uuid, requested_name text, requested_start date,
 requested_end date, requested_goal text, requested_status text, expected_updated_at timestamptz) returns timestamptz
language sql security invoker set search_path='' as $$
 select private.update_sprint(requested_sprint_id,requested_name,requested_start,requested_end,requested_goal,requested_status,expected_updated_at);
$$;
revoke all on function public.update_sprint(uuid,text,date,date,text,text,timestamptz) from public,anon;
grant execute on function public.update_sprint(uuid,text,date,date,text,text,timestamptz) to authenticated;

create or replace function private.set_project_qa(requested_project_id uuid, requested_user_ids uuid[]) returns void
language plpgsql security definer set search_path='' as $$
declare grp text; previous jsonb; current_data jsonb; actor_email text;
begin
 if auth.uid() is null or not private.can_manage_project(requested_project_id) then raise exception 'Permission denied'; end if;
 select group_id into grp from public.projects where id=requested_project_id for update;
 if requested_user_ids is null or cardinality(requested_user_ids)>100 then raise exception 'Invalid QA list'; end if;
 if exists(select 1 from unnest(requested_user_ids) candidate where candidate is null or not exists(
 select 1 from public.groups g where g.id=grp and (g.owner_id=candidate or exists(select 1 from public.group_members m
 where m.group_id=grp and m.user_id=candidate and m.role in ('qa','qa_lead','admin'))))) then raise exception 'Select a registered QA member of this Group'; end if;
 select coalesce(jsonb_agg(user_id order by user_id),'[]') into previous from public.project_qa_assignments where project_id=requested_project_id;
 select coalesce(jsonb_agg(candidate order by candidate),'[]') into current_data from (select distinct unnest(requested_user_ids) candidate) ids;
 if previous=current_data then return; end if;
 delete from public.project_qa_assignments where project_id=requested_project_id;
 insert into public.project_qa_assignments(project_id,user_id,assigned_by)
 select requested_project_id,candidate,auth.uid() from (select distinct unnest(requested_user_ids) candidate) ids;
 update public.projects set updated_at=clock_timestamp() where id=requested_project_id;
 select email into actor_email from auth.users where id=auth.uid();
 insert into public.project_history(project_id,actor_id,actor_email,before_data,after_data)
 values(requested_project_id,auth.uid(),coalesce(actor_email,''),jsonb_build_object('qaIds',previous),jsonb_build_object('kind','qa_assignment','qaIds',current_data));
end;
$$;
revoke all on function private.set_project_qa(uuid,uuid[]) from public,anon;
grant execute on function private.set_project_qa(uuid,uuid[]) to authenticated;
create or replace function public.set_project_qa(requested_project_id uuid, requested_user_ids uuid[]) returns void
language sql security invoker set search_path='' as $$ select private.set_project_qa(requested_project_id,requested_user_ids) $$;
revoke all on function public.set_project_qa(uuid,uuid[]) from public,anon;
grant execute on function public.set_project_qa(uuid,uuid[]) to authenticated;

create or replace function private.planning_team(requested_group_id text)
returns table(user_id uuid,email text,display_name text,role text)
language sql stable security definer set search_path='' as $$
 select u.id,coalesce(u.email,''),coalesce(nullif(p.display_name,''),split_part(u.email,'@',1)),members.role
 from (select g.owner_id as user_id,'admin'::text as role from public.groups g where g.id=requested_group_id
 union select m.user_id,m.role from public.group_members m where m.group_id=requested_group_id
 and m.user_id is distinct from (select g.owner_id from public.groups g where g.id=requested_group_id)) members
 join auth.users u on u.id=members.user_id left join public.profiles p on p.id=u.id
 where auth.uid() is not null and private.can_access_group(requested_group_id);
$$;
revoke all on function private.planning_team(text) from public,anon;
grant execute on function private.planning_team(text) to authenticated;
create or replace function public.planning_team(requested_group_id text)
returns table(user_id uuid,email text,display_name text,role text)
language sql stable security invoker set search_path='' as $$ select * from private.planning_team(requested_group_id) $$;
revoke all on function public.planning_team(text) from public,anon;
grant execute on function public.planning_team(text) to authenticated;

create or replace function private.result_payload(reference text) returns jsonb
language plpgsql immutable security invoker set search_path='' as $$
begin
 if reference not like 'qa-results:%' then return '{}'::jsonb; end if;
 return substring(reference from 12)::jsonb;
exception when others then return '{}'::jsonb;
end;
$$;
revoke all on function private.result_payload(text) from public,anon,authenticated;
create or replace function private.project_move_snapshot(requested_project_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 with latest as (select distinct on(tc.id) tc.id,e.status,private.result_payload(e.result_reference) payload
 from public.test_cases tc left join public.test_executions e on e.test_case_id=tc.id
 where tc.project_id=requested_project_id order by tc.id,e.attempt_no desc nulls last,e.id),
 counts as (select count(*) as total,count(*) filter(where status='Pass') as pass,
 count(*) filter(where status='Failed') as failed,count(*) filter(where status='Skip') as skip,
 count(*) filter(where status='In Progress') as in_progress,
 count(*) filter(where coalesce(status,'Not Start')='Not Start') as not_start from latest),
 defects as (select count(*) as count from latest l cross join lateral jsonb_array_elements(
 case when jsonb_typeof(l.payload->'defects')='array' then l.payload->'defects' else '[]'::jsonb end) d
 where lower(coalesce(d->>'status','open')) not in ('closed','resolved','pass','passed'))
 select jsonb_build_object('totalCases',total,'pass',pass,'failed',failed,'skip',skip,'inProgress',in_progress,
 'notStart',not_start,'openDefects',defects.count,'qaIds',(select coalesce(jsonb_agg(user_id order by user_id),'[]') from public.project_qa_assignments where project_id=requested_project_id)) from counts cross join defects;
$$;
revoke all on function private.project_move_snapshot(uuid) from public,anon,authenticated;

create or replace function private.validate_project_sprint() returns trigger
language plpgsql security invoker set search_path='' as $$
declare sprint_name text;
begin
 if tg_op='UPDATE' then
  if new.group_id is distinct from old.group_id then raise exception 'Cannot move Project to another Group'; end if;
  if (new.name,new.description,new.environment,new.sprint_id) is distinct from (old.name,old.description,old.environment,old.sprint_id)
  and not private.can_manage_project(old.id) then raise exception 'Permission denied'; end if;
  if new.sprint_id is distinct from old.sprint_id and length(trim(new.last_move_reason)) not between 1 and 2000 then raise exception 'Move reason is required'; end if;
 elsif not private.can_plan_group(new.group_id) then raise exception 'Permission denied'; end if;
 select s.name into sprint_name from public.sprints s where s.id=new.sprint_id and s.group_id=new.group_id;
 if sprint_name is null then raise exception 'Sprint must belong to this Group'; end if;
 new.sprint_no:=sprint_name;
 if tg_op='UPDATE' then new.updated_at:=clock_timestamp(); end if;
 return new;
end;
$$;
create or replace function private.record_project_history() returns trigger
language plpgsql security definer set search_path='' as $$
declare previous jsonb; current_data jsonb; actor_email text;
begin
 select jsonb_build_object('name',new.name,'description',new.description,'environment',new.environment,
 'sprintId',s.id,'sprint',s.name,'year',y.year) into current_data from public.sprints s join public.workspace_years y on y.id=s.year_id where s.id=new.sprint_id;
 if tg_op='UPDATE' then
  select jsonb_build_object('name',old.name,'description',old.description,'environment',old.environment,
  'sprintId',s.id,'sprint',s.name,'year',y.year) into previous from public.sprints s join public.workspace_years y on y.id=s.year_id where s.id=old.sprint_id;
  if previous=current_data then return new; end if;
  if new.sprint_id is distinct from old.sprint_id then
   current_data:=current_data||jsonb_build_object('kind','sprint_move','reason',trim(new.last_move_reason),'moveSnapshot',private.project_move_snapshot(new.id));
  end if;
 end if;
 select email into actor_email from auth.users where id=auth.uid();
 insert into public.project_history(project_id,actor_id,actor_email,before_data,after_data)
 values(new.id,auth.uid(),coalesce(actor_email,''),previous,current_data);
 return new;
end;
$$;

-- Database-owned origin registry: clients cannot change authors/Sprints, even by deleting and re-adding the same ID.
create or replace function private.stamp_result_origins() returns trigger
language plpgsql security definer set search_path='' as $$
declare payload jsonb; result jsonb; output jsonb:='[]'; origin public.result_origins; sp record;
 author_name text; source_name text; inferred boolean; is_latest boolean;
begin
 if tg_op='UPDATE' and (new.project_id,new.test_case_id) is distinct from (old.project_id,old.test_case_id) then raise exception 'Cannot reassign an execution'; end if;
 -- Lock the Project so a concurrent move cannot split provenance and move snapshot.
 select s.id,s.name,y.year into sp from public.projects p join public.sprints s on s.id=p.sprint_id
 join public.workspace_years y on y.id=s.year_id where p.id=new.project_id for share of p;
 if not exists(select 1 from public.test_cases tc where tc.id=new.test_case_id and tc.project_id=new.project_id) then raise exception 'Test case does not belong to Project'; end if;
 if auth.uid() is not null and not private.can_edit_project(new.project_id) then raise exception 'Permission denied'; end if;
 payload:=private.result_payload(new.result_reference);
 is_latest:=not exists(select 1 from public.test_executions e where e.test_case_id=new.test_case_id and e.id<>new.id and e.attempt_no>new.attempt_no);
 if is_latest then update public.result_origins set active=false where test_case_id=new.test_case_id; end if;
 if jsonb_typeof(payload->'results')<>'array' or payload->'results' is null then return new; end if;
 select coalesce(nullif(p.display_name,''),u.email,'') into author_name from auth.users u left join public.profiles p on p.id=u.id where u.id=auth.uid();
 for result in select value from jsonb_array_elements(payload->'results') loop
  if coalesce(result->>'id','')='' then output:=output||jsonb_build_array(result); continue; end if;
  source_name:=coalesce(result->>'sourceSheetName','');
  inferred:=auth.uid() is null or source_name<>'';
  insert into public.result_origins(project_id,test_case_id,result_id,source_sheet,sprint_id,sprint_name,year,author_id,author_name,inferred,active,status,current_execution_id)
  values(new.project_id,new.test_case_id,result->>'id',source_name,sp.id,sp.name,sp.year,
  case when inferred then null else auth.uid() end,case when inferred then '' else coalesce(author_name,'') end,inferred,is_latest,coalesce(result->>'status','Not Start'),new.id)
  on conflict(project_id,test_case_id,result_id,source_sheet) do nothing;
  select * into origin from public.result_origins where project_id=new.project_id and test_case_id=new.test_case_id and result_id=result->>'id' and source_sheet=source_name;
  if is_latest then update public.result_origins set active=true,status=coalesce(result->>'status','Not Start'),current_execution_id=new.id
   where project_id=new.project_id and test_case_id=new.test_case_id and result_id=result->>'id' and source_sheet=source_name; end if;
  result:=result||jsonb_build_object('origin',jsonb_build_object('sprintId',origin.sprint_id,'sprintName',origin.sprint_name,'year',origin.year,
  'authorId',origin.author_id,'authorName',origin.author_name,'inferred',origin.inferred,'recordedAt',origin.recorded_at));
  output:=output||jsonb_build_array(result);
 end loop;
 new.result_reference:='qa-results:'||(jsonb_set(payload,'{results}',output))::text;
 return new;
end;
$$;
revoke all on function private.stamp_result_origins() from public,anon,authenticated;
drop trigger if exists execution_stamp_origins on public.test_executions;
create trigger execution_stamp_origins before insert or update on public.test_executions for each row execute function private.stamp_result_origins();
-- Existing data has no reliable original Sprint/author. Backfill transparently as inferred, not as importer activity.
update public.test_executions set result_reference=result_reference where result_reference like 'qa-results:%';

create or replace function private.clear_deleted_result_origins() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 update public.result_origins set active=false where current_execution_id=old.id;
 -- Restore the previous attempt's current contribution if one remains.
 update public.test_executions set result_reference=result_reference where id=(select id from public.test_executions where test_case_id=old.test_case_id order by attempt_no desc limit 1);
 return old;
end;
$$;
revoke all on function private.clear_deleted_result_origins() from public,anon,authenticated;
drop trigger if exists execution_clear_origins on public.test_executions;
create trigger execution_clear_origins after delete on public.test_executions for each row execute function private.clear_deleted_result_origins();

create or replace function private.sprint_approval_totals(requested_sprint_id uuid)
returns table(project_id uuid,total bigint,approved bigint,pending bigint,changes_requested bigint)
language sql stable security definer set search_path='' as $$
 select p.id,count(a.project_id) filter(where a.status<>'revoked'),count(*) filter(where a.status='approved'),
 count(*) filter(where a.status='pending'),count(*) filter(where a.status='changes_requested')
 from public.projects p left join public.project_approval_requests a on a.project_id=p.id
 where p.sprint_id=requested_sprint_id and auth.uid() is not null and private.has_app_access() group by p.id;
$$;
revoke all on function private.sprint_approval_totals(uuid) from public,anon;
grant execute on function private.sprint_approval_totals(uuid) to authenticated;
create or replace function public.sprint_approval_totals(requested_sprint_id uuid)
returns table(project_id uuid,total bigint,approved bigint,pending bigint,changes_requested bigint)
language sql stable security invoker set search_path='' as $$ select * from private.sprint_approval_totals(requested_sprint_id) $$;
revoke all on function public.sprint_approval_totals(uuid) from public,anon;
grant execute on function public.sprint_approval_totals(uuid) to authenticated;
create or replace function private.sprint_project_counts(requested_sprint_id uuid)
returns table(project_id uuid,counts jsonb)
language sql stable security definer set search_path='' as $$
 select p.id,private.project_move_snapshot(p.id) from public.projects p where p.sprint_id=requested_sprint_id
 and auth.uid() is not null and private.has_app_access();
$$;
revoke all on function private.sprint_project_counts(uuid) from public,anon;
grant execute on function private.sprint_project_counts(uuid) to authenticated;
create or replace function public.sprint_project_counts(requested_sprint_id uuid)
returns table(project_id uuid,counts jsonb)
language sql stable security invoker set search_path='' as $$ select * from private.sprint_project_counts(requested_sprint_id) $$;
revoke all on function public.sprint_project_counts(uuid) from public,anon;
grant execute on function public.sprint_project_counts(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
