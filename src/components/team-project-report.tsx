'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowUpRight, ChevronDown, FolderKanban, Users } from 'lucide-react';
import { buildTeamProjectReport, type TeamProjectOutcome, type TeamProjectOverview, type TeamPersonReport } from '@/lib/team-project-report';
import type { SprintDashboardData } from '@/lib/sprint-dashboard';
import { formatReportDate } from '@/lib/date-format';

type Props={data:SprintDashboardData;groupId:string;year:number;mode?:'person'|'project';onModeChange?:(mode:'person'|'project')=>void};

export function TeamProjectReport({data,groupId,year,mode='person',onModeChange}:Props) {
  const report=useMemo(()=>buildTeamProjectReport(data,groupId,year),[data,groupId,year]);
  const [selectedKey,setSelectedKey]=useState('');
  const [selectedProjectId,setSelectedProjectId]=useState('');
  const selected=report.people.find(person=>person.key===selectedKey) ?? report.people[0];
  const selectedProject=report.projects.find(project=>project.projectId===selectedProjectId) ?? report.projects[0];
  const registerOnly=data.personalPerformance.basis==='test-cases';
  const issues=report.issues;
  return <section className="team-outcomes" aria-label="งานและผลส่งมอบของทีม">
    <header className="team-outcomes-heading"><div><h2><Users size={22}/>งานและผลส่งมอบของทีม</h2><p>ใครทำ Project อะไร · งานถึงไหน · ผลส่งมอบเป็นอย่างไร</p></div><span>{mode==='project'?`${report.projects.length} Projects`:`${report.people.length} คน / ชื่อผู้ทดสอบ`}</span></header>
    <div className="team-report-view-switch" role="group" aria-label="มุมมองรายงาน"><button type="button" aria-pressed={mode==='person'} onClick={()=>onModeChange?.('person')}><Users size={16} aria-hidden="true"/>รายบุคคล</button><button type="button" aria-pressed={mode==='project'} onClick={()=>onModeChange?.('project')}><FolderKanban size={16} aria-hidden="true"/>ราย Project</button></div>
    {registerOnly && <p className="team-outcomes-source">ข้อมูลรายคนจากแท็บ Test cases · 1 เคสนับให้ผู้ทดสอบที่ระบุในเคสนั้น · ไม่รวมผลราย Step / Result{data.entries.some(entry=>entry.kind==='continued')?' · งานที่ส่งต่อแล้วแสดงเฉพาะยอดย้อนหลัง ไม่มีรายละเอียดรายคนจากแท็บเดิม':''}</p>}
    {mode==='project' ? report.projects.length ? <div className="team-outcomes-workspace">
      <nav className="team-outcomes-people team-outcomes-project-picker" aria-label="เลือก Project เพื่อดูทีม"><h3>Projects ในรายงาน</h3>{report.projects.map(project=><button type="button" key={project.projectId} aria-pressed={selectedProject?.projectId===project.projectId} onClick={()=>setSelectedProjectId(project.projectId)}><FolderKanban size={18} aria-hidden="true"/><span><strong>{project.name}</strong><small>{project.environment}{project.environment?' · ':''}{project.label}</small></span></button>)}</nav>
      <div className="team-outcomes-main" aria-live="polite">{selectedProject && <div key={selectedProject.projectId}><div className="team-projects-caption"><span>ทีมและผลส่งมอบของ Project</span><span>สถานะระดับ Project</span></div><ProjectOutcome project={selectedProject} registerOnly={registerOnly}/><p className="team-outcomes-note">{registerOnly?'จำนวนเคสอ้างอิงผู้ทดสอบใน Test cases':'จำนวนเคสของแต่ละคนอาจทับซ้อนกันเมื่อหลายคนทดสอบเคสเดียวกัน'} · ชื่อที่ยังไม่จับคู่บัญชีจะแสดงแยกไว้</p></div>}</div>
    </div> : <section className="sd-panel"><p className="sd-empty">ยังไม่มี Project ในรายงาน Sprint นี้</p></section> : report.people.length ? <div className="team-outcomes-workspace">
      <nav className="team-outcomes-people" aria-label="เลือกสมาชิกเพื่อดูงาน"><h3>สมาชิก / ผู้ทดสอบ</h3>{report.people.map(person=><button type="button" key={person.key} aria-pressed={selected?.key===person.key} onClick={()=>setSelectedKey(person.key)}><span className="sd-avatar">{person.name.slice(0,2).toUpperCase()}</span><span><strong>{person.name}</strong><small>{person.totals.projects} Projects{person.unresolved ? ' · ชื่อจากผลทดสอบ' : ' · บัญชีในระบบ'}</small></span></button>)}</nav>
      <div className="team-outcomes-main" aria-live="polite">{selected && <MemberProjects key={selected.key} person={selected} registerOnly={registerOnly}/>}</div>
    </div> : <section className="sd-panel"><p className="sd-empty">ยังไม่มีงานที่เชื่อมโยงกับสมาชิก · ตรวจผู้รับผิดชอบ Project หรือชื่อในผลทดสอบ</p></section>}
    <details className="team-outcomes-issues"><summary>ข้อมูลที่ต้องตรวจสอบก่อนสรุปผลงาน<ChevronDown size={17} aria-hidden="true"/></summary><div>
      <p>ชื่อจากผลทดสอบที่ยังไม่จับคู่บัญชี {issues.unresolvedPeople} ชื่อ · ไม่รวมกับบัญชีอื่นโดยอัตโนมัติ</p>
      <p>ผลที่ไม่ระบุผู้ทดสอบ {issues.unnamedResults} เคส · งานที่ยังไม่ระบุผู้รับผิดชอบรายเคส {issues.unassignedCases} เคส · Projects ที่ไม่มี QA {issues.unassignedProjects}</p>
      {report.people.some(person=>person.unresolved) && <p>ชื่อที่ต้องตรวจสอบ: {report.people.filter(person=>person.unresolved).map(person=>person.name).join(', ')}</p>}
    </div></details>
  </section>;
}

