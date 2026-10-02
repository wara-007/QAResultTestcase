-- Requires the existing Sprint/provenance and app authorization migrations.
create table if not exists public.test_case_qa_assignments (
 test_case_id uuid not null references public.test_cases on delete cascade,
 source_sheet text not null default '',
 user_id uuid not null references auth.users on delete cascade,
 assigned_by uuid references auth.users on delete set null,
 assigned_at timestamptz not null default now(),
 primary key(test_case_id,source_sheet,user_id),
 check(length(source_sheet)<=200)
);
create index if not exists test_case_qa_user_idx on public.test_case_qa_assignments(user_id);
alter table public.test_case_qa_assignments enable row level security;
revoke all on public.test_case_qa_assignments from public,anon,authenticated;
grant select on public.test_case_qa_assignments to authenticated;
drop policy if exists test_case_qa_read on public.test_case_qa_assignments;
create policy test_case_qa_read on public.test_case_qa_assignments for select to authenticated
using (exists(select 1 from public.test_cases tc where tc.id=test_case_id and private.can_view_project(tc.project_id)));

create or replace function private.eligible_test_qa(requested_group_id text)
returns table(user_id uuid,email text,display_name text,role text)
language sql stable security definer set search_path='' as $$
 select u.id,coalesce(u.email,''),coalesce(nullif(p.display_name,''),split_part(u.email,'@',1)),people.role
 from (select g.owner_id user_id,'admin'::text role from public.groups g where g.id=requested_group_id
 union select m.user_id,m.role from public.group_members m where m.group_id=requested_group_id and m.role in ('qa','qa_lead','admin')
 and m.user_id is distinct from (select g.owner_id from public.groups g where g.id=requested_group_id)) people
 join auth.users u on u.id=people.user_id left join public.profiles p on p.id=u.id
 where auth.uid() is not null and private.can_access_group(requested_group_id)
 and (exists(select 1 from private.app_authorizations a where a.email=lower(u.email) and a.enabled and a.user_type='qa')
 or exists(select 1 from private.system_owners s where s.user_id=u.id));
$$;
revoke all on function private.eligible_test_qa(text) from public,anon;
grant execute on function private.eligible_test_qa(text) to authenticated;
create or replace function public.eligible_test_qa(requested_group_id text)
returns table(user_id uuid,email text,display_name text,role text)
language sql stable security invoker set search_path='' as $$ select * from private.eligible_test_qa(requested_group_id) $$;
revoke all on function public.eligible_test_qa(text) from public,anon;
grant execute on function public.eligible_test_qa(text) to authenticated;

create or replace function private.set_test_case_qa(requested_project_id uuid,requested_case_ids uuid[],requested_user_ids uuid[],requested_source_sheets text[] default null)
returns void language plpgsql security definer set search_path='' as $$
declare grp text; sources text[];
begin
 if auth.uid() is null or not private.can_edit_project(requested_project_id) then raise exception 'Permission denied';end if;
 select group_id into grp from public.projects where id=requested_project_id for update;
 if not found then raise exception 'Project not found';end if;
 if requested_case_ids is null or cardinality(requested_case_ids)=0 or cardinality(requested_case_ids)>500 then raise exception 'Invalid case selection (1-500 rows)';end if;
 if requested_user_ids is null or cardinality(requested_user_ids)>100 then raise exception 'Invalid QA selection';end if;
 sources:=coalesce(requested_source_sheets,array_fill(''::text,array[cardinality(requested_case_ids)]));
 if cardinality(sources)<>cardinality(requested_case_ids) or exists(select 1 from unnest(sources) s where s is null or length(s)>200) then raise exception 'Invalid source selection';end if;
 if exists(select 1 from unnest(requested_case_ids) c where c is null or not exists(select 1 from public.test_cases tc where tc.id=c and tc.project_id=requested_project_id)) then raise exception 'Every case must belong to this Project';end if;
 if exists(select 1 from unnest(requested_user_ids) u where u is null or not exists(select 1 from private.eligible_test_qa(grp) q where q.user_id=u)) then raise exception 'Select an eligible QA member of this Group';end if;
 -- Lock selected cases in deterministic order; prevents concurrent replace from combining assignee sets.
 perform 1 from public.test_cases tc where tc.id=any(requested_case_ids) order by tc.id for update;
 delete from public.test_case_qa_assignments a using unnest(requested_case_ids,sources) target(case_id,source_sheet)
 where a.test_case_id=target.case_id and a.source_sheet=target.source_sheet;
 insert into public.test_case_qa_assignments(test_case_id,source_sheet,user_id,assigned_by)
 select distinct target.case_id,target.source_sheet,u,auth.uid() from unnest(requested_case_ids,sources) target(case_id,source_sheet) cross join unnest(requested_user_ids) u;
end;
$$;
revoke all on function private.set_test_case_qa(uuid,uuid[],uuid[],text[]) from public,anon;
grant execute on function private.set_test_case_qa(uuid,uuid[],uuid[],text[]) to authenticated;
create or replace function public.set_test_case_qa(requested_project_id uuid,requested_case_ids uuid[],requested_user_ids uuid[],requested_source_sheets text[] default null)
returns void language sql security invoker set search_path='' as $$ select private.set_test_case_qa(requested_project_id,requested_case_ids,requested_user_ids,requested_source_sheets) $$;
revoke all on function public.set_test_case_qa(uuid,uuid[],uuid[],text[]) from public,anon;
grant execute on function public.set_test_case_qa(uuid,uuid[],uuid[],text[]) to authenticated;

