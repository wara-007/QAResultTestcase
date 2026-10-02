begin;
-- Internal snapshot only. Public Sprint RPCs retain their existing access checks.
create or replace function private.project_move_snapshot(requested_project_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 with latest as (
   select distinct on(tc.id) tc.id,e.status,private.result_payload(e.result_reference) payload
   from public.test_cases tc left join public.test_executions e on e.test_case_id=tc.id
   where tc.project_id=requested_project_id
     and lower(trim(tc.testcase_key)) not in ('defected','defects','defect')
   order by tc.id,e.attempt_no desc nulls last,e.id
 ), counts as (
   select count(*) as total,count(*) filter(where status='Pass') as pass,
     count(*) filter(where status='Failed') as failed,count(*) filter(where status='Skip') as skip,
     count(*) filter(where status='In Progress') as in_progress,
     count(*) filter(where coalesce(status,'Not Start')='Not Start') as not_start from latest
 ), source as (
   select column_mapping from public.source_files where project_id=requested_project_id
   order by version_no desc,id desc limit 1
 ), raw_defects as (
   select d.value as defect,0 as priority,l.id::text||':'||d.ordinality::text as fallback
   from latest l cross join lateral jsonb_array_elements(
     case when jsonb_typeof(l.payload->'defects')='array' then l.payload->'defects' else '[]'::jsonb end
   ) with ordinality d
   union all
   select d.value,1,s.ordinality::text||':'||d.ordinality::text
   from source src cross join lateral jsonb_array_elements(
     case when jsonb_typeof(src.column_mapping->'sheets')='array' then src.column_mapping->'sheets' else '[]'::jsonb end
   ) with ordinality s cross join lateral jsonb_array_elements(
     case when jsonb_typeof(s.value->'defects')='array' then s.value->'defects' else '[]'::jsonb end
   ) with ordinality d
   where lower(trim(s.value->>'name')) in ('defected','defects','defect')
 ), by_id as (
   select distinct on(identity) * from (
     select *,coalesce(nullif(upper(trim(defect->>'id')),''),'legacy:'||fallback) as identity from raw_defects
   ) records order by identity,priority desc,fallback
 ), by_jira as (
   select distinct on(identity) defect from (
     select defect,priority,fallback,coalesce(nullif(lower(trim(defect->>'jiraUrl')),''),'id:'||identity) as identity from by_id
   ) records order by identity,priority desc,fallback
 ), defects as (
   select count(*) as total_defects,
     count(*) filter(where lower(trim(coalesce(defect->>'status','open'))) not in ('closed','resolved','pass','passed')) as open_defects
   from by_jira
 )
 select jsonb_build_object('totalCases',total,'pass',pass,'failed',failed,'skip',skip,'inProgress',in_progress,
   'notStart',not_start,'openDefects',open_defects,'totalDefects',total_defects,'closedDefects',total_defects-open_defects,
   'qaIds',(select coalesce(jsonb_agg(user_id order by user_id),'[]'::jsonb) from public.project_qa_assignments where project_id=requested_project_id))
 from counts cross join defects;
$$;
revoke all on function private.project_move_snapshot(uuid) from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
