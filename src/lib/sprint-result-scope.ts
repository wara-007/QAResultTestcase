import type { PersonalCase } from './personal-test-performance';
type ScopeResult={id:string;origin?:{sprintId:string;inferred:boolean}};
export function classifySprintResult(result:ScopeResult,currentSprintId:string,baselineResultKeys:readonly string[]):'current'|'carried'|'unknown' {
 if(result.origin?.sprintId && result.origin.sprintId!==currentSprintId) return 'carried';
 if(baselineResultKeys.includes(result.id)) return 'carried';
 return result.origin && !result.origin.inferred ? 'current' : 'unknown';
}
export type BaselineResult={projectId:string;caseId:string;sourceSheet:string;resultId:string};
export function mergeSprintPersonalCases(live:PersonalCase[],archived:PersonalCase[],sprintId:string,baseline:BaselineResult[]):PersonalCase[] {
 const canonical=(id:string)=>id.startsWith('register:') ? 'legacy' : id;
 const key=(r:BaselineResult)=>JSON.stringify([r.projectId,r.caseId,r.sourceSheet,canonical(r.resultId)]);
 const carried=new Set(baseline.map(key));
 const frozenProjects=new Set(archived.map(c=>c.projectId));
 const merged=new Map<string,PersonalCase>();
 const chronological=[...archived].sort((a,b)=>(a.snapshotAt ?? '').localeCompare(b.snapshotAt ?? ''));
 for(const item of [...chronological,...live.filter(c=>c.currentSprintId===sprintId || !frozenProjects.has(c.projectId))]) {
   const id=JSON.stringify([item.projectId,item.caseId,item.sourceRowKey]);
   const previous=merged.get(id);
   const isCarried=(r:PersonalCase['results'][number])=>(r.originSprintId && r.originSprintId!==sprintId) || ((r.inferred || !r.originSprintId) && (item.snapshotAt ? (item.baselineResultIds ?? []).map(canonical).includes(canonical(r.id)) : carried.has(key({projectId:item.projectId,caseId:item.caseId,sourceSheet:r.sourceSheet,resultId:r.id}))));
   const results=item.results.filter(r=>!isCarried(r)).map(r=>item.snapshotAt ? {...r,detailPath:item.detailPath} : r);
   merged.set(id,{...item,carriedIn:item.results.some(isCarried) && results.length===0,results:[...new Map([...(previous?.results ?? []),...results].map(r=>[JSON.stringify([canonical(r.id),r.sourceSheet]),r])).values()],assignedUserIds:[...new Set([...(previous?.assignedUserIds ?? []),...item.assignedUserIds])]});
 }
 return [...merged.values()];
}
