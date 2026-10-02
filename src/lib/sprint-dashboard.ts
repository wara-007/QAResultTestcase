import type { PlanningTeamMember, Project } from './types';
import { summarizeSprint, type SprintProjectStatsInput } from './sprint-summary';
import type { PersonalCase } from './personal-test-performance';

export type ApprovalTotals = { projectId: string; total: number; approved: number; pending: number; changesRequested: number };
export type ResultOriginRow = { projectId: string; testCaseId: string; resultId: string; sourceSheet: string; sprintId: string; authorId: string | null; authorName: string; inferred: boolean; recordedAt: string; active: boolean; status: string };
export type MoveHistory = { id: string; projectId: string; actorEmail: string; createdAt: string; before: Record<string, unknown> | null; after: Record<string, unknown> };
export type MoveSnapshot = { totalCases: number; pass: number; failed: number; skip: number; inProgress: number; notStart: number; openDefects: number; totalDefects?: number; closedDefects?: number };
export type SprintDashboardInput = { sprintId: string; projects: Project[]; team: PlanningTeamMember[]; personalCases?: PersonalCase[]; assignments: {projectId: string; userId: string}[]; stats: SprintProjectStatsInput[]; summaries?: {projectId: string; counts: MoveSnapshot}[]; approvals: ApprovalTotals[]; origins: ResultOriginRow[]; moves: MoveHistory[] };

export function buildSprintDashboard(input: SprintDashboardInput) {
  const stats = new Map(input.stats.map(p=>[p.id,p]));
  const members = new Map(input.team.map(p=>[p.userId,p]));
  const approvalByProject = new Map(input.approvals.map(p=>[p.projectId,p]));
  const current = input.projects.filter(p=>p.sprintId===input.sprintId);
  const projects = current.map(project=>{
    const counts=summarizeSprint([stats.get(project.id) ?? {id:project.id,cases:[],approvals:[]}]);
    const savedCounts=input.summaries?.find(s=>s.projectId===project.id)?.counts;
    if(savedCounts) Object.assign(counts,savedCounts,{totalDefects:savedCounts.totalDefects ?? savedCounts.openDefects,closedDefects:savedCounts.closedDefects ?? 0,progress:savedCounts.totalCases ? Math.round((savedCounts.pass+savedCounts.failed+savedCounts.skip)/savedCounts.totalCases*100) : 0});
    const qaIds=[...new Set(input.assignments.filter(a=>a.projectId===project.id).map(a=>a.userId))];
    const qa=qaIds.map(userId=>members.get(userId) ?? {userId,name:'สมาชิกเดิม',email:'',role:'qa'});
    const totals=approvalByProject.get(project.id) ?? {projectId:project.id,total:0,approved:0,pending:0,changesRequested:0};
    const state=totals.changesRequested ? 'changes_requested' : totals.pending ? 'pending' : totals.total && totals.approved===totals.total ? 'approved' : 'not_sent';
    const label=state==='changes_requested' ? `ขอแก้ไข · Approved ${totals.approved}/${totals.total}` : state==='pending' ? `รอรีวิว · Approved ${totals.approved}/${totals.total}` : state==='approved' ? `Approved ${totals.approved}/${totals.total}` : 'ยังไม่ส่ง';
    return {...project,counts,qa,approval:{...totals,state,label}};
  });
  const activeOrigins=[...new Map(input.origins.filter(r=>r.active && r.sprintId===input.sprintId).map(r=>[JSON.stringify([r.projectId,r.testCaseId,r.resultId,r.sourceSheet]),r])).values()];
  for(const result of activeOrigins) if(!result.inferred && result.authorId && !members.has(result.authorId)) members.set(result.authorId,{userId:result.authorId,name:result.authorName || 'สมาชิกเดิม',email:'',role:'อดีตสมาชิก'});
  const team=[...members.values()].map(member=>{
    const results=activeOrigins.filter(r=>!r.inferred && r.authorId===member.userId);
    const assignedProjects=new Set(input.assignments.filter(a=>a.userId===member.userId && current.some(p=>p.id===a.projectId)).map(a=>a.projectId)).size;
    const cases=new Set(results.map(r=>JSON.stringify([r.projectId,r.testCaseId]))).size;
    const lastActivity=results.map(r=>r.recordedAt).filter(v=>Number.isFinite(Date.parse(v))).sort().at(-1) ?? '';
    return {...member,assignedProjects,results:results.length,cases,failedResults:results.filter(r=>r.status==='Failed').length,lastActivity};
  });
  const currentIds=new Set(current.map(p=>p.id));
  const moves=input.moves.filter(m=>m.after.kind==='sprint_move').sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  const latestOut=new Map<string,MoveHistory>();
  for(const move of moves) if(move.before?.sprintId===input.sprintId && !currentIds.has(move.projectId) && !latestOut.has(move.projectId)) latestOut.set(move.projectId,move);
  const movedOut=[...latestOut.values()].map(m=>({...m,snapshot:(m.after.moveSnapshot ?? {}) as MoveSnapshot}));
  const attention=projects.flatMap(project=>[
    ...(project.counts.failed ? [{kind:'failed',projectId:project.id,projectName:project.name,count:project.counts.failed}] : []),
    ...(!project.qa.length ? [{kind:'unassigned',projectId:project.id,projectName:project.name,count:1}] : []),
    ...(project.approval.pending ? [{kind:'approval',projectId:project.id,projectName:project.name,count:project.approval.pending}] : []),
  ]);
  const summary=summarizeSprint([]);
  summary.projects=projects.length;
  for(const project of projects) {
    for(const key of ['totalCases','pass','failed','skip','inProgress','notStart','openDefects','totalDefects','closedDefects'] as const) summary[key]+=project.counts[key];
    if(project.approval.state==='approved') summary.approvedProjects++;
    if(project.approval.state==='pending') summary.pendingApprovalProjects++;
  }
  summary.progress=summary.totalCases ? Math.round((summary.pass+summary.failed+summary.skip)/summary.totalCases*100) : 0;
  return {summary,projects,team,attention,movedOut,moves,inferredResults:activeOrigins.filter(r=>r.inferred || !r.authorId).length,personalPerformance:{sprintId:input.sprintId,members:input.team,cases:input.personalCases ?? []}};
}
export type SprintDashboardData = ReturnType<typeof buildSprintDashboard>;
export function filterDashboardProjects(projects: SprintDashboardData['projects'], query: string, qaId: string) {
  const text=query.trim().toLocaleLowerCase();
  return projects.filter(p=>(!text || `${p.name} ${p.description}`.toLocaleLowerCase().includes(text)) && (!qaId || p.qa.some(qa=>qa.userId===qaId)));
}