-- Strip API response/log/evidence in PostgreSQL, rather than transfer them into the Dashboard.
create or replace function private.personal_sprint_cases(requested_sprint_id uuid)
returns table(record_id uuid,project_id uuid,project_name text,group_id text,current_sprint_id uuid,testcase_key text,case_name text,results jsonb,assignments jsonb)
language sql stable security definer set search_path='' as $$
 select tc.id,p.id,p.name,p.group_id,p.sprint_id,tc.testcase_key,tc.case_name,
 coalesce((select jsonb_agg(jsonb_build_object(
 'id',coalesce(r.value->>'id','legacy-'||r.ordinality),
 'testerName',coalesce(
 (select nullif(f->>'value','') from jsonb_array_elements(case when jsonb_typeof(r.value->'customFields')='array' then r.value->'customFields' else '[]'::jsonb end) f where regexp_replace(lower(f->>'label'),'[^a-z]','','g') in ('executedby','tester','testedby') or f->>'label' in ('ผู้ทดสอบ','ชื่อผู้ทดสอบ') limit 1),
 case when r.value ? 'testerName' then coalesce(r.value->>'testerName','') else coalesce(case when not coalesce(o.inferred,true) then nullif(o.author_name,'') end,nullif(e.executed_by_name,''),'') end),
 'authorId',o.author_id,'authorName',o.author_name,'status',coalesce(r.value->>'status',e.status,'Not Start'),
 'sourceSheet',coalesce(r.value->>'sourceSheetName',''), 'source',coalesce(r.value->>'source',case when coalesce(o.inferred,true) then 'sheets' else 'web' end), 'recordedAt',coalesce(r.value->>'createdAt',''),
 'order',-r.ordinality,'originSprintId',o.sprint_id,'inferred',coalesce(o.inferred,true)) order by r.ordinality)
 from jsonb_array_elements(case when jsonb_typeof(private.result_payload(e.result_reference)->'results')='array' then private.result_payload(e.result_reference)->'results' else '[]'::jsonb end) with ordinality r(value,ordinality)
 left join public.result_origins o on o.test_case_id=tc.id and o.result_id=r.value->>'id' and o.source_sheet=coalesce(r.value->>'sourceSheetName','') and o.active),
 case when e.id is not null and (case when jsonb_typeof(private.result_payload(e.result_reference)->'results')='array' then jsonb_array_length(private.result_payload(e.result_reference)->'results')=0 else true end) and coalesce(e.status,'Not Start')<>'Not Start' then jsonb_build_array(jsonb_build_object('id','legacy','testerName',coalesce(e.executed_by_name,''),'status',e.status,'sourceSheet','','recordedAt',e.created_at,'order',0,'inferred',true)) else '[]'::jsonb end),
 coalesce((select jsonb_agg(jsonb_build_object('sourceSheet',a.source_sheet,'userId',a.user_id)) from public.test_case_qa_assignments a where a.test_case_id=tc.id),'[]'::jsonb)
 from public.test_cases tc join public.projects p on p.id=tc.project_id
 left join lateral (select ex.* from public.test_executions ex where ex.test_case_id=tc.id order by ex.attempt_no desc,ex.created_at desc,ex.id limit 1) e on true
 where auth.uid() is not null and private.can_view_project(p.id)
 and (p.sprint_id=requested_sprint_id or exists(select 1 from public.result_origins o where o.test_case_id=tc.id and o.sprint_id=requested_sprint_id and o.active));
$$;
revoke all on function private.personal_sprint_cases(uuid) from public,anon;
grant execute on function private.personal_sprint_cases(uuid) to authenticated;
create or replace function public.personal_sprint_cases(requested_sprint_id uuid)
returns table(record_id uuid,project_id uuid,project_name text,group_id text,current_sprint_id uuid,testcase_key text,case_name text,results jsonb,assignments jsonb)
language sql stable security invoker set search_path='' as $$ select * from private.personal_sprint_cases(requested_sprint_id) $$;
revoke all on function public.personal_sprint_cases(uuid) from public,anon;
grant execute on function public.personal_sprint_cases(uuid) to authenticated;



create or replace function private.stamp_result_origins() returns trigger
language plpgsql security definer set search_path='' as $$
declare payload jsonb; result jsonb; output jsonb:='[]'; origin public.result_origins; sp record;
 author_name text; source_name text; inferred boolean; is_latest boolean; previous_result jsonb; tester_name text;
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
  inferred:=auth.uid() is null or (source_name<>'' and coalesce(result->>'source','sheets')<>'web');
  if not (result ? 'testerName') then
   select nullif(f->>'value','') into tester_name from jsonb_array_elements(case when jsonb_typeof(result->'customFields')='array' then result->'customFields' else '[]'::jsonb end) f
   where regexp_replace(lower(f->>'label'),'[^a-z]','','g') in ('executedby','tester','testedby') or f->>'label' in ('ผู้ทดสอบ','ชื่อผู้ทดสอบ') limit 1;
   previous_result:=null;
   if tg_op='UPDATE' then
    select v into previous_result from jsonb_array_elements(case when jsonb_typeof(private.result_payload(old.result_reference)->'results')='array' then private.result_payload(old.result_reference)->'results' else '[]'::jsonb end) v
    where v->>'id'=result->>'id' and coalesce(v->>'sourceSheetName','')=source_name limit 1;
   end if;
   tester_name:=coalesce(tester_name,previous_result->>'testerName',case when previous_result is not null then old.executed_by_name else new.executed_by_name end,'');
   result:=result||jsonb_build_object('testerName',tester_name);
  end if;
  if not (result ? 'source') then result:=result||jsonb_build_object('source',case when inferred then 'sheets' else 'web' end);end if;
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
notify pgrst,'reload schema';
