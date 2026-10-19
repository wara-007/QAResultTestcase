import { loadProjectSprintHistory } from '@/lib/project-sprint-history-server';
import { ProjectAccessError } from '@/lib/project-access-server';
export async function GET(request:Request,{params}:{params:Promise<{projectId:string;participationId:string}>}) {
  try {
    const ids=await params,url=new URL(request.url);
    const data=await loadProjectSprintHistory({...ids,sprintId:url.searchParams.get('sprintId') ?? '',offset:Number(url.searchParams.get('offset') ?? 0),limit:Number(url.searchParams.get('limit') ?? 10),caseId:url.searchParams.get('case') ?? undefined});
    return Response.json(data,{headers:{'Cache-Control':'private, no-store'}});
  } catch(error) {return Response.json({error:error instanceof Error ? error.message : 'โหลดประวัติไม่สำเร็จ'},{status:error instanceof ProjectAccessError ? error.status : 400});}
}
