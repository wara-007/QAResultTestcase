import type {SupabaseClient} from '@supabase/supabase-js';
import {readAllRows} from './paged-rows';
import {readPlanningTeam} from './planning-team-data';
import {readSprintParticipationHeaders} from './project-sprint-dashboard-data';
import {readProjectDashboardSummary} from './project-dashboard-summary';
import {buildSprintDashboard,type SprintDashboardData,type MoveHistory} from './sprint-dashboard';
import type {Project,ProjectHistoryEntry} from './types';

export type SprintDashboardLoad={data?:SprintDashboardData;history:MoveHistory[];sprintHistory:ProjectHistoryEntry[];canManage:boolean;error:string};

/** Read only compact saved summaries. Detail payloads are a separate user action. */
export async function readSprintDashboardOverview(db:SupabaseClient,groupId:string,sprintId:string,projects:Project[],historyRequested=false):Promise<SprintDashboardLoad> {
 try {
  const current=projects.filter(project=>project.sprintId===sprintId);
  const metadataPromise=(async()=>{
   const byProject=new Map<string,{summary:Project['dashboardSummary'];cover:Project['coverSummary']}>();
   for(let offset=0;offset<current.length;offset+=25) {
    const result=await db.from('projects').select('id,source_files(id,summary:column_mapping->dashboardSummary,coverFields:column_mapping->coverSnapshot->fields,coverSheet:column_mapping->coverSnapshot->sheetName)').in('id',current.slice(offset,offset+25).map(project=>project.id)).order('id').order('version_no',{referencedTable:'source_files',ascending:false}).order('id',{referencedTable:'source_files',ascending:false}).limit(1,{referencedTable:'source_files'});
    if(result.error)throw new Error(result.error.message);
    for(const row of result.data ?? []) {
     const source=row.source_files?.[0];
     const fields=Array.isArray(source?.coverFields)?source.coverFields.filter((field:unknown):field is {label:string;value:string}=>!!field&&typeof field==='object'&&typeof (field as {label?:unknown}).label==='string'&&typeof (field as {value?:unknown}).value==='string'):[];
     byProject.set(row.id,{summary:source?readProjectDashboardSummary(source.summary,source.id):undefined,cover:source?.coverSheet?{sheetName:String(source.coverSheet),fields}:undefined});
    }
   }
   return byProject;
  })();
  const [metadata,team,assignments,approvals,canManage,participation,history,sprintHistory]=await Promise.all([
   metadataPromise,
   readPlanningTeam(db,groupId),
   readAllRows((a,b)=>db.from('project_qa_assignments').select('project_id,user_id,projects!inner(group_id)').eq('projects.group_id',groupId).order('project_id').order('user_id').range(a,b)),
   readAllRows<{project_id:string;total:number;approved:number;pending:number;changes_requested:number}>((a,b)=>db.rpc('sprint_approval_totals',{requested_sprint_id:sprintId}).order('project_id').range(a,b)),
   db.rpc('can_manage_sprint',{requested_sprint_id:sprintId}),
   readSprintParticipationHeaders(db,sprintId),
   historyRequested?readAllRows((a,b)=>db.from('project_history').select('id,project_id,actor_email,before_data,after_data,created_at,projects!inner(group_id)').eq('projects.group_id',groupId).or(`before_data->>sprintId.eq.${sprintId},after_data->>sprintId.eq.${sprintId}`).order('created_at',{ascending:false}).order('id').range(a,b)):Promise.resolve([]),
   historyRequested?readAllRows((a,b)=>db.from('sprint_history').select('id,actor_email,before_data,after_data,created_at').eq('sprint_id',sprintId).order('created_at',{ascending:false}).order('id').range(a,b)):Promise.resolve([]),
  ]);
  if(canManage.error)throw new Error(canManage.error.message);
  const enhanced=projects.map(project=>({...project,dashboardSummary:metadata.get(project.id)?.summary,coverSummary:metadata.get(project.id)?.cover}));
  const moves:MoveHistory[]=history.map(row=>({id:row.id,projectId:row.project_id,actorEmail:row.actor_email,createdAt:row.created_at,before:row.before_data,after:row.after_data}));
  const data:SprintDashboardData=buildSprintDashboard({...participation,sprintId,projects:enhanced,team,stats:[],origins:[],moves,assignments:assignments.map(row=>({projectId:row.project_id,userId:row.user_id})),approvals:approvals.map(row=>({projectId:row.project_id,total:Number(row.total),approved:Number(row.approved),pending:Number(row.pending),changesRequested:Number(row.changes_requested)})),summaries:current.flatMap(project=>{const summary=metadata.get(project.id)?.summary;return summary?[{projectId:project.id,counts:summary.counts}]:[];})});
  data.summaryPending=current.filter(project=>!metadata.get(project.id)?.summary).map(project=>project.id);
  data.loadedDetails=false;
  return {data,history:moves,sprintHistory,canManage:canManage.data===true,error:''};
 } catch(reason) {return {data:undefined,history:[],sprintHistory:[],canManage:false,error:reason instanceof Error?reason.message:'โหลดภาพรวม Sprint ไม่สำเร็จ'};}
}
