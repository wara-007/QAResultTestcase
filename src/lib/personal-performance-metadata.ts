import type { PersonalCase } from './personal-test-performance';

export type PersonalMetadataRow = {record_id:string;project_id:string;project_name:string;group_id:string;current_sprint_id:string;testcase_key:string;case_name:string;results:{id:string;testerName?:string;authorId?:string;authorName?:string;status?:string;sourceSheet?:string;source?:'web'|'sheets';recordedAt?:string;order?:number;originSprintId?:string;inferred?:boolean}[];assignments:{sourceSheet:string;userId:string}[]};
export function personalCasesFromMetadata(rows:PersonalMetadataRow[]):PersonalCase[] {
  return rows.flatMap(row=>{
    const results=Array.isArray(row.results) ? row.results : [];
    const assignments=Array.isArray(row.assignments) ? row.assignments : [];
    const sources=new Set([...results.map(r=>r.sourceSheet ?? ''),...assignments.map(a=>a.sourceSheet)]);
    if(!sources.size) sources.add('');
    return [...sources].map(sourceSheet=>({
      projectId:row.project_id,projectName:row.project_name,currentSprintId:row.current_sprint_id,caseId:row.testcase_key,caseName:row.case_name,sourceRowKey:sourceSheet,
      detailPath:`/groups/${encodeURIComponent(row.group_id)}/projects/${row.project_id}/${sourceSheet ? `sheets/${encodeURIComponent(sourceSheet)}` : `test-cases/${encodeURIComponent(row.testcase_key)}`}`,
      assignedUserIds:assignments.filter(a=>a.sourceSheet===sourceSheet).map(a=>a.userId),
      results:results.filter(r=>(r.sourceSheet ?? '')===sourceSheet).map((r,index)=>({
        id:r.id,testerName:r.testerName ?? '',
        testerId:!r.inferred && r.authorId && r.authorName?.trim().toLocaleLowerCase()===r.testerName?.trim().toLocaleLowerCase() ? r.authorId : undefined,
        status:r.status ?? 'Not Start',source:r.source ?? (sourceSheet || r.inferred ? 'sheets' as const : 'web' as const),sourceSheet,recordedAt:r.recordedAt ?? '',order:r.order ?? -index,
        originSprintId:r.originSprintId,inferred:r.inferred ?? true,
      })),
    }));
  });
}
