import type { SupabaseClient } from '@supabase/supabase-js';
import { readAllRows } from './paged-rows';
import { validateSnapshotHeader } from './project-sprint-snapshot';
import { selectSprintProjectEpisodes, type Participation, type SnapshotHeader } from './project-sprint-participation';
import { personalCasesFromMetadata, type PersonalMetadataRow } from './personal-performance-metadata';
import type { BaselineResult } from './sprint-result-scope';

export async function readSprintParticipationHeaders(db:SupabaseClient,sprintId:string) {
  const ready=await db.rpc('project_sprint_continuation_ready');
  if(ready.error?.code==='PGRST202' || ready.error?.code==='42883') return {episodes:[] as Participation[],headers:[] as SnapshotHeader[]};
  if(ready.error) throw new Error(ready.error.message);
  const rows=await readAllRows((a,b)=>db.from('project_sprint_participations').select('id,project_id,sprint_id,entered_at,exited_at,previous_id,next_id,actor_name,reason,snapshot_kind').eq('sprint_id',sprintId).order('id').range(a,b));
  const episodes:Participation[]=rows.map(r=>({id:r.id,projectId:r.project_id,sprintId:r.sprint_id,enteredAt:r.entered_at,exitedAt:r.exited_at,previousId:r.previous_id,nextId:r.next_id,actorName:r.actor_name,reason:r.reason,snapshotKind:r.snapshot_kind}));
  const selected=selectSprintProjectEpisodes(sprintId,episodes).filter(e=>e.exitedAt);
  const headers:SnapshotHeader[]=[];
  // Batch bounded IDs without fetching case payloads onto a Dashboard.
  for(let i=0;i<selected.length;i+=100) {
    const result=await db.from('project_sprint_snapshots').select('header').in('id',selected.slice(i,i+100).map(e=>e.id));
    if(result.error) throw new Error(result.error.message);
    headers.push(...(result.data ?? []).map(r=>validateSnapshotHeader(r.header)));
  }
  // Include previous Sprint names for active carried-in projects.
  const previousIds=episodes.filter(e=>!e.exitedAt && e.previousId).map(e=>e.previousId!);
  const previous=new Map<string,string>();
  for(let i=0;i<previousIds.length;i+=100) {
    const result=await db.from('project_sprint_participations').select('id,sprints(name)').in('id',previousIds.slice(i,i+100));
    if(result.error) throw new Error(result.error.message);
    for(const row of result.data ?? []) {const sprint=row.sprints as unknown as {name:string}|null;if(sprint) previous.set(row.id,sprint.name);}
  }
  return {episodes,headers,previousNames:Object.fromEntries(previous)};
}

export async function readSprintSnapshotPerformance(db:SupabaseClient,groupId:string,sprintId:string,episodes:Participation[]) {
 const closed=episodes.filter(e=>e.exitedAt).map(e=>e.id);
 const archived=[] as ReturnType<typeof personalCasesFromMetadata>;
 const baseline:BaselineResult[]=[];
 if(!episodes.length) return {archived,baseline};
 const sprint=await db.from('sprints').select('workspace_years(year)').eq('id',sprintId).single();
 if(sprint.error) throw new Error(sprint.error.message);
 const year=(sprint.data.workspace_years as unknown as {year:number}).year;
 const episodeBaselines=new Map<string,BaselineResult[]>();
 for(let i=0;i<episodes.length;i+=100) {
   const rows=await db.from('project_sprint_participations').select('id,baseline_results').in('id',episodes.slice(i,i+100).map(e=>e.id));
   if(rows.error) throw new Error(rows.error.message);
   for(const row of rows.data ?? []) episodeBaselines.set(row.id,row.baseline_results as BaselineResult[]);
 }
 for(let i=0;i<closed.length;i+=100) {
   const rows=await readAllRows((a,b)=>db.from('project_sprint_snapshots').select('id,project_id,personal_cases').in('id',closed.slice(i,i+100)).order('id').range(a,b));
   for(const row of rows) {
     const metadata=row.personal_cases as PersonalMetadataRow[];
     for(const item of personalCasesFromMetadata(metadata)) {
       item.snapshotAt=episodes.find(e=>e.id===row.id)?.exitedAt ?? '';
       item.baselineResultIds=(episodeBaselines.get(row.id) ?? []).filter(b=>b.projectId===item.projectId && b.caseId===item.caseId && b.sourceSheet===item.sourceRowKey).map(b=>b.resultId);
       item.detailPath=`/groups/${groupId}/years/${year}/sprints/${sprintId}/projects/${row.project_id}/history/${row.id}?case=${encodeURIComponent(item.caseId)}`;
       archived.push(item);
     }
   }
 }
 for(const episode of episodes.filter(e=>!e.exitedAt)) baseline.push(...episodeBaselines.get(episode.id) ?? []);
 return {archived,baseline};
}
