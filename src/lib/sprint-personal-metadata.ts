import { parseStoredResults } from './stored-results';
import type { RegisterPerformanceRow } from './personal-register-cases';
import type { PersonalMetadataRow } from './personal-performance-metadata';

type Origin = {test_case_id:string;result_id:string;source_sheet:string;author_id:string|null;author_name:string;sprint_id:string;inferred:boolean;active:boolean};
type Assignment = {test_case_id:string;source_sheet:string;user_id:string};

/** Project the already-read execution payloads; never send logs into the dashboard. */
export function sprintPersonalMetadata(rows: RegisterPerformanceRow[], projects: {id:string;name:string;sprintId?:string}[], groupId:string, origins:Origin[], assignments:Assignment[]):PersonalMetadataRow[] {
  const byOrigin=new Map(origins.filter(row=>row.active).map(row=>[JSON.stringify([row.test_case_id,row.result_id,row.source_sheet]),row]));
  const byProject=new Map(projects.map(project=>[project.id,project]));
  return rows.flatMap(row=>{
    const project=byProject.get(row.project_id);
    if(!project) return [];
    const latest=[...(row.test_executions ?? [])].sort((a,b)=>b.attempt_no-a.attempt_no)[0];
    const detailed=parseStoredResults(latest?.result_reference).results;
    const results:PersonalMetadataRow['results']=detailed.map((result,index)=>{
      const id=result.id ?? `legacy-${index+1}`;
      const sourceSheet=result.sourceSheetName ?? '';
      const origin=byOrigin.get(JSON.stringify([row.id,id,sourceSheet]));
      const customTester=result.customFields?.find(field=>(/^(executedby|tester|testedby)$/.test(String(field.label ?? '').toLowerCase().replace(/[^a-z]/g,'')) || ['ผู้ทดสอบ','ชื่อผู้ทดสอบ'].includes(field.label)))?.value || undefined;
      const testerName=customTester ?? (Object.hasOwn(result,'testerName') ? result.testerName ?? '' : (!origin?.inferred ? origin?.author_name || undefined : undefined) ?? latest?.executed_by_name ?? '');
      return {id,testerName,authorId:origin?.author_id ?? undefined,authorName:origin?.author_name,status:result.status ?? latest?.status ?? 'Not Start',sourceSheet,source:result.source ?? (origin?.inferred===false?'web':'sheets'),recordedAt:result.createdAt ?? '',order:-index-1,originSprintId:origin?.sprint_id,inferred:origin?.inferred ?? true};
    });
    if(!results.length && latest && latest.status!=='Not Start') results.push({id:'legacy',testerName:latest.executed_by_name ?? '',status:latest.status,sourceSheet:'',recordedAt:'',order:0,inferred:true});
    return [{record_id:row.id,project_id:row.project_id,project_name:project.name,group_id:groupId,current_sprint_id:project.sprintId ?? '',testcase_key:row.testcase_key,case_name:row.case_name,results,assignments:assignments.filter(item=>item.test_case_id===row.id).map(item=>({sourceSheet:item.source_sheet,userId:item.user_id}))}];
  });
}
