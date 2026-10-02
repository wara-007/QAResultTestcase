begin;
create or replace function private.project_move_snapshot(requested_project_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 with latest as (select distinct on(tc.id) tc.id,e.status,private.result_payload(e.result_reference) payload
 from public.test_cases tc left join public.test_executions e on e.test_case_id=tc.id
 where tc.project_id=requested_project_id order by tc.id,e.attempt_no desc nulls last,e.id),
 counts as (select count(*) as total,count(*) filter(where status='Pass') as pass,
 count(*) filter(where status='Failed') as failed,count(*) filter(where status='Skip') as skip,
 count(*) filter(where status='In Progress') as in_progress,
 count(*) filter(where coalesce(status,'Not Start')='Not Start') as not_start from latest),
 defects as (select count(*) as total_defects, count(*) filter(where lower(coalesce(d->>'status','open')) not in ('closed','resolved','pass','passed')) as count from latest l cross join lateral jsonb_array_elements(
 case when jsonb_typeof(l.payload->'defects')='array' then l.payload->'defects' else '[]'::jsonb end) d)
 select jsonb_build_object('totalCases',total,'pass',pass,'failed',failed,'skip',skip,'inProgress',in_progress,
 'notStart',not_start,'openDefects',defects.count,'totalDefects',defects.total_defects,'closedDefects',defects.total_defects-defects.count,'qaIds',(select coalesce(jsonb_agg(user_id order by user_id),'[]') from public.project_qa_assignments where project_id=requested_project_id)) from counts cross join defects;
$$;
-- Deletion must go through the server action, which checks ownership and
-- cleans up external evidence before deleting rows. No Data API shortcut.
revoke delete on public.groups,public.projects from anon,authenticated;
drop policy if exists groups_delete_manager on public.groups;
drop policy if exists groups_delete_owner_or_system on public.groups;
create policy groups_delete_owner_or_system on public.groups for delete to authenticated
using ((select private.has_app_access()) and (owner_id=(select auth.uid()) or (select private.is_system_owner())));
notify pgrst,'reload schema';
commit;
