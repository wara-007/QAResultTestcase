import { parseStoredResults } from "./stored-results";
import { collectProjectDefects, summarizeProjectDefects, isProjectDefectSheet } from "./project-defects";
import "server-only";
import { loadSprintParticipationHeaders, loadSprintSnapshotPerformance } from "./project-sprint-history-server";
import { mergeSprintPersonalCases } from './sprint-result-scope';
import { readAllRows as allRows } from './paged-rows';
import { createClient } from "@/lib/supabase/server";
import type { PlanningTeamMember, Project, Sprint, WorkspaceYear, WorkbookSheet } from "@/lib/types";
import { summarizeSprint, type SprintProjectStatsInput } from "./sprint-summary";
import { buildSprintDashboard, type MoveHistory, type ResultOriginRow } from './sprint-dashboard';
import { personalCasesFromMetadata, type PersonalMetadataRow } from './personal-performance-metadata';
import { personalRegisterCases } from './personal-register-cases';

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

export async function loadSprintDashboard(groupId: string,sprintId: string,projects: Project[]) {
  const db=await createClient();
  try {
    const [approvals,team,assignments,origins,history,canManage,sprintHistory,personalMetadata,caseRows,defectSources]=await Promise.all([
      allRows<{project_id:string;total:number;approved:number;pending:number;changes_requested:number}>((a,b)=>db.rpc('sprint_approval_totals',{requested_sprint_id:sprintId}).order('project_id').range(a,b)).then(data=>({data})).catch(reason => { throw new Error("สถานะ Approval: " + (reason instanceof Error ? reason.message : String(reason))); }),
      loadPlanningTeam(groupId).catch(reason => { throw new Error("ทีม QA: " + (reason instanceof Error ? reason.message : String(reason))); }),
      allRows((a,b)=>db.from('project_qa_assignments').select('project_id,user_id,projects!inner(group_id)').eq('projects.group_id',groupId).order('project_id').order('user_id').range(a,b)).catch(reason => { throw new Error("ผู้รับผิดชอบ: " + (reason instanceof Error ? reason.message : String(reason))); }),
      allRows((a,b)=>db.from('result_origins').select('project_id,test_case_id,result_id,source_sheet,sprint_id,author_id,author_name,inferred,recorded_at,active,status').eq('sprint_id',sprintId).eq('active',true).order('project_id').order('test_case_id').order('result_id').order('source_sheet').range(a,b)).catch(reason => { throw new Error("ที่มาผลทดสอบ: " + (reason instanceof Error ? reason.message : String(reason))); }),
      allRows((a,b)=>db.from('project_history').select('id,project_id,actor_email,before_data,after_data,created_at,projects!inner(group_id)').eq('projects.group_id',groupId).or(`before_data->>sprintId.eq.${sprintId},after_data->>sprintId.eq.${sprintId}`).order('created_at',{ascending:false}).order('id').range(a,b)).catch(reason => { throw new Error("ประวัติย้าย Project: " + (reason instanceof Error ? reason.message : String(reason))); }),
      Promise.resolve(db.rpc('can_manage_sprint',{requested_sprint_id:sprintId})).catch(reason => { throw new Error("สิทธิ์จัดการ Sprint: " + (reason instanceof Error ? reason.message : String(reason))); }),
      allRows((a,b)=>db.from('sprint_history').select('id,actor_email,before_data,after_data,created_at').eq('sprint_id',sprintId).order('created_at',{ascending:false}).order('id').range(a,b)).catch(reason => { throw new Error("ประวัติ Sprint: " + (reason instanceof Error ? reason.message : String(reason))); }),
      allRows<PersonalMetadataRow>((a,b)=>db.rpc('personal_sprint_cases',{requested_sprint_id:sprintId}).eq('group_id',groupId).order('record_id').range(a,b)).catch(reason => { throw new Error("ผลทดสอบรายบุคคล: " + (reason instanceof Error ? reason.message : String(reason))); }),
      allRows((a,b)=>db.from('test_cases').select('id,project_id,testcase_key,case_name,source_row,steps,expected_result,test_executions!test_executions_test_case_id_fkey(attempt_no,status,executed_by_name,result_reference,executed_date,executed_time),projects!test_cases_project_id_fkey!inner(sprint_id)').eq('projects.sprint_id',sprintId).order('id').order('attempt_no',{referencedTable:'test_executions',ascending:false}).limit(1,{referencedTable:'test_executions'}).range(a,b),10,{shrinkOnTimeout:true}).catch(reason => { throw new Error("รายการ Testcase: " + (reason instanceof Error ? reason.message : String(reason))); }),
      Promise.all(projects.filter(project => project.sprintId===sprintId).map(async project => {
        const source=await db.from('source_files').select('column_mapping').eq('project_id',project.id).order('version_no',{ascending:false}).order('id',{ascending:false}).limit(1);
        if(source.error) throw new Error(source.error.message);
        const mapping=source.data?.[0]?.column_mapping as {sheets?: WorkbookSheet[]}|undefined;
        return {projectId:project.id,defects:(mapping?.sheets ?? []).filter(sheet=>isProjectDefectSheet(sheet.name)).flatMap(sheet=>sheet.defects ?? [])};
      })).catch(reason=>{throw new Error('ทะเบียน Defect: '+(reason instanceof Error ? reason.message : String(reason)));}),
    ]);
    if(canManage.error) throw new Error(canManage.error.message);
    const participation=await loadSprintParticipationHeaders(sprintId);
    const moves:MoveHistory[]=history.map(h=>({id:h.id,projectId:h.project_id,actorEmail:h.actor_email,createdAt:h.created_at,before:h.before_data,after:h.after_data}));
    const originRows:ResultOriginRow[]=origins.map(r=>({projectId:r.project_id,testCaseId:r.test_case_id,resultId:r.result_id,sourceSheet:r.source_sheet,sprintId:r.sprint_id,authorId:r.author_id,authorName:r.author_name,inferred:r.inferred,recordedAt:r.recorded_at,active:r.active,status:r.status}));
    const frozen=await loadSprintSnapshotPerformance(groupId,sprintId,participation.episodes);
    const personalCases=mergeSprintPersonalCases(personalRegisterCases(caseRows, projects, groupId, sprintId, personalCasesFromMetadata(personalMetadata)),frozen.archived,sprintId,frozen.baseline);
    const verifiedCounts = new Map(projects.map(project => [project.id, summarizeSprint([{ id: project.id, approvals: [], cases: caseRows.filter(row => row.project_id === project.id).map(row => ({ testcaseKey: row.testcase_key, sourceRow: row.source_row ?? 0, steps: row.steps, expected: row.expected_result, executions: row.test_executions ?? [] })) }])]));
    const defectCounts=new Map(defectSources.map(source=>{
      const caseDefects=caseRows.filter(row=>row.project_id===source.projectId).flatMap(row=>parseStoredResults([...(row.test_executions ?? [])].sort((a,b)=>b.attempt_no-a.attempt_no)[0]?.result_reference).defects);
      return [source.projectId,summarizeProjectDefects(collectProjectDefects(caseDefects,source.defects))];
    }));
    return {data:buildSprintDashboard({...participation,sprintId,projects,team,personalCases,stats:[],summaries:[...verifiedCounts].map(([projectId,counts])=>{
      const defects=defectCounts.get(projectId);
      return {projectId,counts:{...counts,openDefects:defects?.open ?? counts.openDefects,totalDefects:defects?.total ?? counts.totalDefects,closedDefects:defects?.closed ?? counts.closedDefects}};
    }),approvals:(approvals.data ?? []).map((a:{project_id:string;total:number;approved:number;pending:number;changes_requested:number})=>({projectId:a.project_id,total:Number(a.total),approved:Number(a.approved),pending:Number(a.pending),changesRequested:Number(a.changes_requested)})),assignments:assignments.map(a=>({projectId:a.project_id,userId:a.user_id})),origins:originRows,moves}),history:moves,sprintHistory,canManage:canManage.data===true,error:''};
  } catch(reason) {return {data:undefined,history:[],sprintHistory:[],canManage:false,error:reason instanceof Error ? reason.message : 'โหลด Sprint Dashboard ไม่สำเร็จ'};}
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
