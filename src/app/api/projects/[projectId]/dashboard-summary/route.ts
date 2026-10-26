import {createAdminClient} from '@/lib/supabase/admin';
import {ProjectAccessError,requireProjectCapability} from '@/lib/project-access-server';
import {updateSourceMapping} from '@/lib/source-mapping-checkpoint';
import {readSheetImportState} from '@/lib/sheet-import-state';
import {isProjectDashboardCounts,mergeProjectDashboardSummary,ProjectSummaryConflictError,type ProjectDashboardSummary} from '@/lib/project-dashboard-summary';

export const runtime='nodejs';
export async function POST(request:Request,{params}:{params:Promise<{projectId:string}>}) {
 try {
  const {projectId}=await params;
  const access=await requireProjectCapability(projectId,'edit');
  const body=await request.json() as {sourceId?:unknown;expectedToken?:unknown;counts?:unknown};
  if(typeof body.sourceId!=='string' || !/^[0-9a-f-]{36}$/i.test(body.sourceId) || !isProjectDashboardCounts(body.counts)
   || !(body.expectedToken===null || (typeof body.expectedToken==='string'&&body.expectedToken.length<=100)))return Response.json({error:'ยอดสรุปไม่ถูกต้อง'},{status:400});
  const latest=await access.supabase.from('source_files').select('id').eq('project_id',projectId).order('version_no',{ascending:false}).order('id',{ascending:false}).limit(1).maybeSingle();
  if(latest.error)throw new Error(latest.error.message);
  if(latest.data?.id!==body.sourceId)throw new ProjectSummaryConflictError('ไฟล์นำเข้าเปลี่ยน กรุณาอ่านข้อมูล Project ใหม่');
  const counts=body.counts,sourceId=body.sourceId,expectedToken=body.expectedToken;
  const token=crypto.randomUUID(),updatedAt=new Date().toISOString();
  let summary:ProjectDashboardSummary|undefined;
  await updateSourceMapping(createAdminClient(),projectId,sourceId,mapping=>{
   const imported=readSheetImportState(mapping.sheetImport);
   summary={version:1,sourceId,token,updatedAt,counts,importComplete:imported?.complete===true&&!imported.refreshRequired,...(imported?.sourceRevision?{sourceRevision:imported.sourceRevision}:{})};
   return mergeProjectDashboardSummary(mapping,summary,expectedToken);
  });
  return Response.json({summary},{headers:{'Cache-Control':'no-store'}});
 } catch(reason) {
  return Response.json({error:reason instanceof Error?reason.message:'บันทึกยอดสรุปไม่สำเร็จ'},{status:reason instanceof ProjectAccessError?reason.status:reason instanceof ProjectSummaryConflictError?409:500});
 }
}
