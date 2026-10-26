import 'server-only';
import { createClient } from './supabase/server';
import { requireProjectCapability, ProjectAccessError } from './project-access-server';
import { matchingSnapshotHeader, snapshotPage } from './project-sprint-history';
import { snapshotCaseFromStored, type StoredCaseInput } from './project-sprint-snapshot';
import { type Participation, type SnapshotHeader, type SnapshotCase } from './project-sprint-participation';
import { readSprintParticipationHeaders, readSprintSnapshotPerformance } from './project-sprint-dashboard-data';

export async function loadSprintParticipationHeaders(sprintId:string) {
  return readSprintParticipationHeaders(await createClient(),sprintId);
}

export async function loadProjectSprintHistory(input:{projectId:string;sprintId:string;participationId:string;offset?:number;limit?:number;caseId?:string;query?:string}) {
  const {supabase}=await requireProjectCapability(input.projectId,'view');
  const {offset,limit}=snapshotPage(input.offset,input.limit);
  const result=await supabase.from('project_sprint_snapshots').select('header,case_count').eq('id',input.participationId).eq('project_id',input.projectId).maybeSingle();
  if(result.error) throw new Error(result.error.message);
  if(!result.data) throw new ProjectAccessError('ไม่พบข้อมูลย้อนหลัง',404);
  let header:SnapshotHeader;
  try {header=matchingSnapshotHeader(result.data.header,input);} catch {throw new ProjectAccessError('ไม่พบข้อมูลย้อนหลังใน Sprint นี้',404);}
  if(header.participation.snapshotKind==='legacy-summary') return {header,cases:[] as SnapshotCase[],total:0};
  let query=supabase.from('project_sprint_snapshot_cases').select('id,snapshot_id,position,payload',{count:'exact'}).eq('project_id',input.projectId).eq('snapshot_id',input.participationId);
  if(input.caseId) query=query.eq('payload->>testcase_key',input.caseId);
  if(input.query?.trim()) {
    const value=input.query.trim().slice(0,200).replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/[%_]/g,'\\$&');
    query=query.or(`payload->>testcase_key.ilike."%${value}%",payload->>case_name.ilike."%${value}%"`);
  }
  const page=await query.order('position').order('id').range(offset,offset+limit-1);
  if(page.error) throw new Error(page.error.message);
  return {header,cases:(page.data ?? []).map(r=>({snapshotId:r.snapshot_id,position:r.position,testCase:snapshotCaseFromStored(r.payload as StoredCaseInput)})),total:page.count ?? result.data.case_count};
}

export async function loadSprintSnapshotPerformance(groupId:string,sprintId:string,episodes:Participation[]) {
  return readSprintSnapshotPerformance(await createClient(),groupId,sprintId,episodes);
}
