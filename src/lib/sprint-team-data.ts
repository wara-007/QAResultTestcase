import type { SupabaseClient } from '@supabase/supabase-js';
import { readAllRows } from './paged-rows';
import { readSprintDashboardOverview, type SprintDashboardLoad } from './sprint-dashboard-overview';
import { buildSprintDashboard } from './sprint-dashboard';
import { personalRegisterCases, type RegisterPerformanceRow } from './personal-register-cases';
import { summarizeSprint } from './sprint-summary';
import { isProjectSummarySheet } from './sheet-mapping-model';
import type { SnapshotHeader } from './project-sprint-participation';
import type { Project } from './types';

type RegisterRow=Omit<RegisterPerformanceRow,'steps'|'expected_result'>;

/** Read the Test cases register, never the Result / Step execution payload. */
export async function readSprintTeamData(db:SupabaseClient,groupId:string,sprintId:string,projects:Project[],onProgress:(message:string)=>void=()=>{}):Promise<SprintDashboardLoad> {
  try {
    const ids=projects.filter(project=>project.sprintId===sprintId).map(project=>project.id);
    onProgress('กำลังอ่านข้อมูลจากแท็บ Test cases');
    const [overview,rows]=await Promise.all([
      readSprintDashboardOverview(db,groupId,sprintId,projects),
      ids.length?readAllRows<RegisterRow>((start,end)=>db.from('test_cases')
        .select('id,project_id,testcase_key,case_name,source_row,test_executions!test_executions_test_case_id_fkey(attempt_no,status,executed_by_name,executed_date,executed_time)')
        .in('project_id',ids).gt('source_row',0).order('id')
        .order('attempt_no',{referencedTable:'test_executions',ascending:false}).limit(1,{referencedTable:'test_executions'})
        .range(start,end),500,{shrinkOnTimeout:true}):Promise.resolve([]),
    ]);
    if(overview.error || !overview.data)return overview;
    const base=overview.data;
    const register=rows.filter(row=>!isProjectSummarySheet(row.testcase_key)).map(row=>({...row,steps:'',expected_result:''}));
    const personalCases=personalRegisterCases(register,projects,groupId,sprintId,[]);
    const data=buildSprintDashboard({sprintId,projects:base.projects,team:base.personalPerformance.members,
      assignments:base.projects.flatMap(project=>project.qa.map(member=>({projectId:project.id,userId:member.userId}))),
      stats:[],origins:[],moves:[],episodes:base.episodes,headers:base.entries.map(entry=>entry.historical).filter((header):header is SnapshotHeader=>!!header),
      approvals:base.projects.map(project=>project.approval),personalCases,
      summaries:base.projects.map(project=>({projectId:project.id,counts:{...project.counts,...summarizeSprint([{id:project.id,approvals:[],cases:register.filter(row=>row.project_id===project.id).map(row=>({testcaseKey:row.testcase_key,sourceRow:row.source_row ?? 0,executions:(row.test_executions ?? []).map(execution=>({...execution,result_reference:''}))}))}]),openDefects:project.counts.openDefects,totalDefects:project.counts.totalDefects,closedDefects:project.counts.closedDefects}})),
    });
    return {...overview,data:{...data,summaryPending:base.summaryPending,loadedDetails:true,personalPerformance:{...data.personalPerformance,basis:'test-cases'}}};
  } catch(reason) {
    return {history:[],sprintHistory:[],canManage:false,error:reason instanceof Error?reason.message:'โหลดรายงานจาก Test cases ไม่สำเร็จ'};
  }
}