function MemberProjects({person,registerOnly}:{person:TeamPersonReport;registerOnly:boolean}) {
  return <>
    <header className="team-member-profile"><span className="sd-avatar">{person.name.slice(0,2).toUpperCase()}</span><div><h3>{person.name}</h3><p>{person.unresolved?'ชื่อจากผลทดสอบ · ยังไม่จับคู่บัญชี':person.email || 'บัญชีผู้รับผิดชอบในระบบ'}</p></div></header>
    <dl className="team-member-totals"><div><dd><strong>{person.totals.projects}</strong></dd><dt>Projects ที่เกี่ยวข้อง</dt></div><div><dd><strong>{person.totals.approved}</strong></dd><dt>PO ตรวจรับแล้ว</dt></div><div><dd><strong>{person.totals.waitingApproval}</strong></dd><dt>รอ PO</dt></div><div><dd><strong>{person.totals.active}</strong></dd><dt>งานที่ยังต้องดำเนินการ</dt></div></dl>
    <div className="team-projects-caption"><span>Projects และผลส่งมอบ</span><span>สถานะระดับ Project</span></div>
    <div className="team-project-cards">{person.projects.map(project=><ProjectOutcome key={project.projectId} project={project} selectedPersonKey={person.key} registerOnly={registerOnly}/>)}</div>
    <p className="team-outcomes-note">สถานะเป็นผลร่วมกันของ Project · PO ตรวจรับแล้วไม่ได้หมายถึงปิด Project · งานที่ทำอ้างอิงจากผู้รับผิดชอบและผลทดสอบที่บันทึกไว้</p>
  </>;
}

