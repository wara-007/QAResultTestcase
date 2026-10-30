import { buildPersonalPerformance, type PersonalEntry, type PersonalPerformanceRow } from './personal-test-performance';
import type { ApprovalTotals, MoveSnapshot, SprintDashboardData } from './sprint-dashboard';
import type { PlanningTeamMember } from './types';
import { sprintEntryHref } from './sprint-project-entries';

export type TeamProjectState = 'unknown' | 'continued' | 'needs_attention' | 'testing' | 'not_started' | 'changes_requested' | 'waiting_approval' | 'approved' | 'ready_for_review';
export type ProjectCollaborator = {
  key:string;name:string;unresolved:boolean;testedCases:number;inProgressCases:number;skippedCases:number;
  assignedOnly:boolean;caseNames:string[];
};
export type TeamProjectOutcome = {
  projectId:string; name:string; environment:string; href:string;
  role:'project_qa'|'case_assignee'|'contributor'; roleLabel:string;
  state:TeamProjectState; label:string; workSummary:string; resultSummary:string; nextStep:string;
  counts?:MoveSnapshot; approval?:ApprovalTotals; recordedResults:number; activity:PersonalEntry[]; collaborators:ProjectCollaborator[];
};
export type TeamPersonReport = {
  key:string; name:string; email:string; unresolved:boolean; projects:TeamProjectOutcome[];
  totals:{projects:number;approved:number;waitingApproval:number;active:number};
};
export type TeamProjectOverview = Omit<TeamProjectOutcome,'role'|'roleLabel'|'workSummary'|'recordedResults'|'activity'> & {qaNames:string[]};

function deliveryState(counts:MoveSnapshot|undefined,approval:ApprovalTotals|undefined,continued:boolean):{state:TeamProjectState;label:string;resultSummary:string;nextStep:string} {
  if(continued) return {state:'continued',label:'ส่งต่อแล้ว',resultSummary:'แสดงผล ณ วันที่ส่งต่อไป Sprint ถัดไป',nextStep:'ดูข้อมูลย้อนหลังหรือเปิดงานปัจจุบันเพื่อติดตามต่อ'};
  if(!counts) return {state:'unknown',label:'ยังไม่มียอดสรุป',resultSummary:'ยังไม่มีข้อมูลเพียงพอสำหรับสรุปความพร้อม',nextStep:'เปิด Project เพื่อตรวจสอบและอัปเดตยอดสรุป'};
  if(counts.failed || counts.openDefects) return {state:'needs_attention',label:'ต้องแก้ไข / Retest',resultSummary:`มีผล Failed ${counts.failed} เคส · Defects ยังเปิด ${counts.openDefects}`,nextStep:'ติดตามปัญหาและบันทึกผล Retest ก่อนส่งตรวจรับ'};
  if(approval?.changesRequested) return {state:'changes_requested',label:'PO ขอแก้ไข',resultSummary:`มีคำขอแก้ไข ${approval.changesRequested} รายการจาก PO`,nextStep:'ตรวจข้อเสนอแนะ แก้ไข และส่งตรวจรับอีกครั้ง'};
  if(!counts.totalCases) return {state:'not_started',label:'ยังไม่มี Test cases',resultSummary:'ยังไม่มี Test cases ในข้อมูลสรุปของ Project',nextStep:'ตรวจสอบขอบเขตและเพิ่ม Test cases ก่อนเริ่มทดสอบ'};
  if(counts.notStart || counts.inProgress) return {state:'testing',label:'กำลังทดสอบ',resultSummary:`ยังไม่เริ่ม ${counts.notStart} เคส · กำลังทดสอบ ${counts.inProgress} เคส`,nextStep:'ดำเนินการเคสที่เหลือและตรวจความครบถ้วนก่อนส่งรีวิว'};
  if(approval?.pending) return {state:'waiting_approval',label:'รอ PO Approval',resultSummary:`ผลทดสอบครบ · รอ PO ตรวจรับ ${approval.pending} รายการ`,nextStep:'ติดตาม PO ตรวจรับผลทดสอบ'};
  if(approval?.total && approval.approved===approval.total) return {state:'approved',label:'PO ตรวจรับแล้ว',resultSummary:`PO Approved ${approval.approved}/${approval.total} · ไม่พบ Failed หรือ Defect ค้างในข้อมูลสรุป`,nextStep:'ตรวจเงื่อนไขส่งมอบของทีมก่อนสรุปปิดงาน'};
  return {state:'ready_for_review',label:'ทดสอบครบ · ยังไม่ส่ง PO',resultSummary:`บันทึกผลครบ ${counts.totalCases} เคส${counts.skip ? ` · รวม Skip ${counts.skip} เคส` : ''}`,nextStep:counts.skip?'ทบทวนเหตุผล Skip และส่งผลให้ PO ตรวจรับ':'ตรวจความครบถ้วนและส่งผลให้ PO ตรวจรับ'};
}

