import "server-only";
import { readAllRows as allRows } from './paged-rows';
import { createClient } from "@/lib/supabase/server";
import type { PlanningTeamMember, Project, Sprint, WorkspaceYear } from "@/lib/types";
import { summarizeSprint, type SprintProjectStatsInput } from "./sprint-summary";
import { buildSprintDashboard, type MoveHistory, type ResultOriginRow, type MoveSnapshot } from './sprint-dashboard';
import { personalCasesFromMetadata, type PersonalMetadataRow } from './personal-performance-metadata';

export async function loadWorkspaceYears() {
  const db=await createClient();
  try {
    const rows=await allRows<{year:number}>((from,to)=>db.from('workspace_years').select('id,year').order('id').range(from,to));
    return {years:rows.map(row=>row.year),error:''};
  } catch(reason) {return {years:[] as number[],error:reason instanceof Error ? reason.message : 'โหลดรายการปีไม่สำเร็จ'};}
}

export async function loadPlanning(groupId: string) {
  const db = await createClient();
  const [years, sprints, group, access] = await Promise.all([
    db.from("workspace_years").select("id,group_id,year").eq("group_id", groupId).order("year", { ascending: false }),
    db.from("sprints").select("id,year_id,group_id,name,start_date,end_date,goal,status,updated_at").eq("group_id", groupId).order("created_at", { ascending: false }),
    db.from("groups").select("name").eq("id", groupId).maybeSingle(),
    db.rpc("can_plan_group", { requested_group_id: groupId }),
  ]);
  const yearRows: WorkspaceYear[] = (years.data ?? []).map((y) => ({ id: y.id, groupId: y.group_id, year: y.year }));
  return {
    years: yearRows,
    sprints: (sprints.data ?? []).map((s): Sprint => ({ id: s.id, yearId: s.year_id, groupId: s.group_id, name: s.name, year: yearRows.find((y) => y.id === s.year_id)?.year ?? 0, startDate: s.start_date ?? "", endDate: s.end_date ?? "",goal:s.goal,status:s.status,updatedAt:s.updated_at })),
    groupName: group.data?.name ?? "Group", canPlan: access.data === true,
    error: years.error || sprints.error || access.error ? "ยังไม่พร้อมใช้งาน ปี/Sprint กรุณารัน migrations years_sprints_project_history และ sprint_dashboard_origins_and_moves ก่อน" : group.error?.message ?? "",
  };
}

export async function loadPlanningTeam(groupId: string): Promise<PlanningTeamMember[]> {
  const db=await createClient();
  const rows=await allRows<{user_id:string;email:string;display_name:string;role:string}>((a,b)=>db.rpc('planning_team',{requested_group_id:groupId}).order('user_id').range(a,b));
  return rows.map((m: {user_id:string;email:string;display_name:string;role:string})=>({userId:m.user_id,email:m.email,name:m.display_name,role:m.role}));
}

