import type { SupabaseClient } from '@supabase/supabase-js';
import { parseStoredResults } from './stored-results';
import { collectProjectDefects, summarizeProjectDefects, isProjectDefectSheet } from './project-defects';
import { readSprintParticipationHeaders, readSprintSnapshotPerformance } from './project-sprint-dashboard-data';
import { mergeSprintPersonalCases } from './sprint-result-scope';
import { readAllRows as allRows, readAllRowsConcurrent } from './paged-rows';
import type { Project, WorkbookSheet } from './types';
import { summarizeSprint } from './sprint-summary';
import { buildSprintDashboard, type MoveHistory, type ResultOriginRow } from './sprint-dashboard';
import { personalCasesFromMetadata } from './personal-performance-metadata';
import { personalRegisterCases, type RegisterPerformanceRow } from './personal-register-cases';
import { sprintPersonalMetadata } from './sprint-personal-metadata';

export {readPlanningTeam} from './planning-team-data';
import {readPlanningTeam} from './planning-team-data';

export async function readSprintDashboardData(db:SupabaseClient,groupId: string,sprintId: string,projects: Project[], onProgress: (message:string)=>void = ()=>{}) {
  // Browser orchestration has no SSR deadline; serialize payload reads to
  // avoid exhausting the small database while imports/users are active.
  let rowsRead=0;
  onProgress('กำลังอ่านข้อมูล Sprint');
  try {
    const [approvals,team,assignments,origins,history,canManage,sprintHistory,caseRows,defectSources,caseAssignments]=await Promise.all([
      allRows<{project_id:string;total:number;approved:number;pending:number;changes_requested:number}>((a,b)=>db.rpc('sprint_approval_totals',{requested_sprint_id:sprintId}).order('project_id').range(a,b)).then(data=>({data})).catch(reason => { throw new Error("สถานะ Approval: " + (reason instanceof Error ? reason.message : String(reason))); }),
      readPlanningTeam(db,groupId).catch(reason => { throw new Error("ทีม QA: " + (reason instanceof Error ? reason.message : String(reason))); }),
      allRows((a,b)=>db.from('project_qa_assignments').select('project_id,user_id,projects!inner(group_id)').eq('projects.group_id',groupId).order('project_id').order('user_id').range(a,b)).catch(reason => { throw new Error("ผู้รับผิดชอบ: " + (reason instanceof Error ? reason.message : String(reason))); }),
      allRows((a,b)=>db.from('result_origins').select('project_id,test_case_id,result_id,source_sheet,sprint_id,author_id,author_name,inferred,recorded_at,active,status').in('project_id',projects.map(project=>project.id)).eq('active',true).order('project_id').order('test_case_id').order('result_id').order('source_sheet').range(a,b)).catch(reason => { throw new Error("ที่มาผลทดสอบ: " + (reason instanceof Error ? reason.message : String(reason))); }),
      allRows((a,b)=>db.from('project_history').select('id,project_id,actor_email,before_data,after_data,created_at,projects!inner(group_id)').eq('projects.group_id',groupId).or(`before_data->>sprintId.eq.${sprintId},after_data->>sprintId.eq.${sprintId}`).order('created_at',{ascending:false}).order('id').range(a,b)).catch(reason => { throw new Error("ประวัติย้าย Project: " + (reason instanceof Error ? reason.message : String(reason))); }),
      Promise.resolve(db.rpc('can_manage_sprint',{requested_sprint_id:sprintId})).catch(reason => { throw new Error("สิทธิ์จัดการ Sprint: " + (reason instanceof Error ? reason.message : String(reason))); }),
      allRows((a,b)=>db.from('sprint_history').select('id,actor_email,before_data,after_data,created_at').eq('sprint_id',sprintId).order('created_at',{ascending:false}).order('id').range(a,b)).catch(reason => { throw new Error("ประวัติ Sprint: " + (reason instanceof Error ? reason.message : String(reason))); }),
      readAllRowsConcurrent((a,b)=>db.from('test_cases').select('id,project_id,testcase_key,case_name,source_row,steps,expected_result,test_executions!test_executions_test_case_id_fkey(attempt_no,status,executed_by_name,result_reference,executed_date,executed_time),projects!test_cases_project_id_fkey!inner(sprint_id)').eq('projects.sprint_id',sprintId).order('id').order('attempt_no',{referencedTable:'test_executions',ascending:false}).limit(1,{referencedTable:'test_executions'}).range(a,b).then(result=>{ if(!result.error) {rowsRead+=(result.data ?? []).length;onProgress(`อ่านข้อมูลแล้ว ${rowsRead} แถว`);}return result;}),10,1).catch(reason => { throw new Error("รายการ Testcase: " + (reason instanceof Error ? reason.message : String(reason))); }),
      Promise.all(projects.filter(project => project.sprintId===sprintId).map(async project => {
        const source=await db.from('source_files').select('column_mapping').eq('project_id',project.id).order('version_no',{ascending:false}).order('id',{ascending:false}).limit(1);
        if(source.error) throw new Error(source.error.message);
        const mapping=source.data?.[0]?.column_mapping as {sheets?: WorkbookSheet[]}|undefined;
        return {projectId:project.id,defects:(mapping?.sheets ?? []).filter(sheet=>isProjectDefectSheet(sheet.name)).flatMap(sheet=>sheet.defects ?? [])};
      })).catch(reason=>{throw new Error('ทะเบียน Defect: '+(reason instanceof Error ? reason.message : String(reason)));}),
      allRows((a,b)=>db.from('test_case_qa_assignments').select('test_case_id,source_sheet,user_id,test_cases!inner(project_id)').in('test_cases.project_id',projects.map(project=>project.id)).order('test_case_id').order('source_sheet').order('user_id').range(a,b)).catch(reason=>{throw new Error('ผู้รับผิดชอบ Testcase: '+(reason instanceof Error ? reason.message : String(reason)));}),
    ]);
    if(canManage.error) throw new Error(canManage.error.message);
    // Keep live contributions in their origin Sprint after a project moves.
    // Read only the additional case IDs that have active origins in this Sprint.
    const loadedIds=new Set(caseRows.map(row=>row.id));
    const externalIds=[...new Set(origins.filter(row=>row.sprint_id===sprintId && !loadedIds.has(row.test_case_id)).map(row=>row.test_case_id))];
    const performanceRows:RegisterPerformanceRow[]=[...caseRows];
    for(let offset=0;offset<externalIds.length;offset+=100) {
      const extra=await readAllRowsConcurrent((a,b)=>db.from('test_cases').select('id,project_id,testcase_key,case_name,source_row,steps,expected_result,test_executions!test_executions_test_case_id_fkey(attempt_no,status,executed_by_name,result_reference,executed_date,executed_time)').in('id',externalIds.slice(offset,offset+100)).order('id').order('attempt_no',{referencedTable:'test_executions',ascending:false}).limit(1,{referencedTable:'test_executions'}).range(a,b),10,1);
      performanceRows.push(...extra);
    }
    const personalMetadata=sprintPersonalMetadata(performanceRows,projects,groupId,origins,caseAssignments);

    onProgress('กำลังสรุปผลงานและข้อมูลย้อนหลัง');
    const participation=await readSprintParticipationHeaders(db,sprintId);
    const moves:MoveHistory[]=history.map(h=>({id:h.id,projectId:h.project_id,actorEmail:h.actor_email,createdAt:h.created_at,before:h.before_data,after:h.after_data}));
    const originRows:ResultOriginRow[]=origins.map(r=>({projectId:r.project_id,testCaseId:r.test_case_id,resultId:r.result_id,sourceSheet:r.source_sheet,sprintId:r.sprint_id,authorId:r.author_id,authorName:r.author_name,inferred:r.inferred,recordedAt:r.recorded_at,active:r.active,status:r.status}));
    const frozen=await readSprintSnapshotPerformance(db,groupId,sprintId,participation.episodes);
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