export function buildTeamProjectReport(data:SprintDashboardData,groupId:string,year:number) {
  const performance=buildPersonalPerformance(data.personalPerformance);
  const rows=new Map(performance.map(person=>[person.key,person]));
  const live=new Map(data.projects.map(project=>[project.id,project]));
  const members=new Map<string,PlanningTeamMember>([...data.team,...data.personalPerformance.members,...data.projects.flatMap(project=>project.qa),...data.entries.flatMap(entry=>entry.historical?.qa ?? [])].map(member=>[member.userId,member]));
  const people=new Map<string,{key:string;name:string;email:string;unresolved:boolean;projectIds:Set<string>}>();
  for(const person of performance) {
    if(person.key==='unknown'||person.key==='unassigned') continue;
    people.set(person.key,{key:person.key,name:person.name,email:person.email,unresolved:person.unresolved,projectIds:new Set([...person.entries,...person.assignedEntries].map(entry=>entry.projectId))});
  }
  for(const entry of data.entries) {
    const qa=entry.kind==='continued' ? entry.historical?.qa ?? [] : live.get(entry.projectId)?.qa ?? [];
    for(const person of qa) {
      if(!people.has(person.userId)) people.set(person.userId,{key:person.userId,name:members.get(person.userId)?.name ?? person.name,email:person.email,unresolved:false,projectIds:new Set()});
      people.get(person.userId)!.projectIds.add(entry.projectId);
    }
  }
  const collaboratorsByProject=new Map<string,ProjectCollaborator[]>();
  for(const person of people.values()) for(const projectId of person.projectIds) {
    const activity=(rows.get(person.key)?.entries ?? []).filter(entry=>entry.projectId===projectId && entry.source!=='pending');
    const cases=new Map<string,Set<string>>();
    for(const entry of activity) {
      if(!cases.has(entry.caseId)) cases.set(entry.caseId,new Set());
      cases.get(entry.caseId)!.add(entry.status);
    }
    let testedCases=0,inProgressCases=0,skippedCases=0;
    for(const statuses of cases.values()) {
      if(statuses.has('Pass')||statuses.has('Failed')) testedCases++;
      else if(statuses.has('In Progress')) inProgressCases++;
      else if(statuses.has('Skip')) skippedCases++;
    }
    const collaborator:ProjectCollaborator={key:person.key,name:person.name,unresolved:person.unresolved,testedCases,inProgressCases,skippedCases,assignedOnly:activity.length===0,caseNames:[...new Set(activity.map(entry=>entry.caseName.trim()).filter(Boolean))].slice(0,2)};
    const existing=collaboratorsByProject.get(projectId) ?? [];
    existing.push(collaborator);
    collaboratorsByProject.set(projectId,existing);
  }
  for(const collaborators of collaboratorsByProject.values()) collaborators.sort((a,b)=>Number(a.assignedOnly)-Number(b.assignedOnly)||a.name.localeCompare(b.name,'th'));
  const reports:TeamPersonReport[]=[...people.values()].map(person=>{
    const row:PersonalPerformanceRow|undefined=rows.get(person.key);
    const projects:TeamProjectOutcome[]=[...person.projectIds].map(projectId=>{
      const entry=data.entries.find(item=>item.projectId===projectId);
      const project=live.get(projectId);
      const historical=entry?.kind==='continued' ? entry.historical : undefined;
      const activity=(row?.entries ?? []).filter(item=>item.projectId===projectId && item.source!=='pending').sort((a,b)=>(Date.parse(b.recordedAt)||0)-(Date.parse(a.recordedAt)||0));
      const assigned=(row?.assignedEntries ?? []).filter(item=>item.projectId===projectId);
      const projectQa=historical?.qa ?? project?.qa ?? [];
      const isProjectQa=projectQa.some(member=>member.userId===person.key);
      const role:TeamProjectOutcome['role']=isProjectQa?'project_qa':assigned.length?'case_assignee':'contributor';
      const counts=data.summaryPending?.includes(projectId) && !historical ? undefined : historical?.counts ?? project?.counts;
      const approval=historical?.approval ?? project?.approval;
      return {
        projectId,name:entry?.name ?? activity[0]?.projectName ?? assigned[0]?.projectName ?? project?.name ?? 'Project',
        environment:historical?.project.environment ?? project?.environment ?? '',
        href:entry?sprintEntryHref(entry,groupId,year):`/groups/${groupId}/projects/${projectId}/test-cases`,
        role,roleLabel:isProjectQa?'QA ที่รับผิดชอบ Project':assigned.length?'ผู้รับผิดชอบ Test cases':'มีส่วนร่วมจากผลทดสอบ',
        ...deliveryState(counts,approval,entry?.kind==='continued'),counts,approval,activity,recordedResults:activity.length,collaborators:collaboratorsByProject.get(projectId) ?? [],
        workSummary:activity.length?`มีผลทดสอบบันทึกไว้ ${activity.length} รายการ${assigned.length?` · รับผิดชอบรายเคส ${assigned.length} เคส`:''}`:assigned.length?`ได้รับมอบหมาย ${assigned.length} เคส · ยังไม่มีผลทดสอบของคนนี้`:'ได้รับมอบหมายเป็น QA ของ Project · ยังไม่มีผลทดสอบของคนนี้',
      };
    }).sort((a,b)=>a.name.localeCompare(b.name,'th'));
    return {key:person.key,name:person.name,email:person.email,unresolved:person.unresolved,projects,totals:{projects:projects.length,approved:projects.filter(p=>p.state==='approved').length,waitingApproval:projects.filter(p=>p.state==='waiting_approval').length,active:projects.filter(p=>['testing','not_started','needs_attention','changes_requested','ready_for_review','unknown'].includes(p.state)).length}};
  }).sort((a,b)=>a.name.localeCompare(b.name,'th'));
  const projectReports=new Map<string,TeamProjectOverview>();
  for(const entry of data.entries) {
    const project=live.get(entry.projectId);
    const historical=entry.kind==='continued'?entry.historical:undefined;
    const counts=data.summaryPending?.includes(entry.projectId) && !historical?undefined:historical?.counts ?? project?.counts;
    const approval=historical?.approval ?? project?.approval;
    projectReports.set(entry.projectId,{
      projectId:entry.projectId,name:entry.name,environment:historical?.project.environment ?? project?.environment ?? '',href:sprintEntryHref(entry,groupId,year),
      ...deliveryState(counts,approval,entry.kind==='continued'),counts,approval,collaborators:collaboratorsByProject.get(entry.projectId) ?? [],qaNames:(historical?.qa ?? project?.qa ?? []).map(person=>person.name),
    });
  }
  for(const person of reports) for(const project of person.projects) if(!projectReports.has(project.projectId)) {
    projectReports.set(project.projectId,{projectId:project.projectId,name:project.name,environment:project.environment,href:project.href,state:project.state,label:project.label,resultSummary:project.resultSummary,nextStep:project.nextStep,counts:project.counts,approval:project.approval,collaborators:project.collaborators,qaNames:[]});
  }
  return {people:reports,projects:[...projectReports.values()].sort((a,b)=>a.name.localeCompare(b.name,'th')),issues:{unnamedResults:rows.get('unknown')?.entries.length ?? 0,unassignedCases:rows.get('unassigned')?.entries.length ?? 0,unresolvedPeople:reports.filter(person=>person.unresolved).length,unassignedProjects:data.entries.filter(entry=>(entry.kind==='continued'?entry.historical?.qa.length:live.get(entry.projectId)?.qa.length)===0).length}};
}
