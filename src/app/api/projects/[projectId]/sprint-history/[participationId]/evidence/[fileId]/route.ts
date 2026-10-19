import { requireProjectCapability, ProjectAccessError } from '@/lib/project-access-server';
import { validateSnapshotHeader, type StoredCaseInput } from '@/lib/project-sprint-snapshot';
import { readAllRows } from '@/lib/paged-rows';
import { snapshotEvidenceFromStored } from '@/lib/snapshot-evidence';
import { serveSharedDriveEvidence } from '@/lib/shared-drive-evidence';
import { loadCentralDriveEvidence } from '@/lib/shared-drive-evidence-server';
export const runtime='nodejs';
export async function GET(_request:Request,{params}:{params:Promise<{projectId:string;participationId:string;fileId:string}>}) {
 try {
  const ids=await params,{supabase}=await requireProjectCapability(ids.projectId,'view');
  const saved=await supabase.from('project_sprint_snapshots').select('header').eq('id',ids.participationId).eq('project_id',ids.projectId).maybeSingle();
  if(saved.error) throw new Error(saved.error.message);
  if(!saved.data) throw new ProjectAccessError('ไม่พบข้อมูลย้อนหลัง',404);
  const header=validateSnapshotHeader(saved.data.header);
  if(header.project.id!==ids.projectId || header.participation.id!==ids.participationId) throw new ProjectAccessError('ไม่พบข้อมูลย้อนหลัง',404);
  const rows=await readAllRows((a,b)=>supabase.from('project_sprint_snapshot_cases').select('payload').eq('snapshot_id',ids.participationId).eq('project_id',ids.projectId).order('id').range(a,b));
  const evidence=snapshotEvidenceFromStored(rows.map(r=>r.payload as StoredCaseInput)).find(e=>e.fileId===ids.fileId);
  if(!evidence) throw new ProjectAccessError('ไม่พบหลักฐานนี้ในประวัติ',404);
  if(evidence.provider==='cloudflare-r2' || evidence.provider==='external-url') {
    if(!evidence.url || !/^https?:\/\//i.test(evidence.url)) throw new ProjectAccessError('หลักฐานไม่พร้อมใช้งาน',404);
    return Response.redirect(evidence.url,307);
  }
  return await serveSharedDriveEvidence(ids.fileId,async()=>{},loadCentralDriveEvidence);
 } catch(e) {return Response.json({error:e instanceof Error ? e.message : 'โหลดหลักฐานไม่สำเร็จ'},{status:e instanceof ProjectAccessError ? e.status : 500,headers:{'Cache-Control':'private, no-store'}});}
}