function ProjectOutcome({project,selectedPersonKey,registerOnly=false}:{project:TeamProjectOutcome|TeamProjectOverview;selectedPersonKey?:string;registerOnly?:boolean}) {
  const personal='workSummary' in project?project:undefined;
  const collaborators=project.collaborators.filter(person=>!person.assignedOnly || person.key===selectedPersonKey).sort((a,b)=>Number(b.key===selectedPersonKey)-Number(a.key===selectedPersonKey));
  const assignedOthers=project.collaborators.filter(person=>person.assignedOnly && person.key!==selectedPersonKey);
  return <article className="team-project-outcome">
    <header><div><Link className="team-project-name" href={project.href}>{project.name}<ArrowUpRight size={15} aria-hidden="true"/></Link><p>{[project.environment,personal?.roleLabel ?? 'ภาพรวม Project'].filter(Boolean).join(' · ')}</p></div><span className={`team-outcome-status team-outcome-${project.state}`}>{project.label}</span></header>
    <dl className="team-project-story">{personal ? <div><dt>งานที่ทำ</dt><dd>{personal.workSummary}</dd></div> : 'qaNames' in project && <div><dt>QA</dt><dd>{project.qaNames.length?project.qaNames.join(', '):'ยังไม่มอบหมาย QA'}</dd></div>}<div><dt>ผลลัพธ์</dt><dd>{project.resultSummary}</dd></div></dl>
    {(!personal || project.collaborators.length>1) && <section className="team-project-collaboration" aria-label={`ผู้ร่วมงานใน ${project.name}`}>
      <h4><Users size={15} aria-hidden="true"/>การทำงานร่วมกัน</h4>
      <ul>{collaborators.map(person=><li key={person.key} className={person.key===selectedPersonKey?'team-collaborator-selected':undefined}><div className="team-collaborator-heading"><strong>{person.name}{person.key===selectedPersonKey && <span className="team-selected-person-badge">คนที่เลือก</span>}</strong><span>{person.assignedOnly?'มอบหมายแล้ว · ยังไม่มีผลทดสอบ':`ทดสอบแล้ว ${person.testedCases} เคส${person.inProgressCases>0?` · กำลังทดสอบ ${person.inProgressCases}`:''}${person.skippedCases>0?` · Skip ${person.skippedCases}`:''}`}</span></div>{person.caseNames.length>0 && <p>งานที่บันทึก: {person.caseNames.map(name=>name.length>100?`${name.slice(0,100)}…`:name).join(' · ')}</p>}</li>)}</ul>
      {assignedOthers.length>0 && <p className="team-collaboration-assigned">มอบหมายไว้ แต่ยังไม่มีผลที่ระบุชื่อนี้: {assignedOthers.map(person=>person.name).join(', ')}</p>}
      {!project.collaborators.length && <p className="team-collaboration-assigned">ยังไม่มีผู้รับผิดชอบหรือผลทดสอบที่ระบุชื่อในข้อมูลของ Project นี้</p>}
      <p className="team-collaboration-note">ทดสอบแล้ว = มีผล Pass / Failed · นับเคสไม่ซ้ำต่อคน{project.collaborators.some(person=>person.unresolved)?' · ชื่อจากผลนำเข้ายังไม่จับคู่บัญชี':''}</p>
    </section>}
    <div className="team-project-next"><strong>ขั้นตอนถัดไป</strong><span>{project.nextStep}</span></div>
    <details className="team-project-evidence"><summary>{registerOnly?'ดูเคสและผลจาก Test cases':'ดูการทำงานและผลที่บันทึก'}<ChevronDown size={16} aria-hidden="true"/></summary>
      {project.counts && <p className="team-project-counts">ยอดรวม Project: {project.counts.totalCases} เคส · Pass {project.counts.pass} · Failed {project.counts.failed} · กำลังทดสอบ {project.counts.inProgress} · Skip {project.counts.skip} · ยังไม่เริ่ม {project.counts.notStart}</p>}
      {project.approval && <p className="team-project-counts">PO Approved {project.approval.approved}/{project.approval.total} · รอรีวิว {project.approval.pending} · ขอแก้ไข {project.approval.changesRequested}</p>}
      {personal && (personal.activity.length ? <><p className="team-project-counts">{registerOnly?'ผลจาก Test cases ของคนนี้':'ผลล่าสุดของคนนี้ แยกตามเคสและแหล่งผล'}</p><ol>{personal.activity.slice(0,10).map(entry=><li key={entry.key}><time>{entry.recordedAt && Number.isFinite(Date.parse(entry.recordedAt))?formatReportDate(entry.recordedAt):'ไม่ระบุเวลา'}</time><Link href={entry.detailPath}><strong>{entry.caseId}{entry.sourceRowKey && entry.sourceRowKey!=='base'?` (${entry.sourceRowKey})`:''} · {entry.caseName}</strong><span>{entry.status} · {registerOnly?'Test cases':entry.source==='web'?'เว็บ':'Sheets / ข้อมูลเดิม'}{entry.inferred&&!registerOnly?' · ไม่ยืนยัน Sprint ต้นกำเนิด':''}</span></Link></li>)}</ol>{personal.activity.length>10 && <p className="team-project-counts">แสดง 10 ผลล่าสุดจาก {personal.activity.length} รายการ · ดูผลทั้งหมดใน Project</p>}</> : <p className="team-project-counts">ยังไม่มีผลทดสอบของคนนี้ในข้อมูลที่บันทึกไว้ การมอบหมายงานไม่ได้ยืนยันว่าเป็นผู้ทดสอบ</p>)}
      <Link className="team-project-open" href={project.href}>เปิด {project.state==='continued'?'ข้อมูล Project ย้อนหลัง':'ภาพรวม Project'}<ArrowUpRight size={14} aria-hidden="true"/></Link>
    </details>
  </article>;
}