export async function loadSprintDashboard(groupId: string,sprintId: string,projects: Project[]) {
  const db=await createClient();
  try {
    const [counts,approvals,team,assignments,origins,history,canManage,sprintHistory,personalMetadata]=await Promise.all([
      allRows<{project_id:string;counts:MoveSnapshot}>((a,b)=>db.rpc('sprint_project_counts',{requested_sprint_id:sprintId}).order('project_id').range(a,b)).then(data=>({data})),
      allRows<{project_id:string;total:number;approved:number;pending:number;changes_requested:number}>((a,b)=>db.rpc('sprint_approval_totals',{requested_sprint_id:sprintId}).order('project_id').range(a,b)).then(data=>({data})),
      loadPlanningTeam(groupId),
      allRows((a,b)=>db.from('project_qa_assignments').select('project_id,user_id,projects!inner(group_id)').eq('projects.group_id',groupId).order('project_id').order('user_id').range(a,b)),
      allRows((a,b)=>db.from('result_origins').select('project_id,test_case_id,result_id,source_sheet,sprint_id,author_id,author_name,inferred,recorded_at,active,status').eq('sprint_id',sprintId).eq('active',true).order('project_id').order('test_case_id').order('result_id').order('source_sheet').range(a,b)),
      allRows((a,b)=>db.from('project_history').select('id,project_id,actor_email,before_data,after_data,created_at,projects!inner(group_id)').eq('projects.group_id',groupId).or(`before_data->>sprintId.eq.${sprintId},after_data->>sprintId.eq.${sprintId}`).order('created_at',{ascending:false}).order('id').range(a,b)),
      db.rpc('can_manage_sprint',{requested_sprint_id:sprintId}),
      allRows((a,b)=>db.from('sprint_history').select('id,actor_email,before_data,after_data,created_at').eq('sprint_id',sprintId).order('created_at',{ascending:false}).order('id').range(a,b)),
      allRows<PersonalMetadataRow>((a,b)=>db.rpc('personal_sprint_cases',{requested_sprint_id:sprintId}).eq('group_id',groupId).order('record_id').range(a,b)),
    ]);
    if(canManage.error) throw new Error(canManage.error.message);
    const moves:MoveHistory[]=history.map(h=>({id:h.id,projectId:h.project_id,actorEmail:h.actor_email,createdAt:h.created_at,before:h.before_data,after:h.after_data}));
    const originRows:ResultOriginRow[]=origins.map(r=>({projectId:r.project_id,testCaseId:r.test_case_id,resultId:r.result_id,sourceSheet:r.source_sheet,sprintId:r.sprint_id,authorId:r.author_id,authorName:r.author_name,inferred:r.inferred,recordedAt:r.recorded_at,active:r.active,status:r.status}));
    const personalCases=personalCasesFromMetadata(personalMetadata);
    return {data:buildSprintDashboard({sprintId,projects,team,personalCases,stats:[],summaries:(counts.data ?? []).map((c:{project_id:string;counts:MoveSnapshot})=>({projectId:c.project_id,counts:c.counts})),approvals:(approvals.data ?? []).map((a:{project_id:string;total:number;approved:number;pending:number;changes_requested:number})=>({projectId:a.project_id,total:Number(a.total),approved:Number(a.approved),pending:Number(a.pending),changesRequested:Number(a.changes_requested)})),assignments:assignments.map(a=>({projectId:a.project_id,userId:a.user_id})),origins:originRows,moves}),history:moves,sprintHistory,canManage:canManage.data===true,error:''};
  } catch(reason) {return {data:undefined,history:[],sprintHistory:[],canManage:false,error:reason instanceof Error ? reason.message : 'โหลด Sprint Dashboard ไม่สำเร็จ'};}
}

export async function loadSprintSummary(sprintId: string, projectIds: string[]) {
  const db = await createClient();
  const inputs: SprintProjectStatsInput[] = projectIds.map((id) => ({ id, cases: [], approvals: [] }));
  if (!inputs.length) return { summary: summarizeSprint([]), error: "" };
  const byProject = new Map(inputs.map((p) => [p.id, p]));
  // Page through stored cases so the dashboard does not silently stop at the API's row cap.
  for (let offset = 0; ; offset += 500) {
    const result = await db.from("test_cases").select("id,project_id,test_executions(attempt_no,status,result_reference),projects!inner(sprint_id)").eq("projects.sprint_id", sprintId).order("id").range(offset, offset + 499);
    if (result.error) return { summary: summarizeSprint(inputs), error: result.error.message };
    for (const row of result.data ?? []) byProject.get(row.project_id)?.cases.push({ executions: row.test_executions ?? [] });
    if ((result.data?.length ?? 0) < 500) break;
  }
  const approvals = await db.rpc("sprint_approval_counts", { requested_sprint_id: sprintId });
  if (approvals.error) return { summary: summarizeSprint(inputs), error: approvals.error.message };
  for (const row of approvals.data ?? []) {
    const project = byProject.get(row.project_id);
    if (row.has_pending) project?.approvals.push({ status: "pending" });
    if (row.has_approved) project?.approvals.push({ status: "approved" });
  }
  return { summary: summarizeSprint(inputs), error: "" };
}
