import {summarizeSprint} from './sprint-summary';
import {collectProjectDefects,isProjectDefectSheet,summarizeProjectDefects} from './project-defects';
import type {TestCase,WorkbookSource} from './types';

const fields=['totalCases','pass','failed','skip','inProgress','notStart','openDefects','totalDefects','closedDefects'] as const;
export type ProjectDashboardCounts=Pick<ReturnType<typeof summarizeSprint>,typeof fields[number]>;
export type ProjectDashboardSummary={version:1;sourceId:string;token:string;updatedAt:string;sourceRevision?:string;importComplete:boolean;counts:ProjectDashboardCounts};
export class ProjectSummaryConflictError extends Error {}

export function buildProjectDashboardCounts(cases:TestCase[],sheets:Pick<WorkbookSource,'sheets'>['sheets']|{name:string;defects?:TestCase['defects']}[]=[]):ProjectDashboardCounts {
 const totals=summarizeSprint([{id:'project',approvals:[],cases:cases.map(item=>({testcaseKey:item.id,sourceRow:item.sourceRow,steps:item.steps,expected:item.expected,executions:[{attempt_no:1,status:item.status,result_reference:'qa-results:'+JSON.stringify({sourceSheetName:item.sourceSheetName})}]}))}]);
 const defects=summarizeProjectDefects(collectProjectDefects(cases.flatMap(item=>item.defects ?? []),sheets.filter(sheet=>isProjectDefectSheet(sheet.name)).flatMap(sheet=>sheet.defects ?? [])));
 return Object.fromEntries(fields.map(field=>[field,field==='openDefects'?defects.open:field==='totalDefects'?defects.total:field==='closedDefects'?defects.closed:totals[field]])) as ProjectDashboardCounts;
}
export function isProjectDashboardCounts(value:unknown):value is ProjectDashboardCounts {
 if(!value || typeof value!=='object' || Array.isArray(value))return false;
 const data=value as ProjectDashboardCounts;
 return fields.every(field=>Number.isSafeInteger(data[field])&&data[field]>=0)
  && data.totalCases===data.pass+data.failed+data.skip+data.inProgress+data.notStart
  && data.totalDefects===data.openDefects+data.closedDefects;
}
export function readProjectDashboardSummary(value:unknown,sourceId?:string):ProjectDashboardSummary|undefined {
 if(!value || typeof value!=='object')return;
 const data=value as ProjectDashboardSummary;
 if(data.version!==1 || !isProjectDashboardCounts(data.counts) || typeof data.sourceId!=='string' || !data.sourceId || data.sourceId.length>100 || (sourceId && data.sourceId!==sourceId)
  || typeof data.token!=='string' || !data.token || data.token.length>100 || typeof data.updatedAt!=='string' || !Number.isFinite(Date.parse(data.updatedAt))
  || typeof data.importComplete!=='boolean' || (data.sourceRevision!==undefined && (typeof data.sourceRevision!=='string'||data.sourceRevision.length>512)))return;
 return {version:1,sourceId:data.sourceId,token:data.token,updatedAt:data.updatedAt,importComplete:data.importComplete,counts:Object.fromEntries(fields.map(field=>[field,data.counts[field]])) as ProjectDashboardCounts,...(data.sourceRevision?{sourceRevision:data.sourceRevision}:{})};
}
export function mergeProjectDashboardSummary<T extends Record<string,unknown>>(mapping:T,next:ProjectDashboardSummary,expectedToken:string|null) {
 const current=readProjectDashboardSummary(mapping.dashboardSummary,next.sourceId);
 if((current?.token ?? null)!==expectedToken)throw new ProjectSummaryConflictError('ยอดสรุปถูกอัปเดตพร้อมกัน กรุณาอ่านข้อมูลล่าสุดแล้วลองใหม่');
 return {...mapping,dashboardSummary:next};
}
