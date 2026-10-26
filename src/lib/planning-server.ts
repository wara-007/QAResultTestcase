import "server-only";
import { readAllRows as allRows } from './paged-rows';
import { createClient } from "@/lib/supabase/server";
import type { PlanningTeamMember, Project, Sprint, WorkspaceYear } from "@/lib/types";
import { summarizeSprint, type SprintProjectStatsInput } from "./sprint-summary";
import { readSprintDashboardData } from "./sprint-dashboard-data";

export async function loadWorkspaceYears() {
  const db=await createClient();
  try {
    const rows=await allRows<{year:number}>((from,to)=>db.from('workspace_years').select('id,year').order('id').range(from,to));
    return {years:rows.map(row=>row.year),error:''};
  } catch(reason) {return {years:[] as number[],error:reason instanceof Error ? reason.message : 'โหลดรายการปีไม่สำเร็จ'};}
}

export async function loadPlanning(groupId: string) {
  try {
  const db = await createClient();
  const [years, sprints, group, access] = await Promise.all([
    db.from("workspace_years").select("id,group_id,year").eq("group_id", groupId).order("year", { ascending: false }),
    db.from("sprints").select("id,year_id,group_id,name,start_date,end_date,goal,status,updated_at").eq("group_id", groupId).order("created_at", { ascending: false }),
    db.from("groups").select("name").eq("id", groupId).maybeSingle(),
    db.rpc("can_plan_group", { requested_group_id: groupId }),
  ]);
  const error = years.error || sprints.error || access.error || group.error;
  if (error) throw new Error(error.message);
  const yearRows: WorkspaceYear[] = (years.data ?? []).map((y) => ({ id: y.id, groupId: y.group_id, year: y.year }));
  return {
    years: yearRows,
    sprints: (sprints.data ?? []).map((s): Sprint => ({ id: s.id, yearId: s.year_id, groupId: s.group_id, name: s.name, year: yearRows.find((y) => y.id === s.year_id)?.year ?? 0, startDate: s.start_date ?? "", endDate: s.end_date ?? "",goal:s.goal,status:s.status,updatedAt:s.updated_at })),
    groupName: group.data?.name ?? "Group", canPlan: access.data === true,
    error: "",
  };
  } catch (reason) {
    return { years: [] as WorkspaceYear[], sprints: [] as Sprint[], groupName: "Group", canPlan: false,
      error: reason instanceof Error ? reason.message : "โหลดปี/Sprint ไม่สำเร็จ" };
  }
}

export async function loadPlanningTeam(groupId: string): Promise<PlanningTeamMember[]> {
  const db=await createClient();
  const rows=await allRows<{user_id:string;email:string;display_name:string;role:string}>((a,b)=>db.rpc('planning_team',{requested_group_id:groupId}).order('user_id').range(a,b));
  return rows.map((m: {user_id:string;email:string;display_name:string;role:string})=>({userId:m.user_id,email:m.email,name:m.display_name,role:m.role}));
}

export async function loadSprintOverview(groupId:string,sprintId:string,projects:Project[]) {
  const {readSprintDashboardOverview}=await import('./sprint-dashboard-overview');
  return readSprintDashboardOverview(await createClient(),groupId,sprintId,projects);
}

export async function loadSprintDashboard(groupId: string,sprintId: string,projects: Project[]) {
  return readSprintDashboardData(await createClient(),groupId,sprintId,projects);
}

export async function loadSprintSummary(sprintId: string, projectIds: string[]) {
  const db = await createClient();
  const inputs: SprintProjectStatsInput[] = projectIds.map((id) => ({ id, cases: [], approvals: [] }));
  if (!inputs.length) return { summary: summarizeSprint([]), error: "" };
  const byProject = new Map(inputs.map((p) => [p.id, p]));
  // Page through stored cases so the dashboard does not silently stop at the API's row cap.
  for (let offset = 0; ; offset += 500) {
    const result = await db.from("test_cases").select("id,project_id,testcase_key,source_row,steps,expected_result,test_executions!test_executions_test_case_id_fkey(attempt_no,status,result_reference),projects!test_cases_project_id_fkey!inner(sprint_id)").eq("projects.sprint_id", sprintId).order("id").range(offset, offset + 499);
    if (result.error) return { summary: summarizeSprint(inputs), error: result.error.message };
    for (const row of result.data ?? []) byProject.get(row.project_id)?.cases.push({ testcaseKey: row.testcase_key, sourceRow: row.source_row ?? 0, steps: row.steps, expected: row.expected_result, executions: row.test_executions ?? [] });
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
