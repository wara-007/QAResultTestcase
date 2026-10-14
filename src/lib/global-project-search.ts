export type ProjectSearchRow = {
  id:string; name:string; environment:string; group_id:string; sprint_no:string;
  groups:{name:string}|null;
  sprints:{name:string;workspace_years:{year:number}|null}|null;
};
export type ProjectSearchHit = {id:string;name:string;environment:string;groupName:string;sprintName:string;year:number|null;href:string};

export function nextSearchOption(current:number,count:number,direction:'up'|'down') {
  if(!count) return -1;
  if(current<0 || current>=count) return direction==='up' ? count-1 : 0;
  return (current+(direction==='down'?1:-1)+count)%count;
}

export function searchPattern(query:string) {
  return `%${query.trim().replace(/[\\%_]/g,character=>`\\${character}`)}%`;
}

export async function globalProjectSearchResponse(request:Request,dependencies:{authorize:()=>Promise<void>;search:(pattern:string)=>Promise<ProjectSearchRow[]>}) {
  const headers={'Cache-Control':'private, no-store','Vary':'Cookie'};
  try {
    await dependencies.authorize();
    const query=(new URL(request.url).searchParams.get('q') ?? '').trim();
    if(query.length>120) return Response.json({error:'ค้นหาได้ไม่เกิน 120 ตัวอักษร'},{status:400,headers});
    if(query.length<2) return Response.json({projects:[],hasMore:false},{headers});
    const rows=await dependencies.search(searchPattern(query));
    const projects:ProjectSearchHit[]=rows.slice(0,25).map(row=>({
      id:row.id,name:row.name,environment:row.environment,groupName:row.groups?.name ?? 'Group',
      sprintName:row.sprints?.name || row.sprint_no,year:row.sprints?.workspace_years?.year ?? null,
      href:`/groups/${encodeURIComponent(row.group_id)}/projects/${encodeURIComponent(row.id)}/overview`,
    }));
    return Response.json({projects,hasMore:rows.length>25},{headers});
  } catch(reason) {
    const status=reason instanceof Error && 'status' in reason && (reason.status===401 || reason.status===403) ? reason.status : 500;
    return Response.json({error:status===401?'กรุณาเข้าสู่ระบบ':status===403?'บัญชีนี้ยังไม่มีสิทธิ์ใช้งาน':'ค้นหา Project ไม่สำเร็จ กรุณาลองใหม่'},{status,headers});
  }
}
