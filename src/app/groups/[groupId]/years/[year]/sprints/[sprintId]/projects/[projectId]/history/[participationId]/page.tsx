import { notFound } from 'next/navigation';
import { loadProjectSprintHistory } from '@/lib/project-sprint-history-server';
import { requireProjectCapability, ProjectAccessError } from '@/lib/project-access-server';
import { loadPlanning } from '@/lib/planning-server';
import { ProjectSprintSnapshotView } from '@/components/project-sprint-snapshot-view';
export default async function HistoryPage({params,searchParams}:{params:Promise<{groupId:string;year:string;sprintId:string;projectId:string;participationId:string}>;searchParams:Promise<{case?:string;page?:string;q?:string}>}) {
 const ids=await params,search=await searchParams;
 const access=await requireProjectCapability(ids.projectId,'view');
 if(access.project.group_id!==ids.groupId) notFound();
 const planning=await loadPlanning(ids.groupId);
 if(!planning.sprints.some(s=>s.id===ids.sprintId && s.year===Number(ids.year))) notFound();
 const page=Math.max(1,Number(search.page)||1);
 let result;
 try {result=await loadProjectSprintHistory({...ids,offset:(page-1)*10,limit:10,caseId:search.case,query:search.q});} catch(e) {if(e instanceof ProjectAccessError && e.status===404)notFound();throw e;}
 const href=`/groups/${ids.groupId}/years/${ids.year}/sprints/${ids.sprintId}/projects/${ids.projectId}/history/${ids.participationId}`;
 return <ProjectSprintSnapshotView {...result} page={page} selectedCase={search.case} query={search.q} historyHref={href} currentHref={`/groups/${ids.groupId}/projects/${ids.projectId}/test-cases`}/>;
}
