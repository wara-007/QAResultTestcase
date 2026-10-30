"use client";
import { SprintOverviewMetrics } from './sprint-overview-metrics';
import { SprintProjectList } from "./sprint-project-list";
import { GlobalProjectSearch } from './global-project-search';
import { WorkspaceSidebarNavigation } from './workspace-sidebar-navigation';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import { CalendarDays, ClipboardCheck, History, Pencil, ChevronRight, LogOut, MoreHorizontal, ArrowRight, X, LoaderCircle, CheckCircle2 } from 'lucide-react';
import { signOut } from '@/app/auth/actions';
import { updateSprint } from '@/app/planning-actions';
import { ProjectManagement } from './project-management';
import { TeamProjectReport } from './team-project-report';
import { SprintAttention, SprintRecentActivity } from './sprint-insights';
import { type SprintDashboardData } from '@/lib/sprint-dashboard';
import { formatFlexibleDate } from '@/lib/date-format';
import type { CurrentUser, Project, ProjectHistoryEntry, Sprint } from '@/lib/types';

type Props = {groupId:string;groupName:string;sprint:Sprint;data:SprintDashboardData;currentUser:CurrentUser|null;sprintHistory:ProjectHistoryEntry[]};

export function SprintDashboard({groupId,groupName,sprint,data,currentUser,sprintHistory}:Props) {
  const router=useRouter();
  const pathname=usePathname();
  const params=useSearchParams();
  const view=['team','history','activity'].includes(params.get('view') ?? '') ? params.get('view')! : 'overview';
  const [showEdit,setShowEdit]=useState(false);
  const [managed,setManaged]=useState<Project|null>(null);
  const [notice,setNotice]=useState('');
  const [historyPage,setHistoryPage]=useState(0);
  const base=`/groups/${groupId}/years/${sprint.year}/sprints`;
  const projectsHref=`${base}/${sprint.id}/projects`;
  const projectHref=(id:string,section='test-cases')=>`/groups/${groupId}/projects/${id}/${section}`;
  function navigate(next:string) {const search=new URLSearchParams(params.toString()); if(next==='overview')search.delete('view');else search.set('view',next);router.push(`${pathname}${search.size ? `?${search}` : ''}`,{scroll:false});}
  const activity=[...data.moves.map(move=>({id:move.id,createdAt:move.createdAt,actor:move.actorEmail,title:`${String(move.after.name || move.before?.name || 'Project')} · ${String(move.before?.sprint || '')} → ${String(move.after.sprint || '')}`,detail:String(move.after.reason || '')})),...sprintHistory.map(entry=>({id:entry.id,createdAt:entry.created_at,actor:entry.actor_email,title:'แก้ไขข้อมูล Sprint',detail:['name','start_date','end_date','goal','status'].filter(key=>entry.before_data?.[key]!==entry.after_data[key]).map(key=>`${({name:'ชื่อ',start_date:'เริ่ม',end_date:'สิ้นสุด',goal:'เป้าหมาย',status:'สถานะ'} as Record<string,string>)[key]}: ${String(entry.before_data?.[key] ?? '—')} → ${String(entry.after_data[key] ?? '—')}`).join(' · ')}))].sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  return <main className="sd-shell">
    <aside className="sd-sidebar"><Link className="sd-sidebar-brand" href="/groups"><ClipboardCheck size={24}/><span>QA Workspace</span></Link><WorkspaceSidebarNavigation
      scope="sprint"
      sprintName={sprint.name}
      sprintHref={`${base}/${sprint.id}`}
      backHref={base}
      activePage={view === 'team' || view === 'history' ? view : 'overview'}
    /></aside>
    <div className="sd-main"><header className="sd-topbar"><Link href="/groups">QA Workspace</Link><GlobalProjectSearch />{currentUser && <div className="sd-user"><span className="sd-avatar">{currentUser.name.slice(0,2).toUpperCase()}</span><span><strong>{currentUser.name}</strong><small>{currentUser.email}</small></span><form action={signOut}><button className="icon-button" title="ออกจากระบบ" aria-label="ออกจากระบบ"><LogOut size={18}/></button></form></div>}</header>
      <div className="sd-content"><nav className="breadcrumb"><Link href="/groups">เลือกปี</Link><ChevronRight size={14}/><Link href={`/groups?year=${sprint.year}`}>ปี {sprint.year} · Groups</Link><ChevronRight size={14}/><Link href={base}>{groupName}</Link><ChevronRight size={14}/><strong>{sprint.name}</strong></nav>
        <div className="sd-heading"><div><div className="sd-title"><h1>{sprint.name}</h1><span className={`sd-sprint-status sd-${sprint.status ?? 'Planned'}`}>{({Planned:'วางแผน',Active:'กำลังดำเนินการ',Completed:'สิ้นสุดแล้ว'})[sprint.status ?? 'Planned']}</span></div><p><CalendarDays size={16}/>{sprint.startDate ? formatFlexibleDate(sprint.startDate,false) : 'ไม่ระบุวันเริ่ม'} — {sprint.endDate ? formatFlexibleDate(sprint.endDate,false) : 'ไม่ระบุวันสิ้นสุด'}</p>{sprint.goal && <p className="sd-goal">เป้าหมาย: {sprint.goal}</p>}</div>{sprint.canManage && <button className="secondary-button" onClick={()=>setShowEdit(true)}><Pencil size={16}/>แก้ไข Sprint</button>}</div>
        {notice && <p className="sd-success" role="status"><CheckCircle2 size={18}/>{notice}</p>}
        {view!=='team' && <SprintOverviewMetrics data={data} showSummary={view==='overview'}/>}
        {view==='overview' && <>
          <section className="sd-panel sprint-saved-summary"><p>ยอดสรุปจากข้อมูลที่บันทึกไว้ในแต่ละ Project · ดูเวลาที่อัปเดตได้ในตาราง</p><div className="sd-filters"><button className="secondary-button" onClick={()=>navigate('team')}>ดูผลงานรายบุคคล</button><button className="secondary-button" onClick={()=>navigate('activity')}>ดูกิจกรรมผลทดสอบ</button></div></section>
          <SprintProjectList data={data} groupId={groupId} year={sprint.year} renderActions={project=><RowMenu project={project} href={projectHref(project.id)} onManage={()=>setManaged(project)}/>}/>
          <Link className="primary-button" href={projectsHref}>ดู / เพิ่ม Projects<ArrowRight size={17}/></Link>
        </>}
        {view==='team' && <><TeamProjectReport data={data} groupId={groupId} year={sprint.year} mode={params.get('teamBy')==='project'?'project':'person'} onModeChange={mode=>{
          if(mode===(params.get('teamBy')==='project'?'project':'person'))return;
          const search=new URLSearchParams(params.toString());
          if(mode==='project')search.set('teamBy','project');else search.delete('teamBy');
          window.history.pushState(null,'',`${pathname}?${search}${window.location.hash}`);
        }}/><SprintAttention data={data} groupId={groupId}/></>}
        {view==='activity' && <><button className="secondary-button" onClick={()=>navigate('overview')}>กลับภาพรวม</button><SprintRecentActivity data={data}/></>}
        {view==='history' && <><section className="sd-panel"><div className="sd-section-heading"><div><h2><History size={20}/>ประวัติ Sprint และการย้าย Projects</h2><p>เก็บผู้แก้ไข เวลา และค่าก่อน–หลัง</p></div></div><div className="sd-history">{activity.slice(historyPage*10,(historyPage+1)*10).map(item=><article key={item.id}><header><strong>{item.title}</strong><time>{formatFlexibleDate(item.createdAt)}</time></header><small>{item.actor || 'ระบบ'}</small><p>{item.detail}</p></article>)}{!activity.length && <p className="sd-empty">ยังไม่มีประวัติการแก้ไขหรือย้าย</p>}</div><Pager page={historyPage} count={activity.length} onChange={setHistoryPage}/></section></>}
      </div>
    </div>
    {showEdit && <SprintEditDialog key={sprint.updatedAt} sprint={sprint} onClose={()=>setShowEdit(false)} onSaved={()=>{setShowEdit(false);setNotice('บันทึก Sprint และประวัติแล้ว');router.refresh();}}/>}
    {managed && <PlanningDialog title={managed.canManage ? `จัดการ ${managed.name}` : `ประวัติ ${managed.name}`} onClose={()=>setManaged(null)}><ProjectManagement key={managed.id} project={managed} onSaved={saved=>{setManaged(saved);setNotice('บันทึก Project แล้ว');router.refresh();}}/></PlanningDialog>}
  </main>;
}

function Pager({page,count,onChange}:{page:number;count:number;onChange:(page:number)=>void}) {return count>10 ? <div className="sd-pagination"><button className="secondary-button" disabled={!page} onClick={()=>onChange(page-1)}>ก่อนหน้า</button><span>{page+1} / {Math.ceil(count/10)}</span><button className="secondary-button" disabled={(page+1)*10>=count} onClick={()=>onChange(page+1)}>ถัดไป</button></div> : null;}

function PlanningDialog({title,children,onClose}:{title:string;children:ReactNode;onClose:()=>void}) {const ref=useRef<HTMLDialogElement>(null);useEffect(()=>{ref.current?.showModal();},[]);return <dialog className="sd-dialog" ref={ref} onCancel={onClose} aria-label={title}><header><h2>{title}</h2><button type="button" className="icon-button" onClick={onClose} aria-label="ปิด"><X size={20}/></button></header>{children}</dialog>;}

function SprintEditDialog({sprint,onClose,onSaved}:{sprint:Sprint;onClose:()=>void;onSaved:()=>void}) {
  const [name,setName]=useState(sprint.name);const [start,setStart]=useState(sprint.startDate);const [end,setEnd]=useState(sprint.endDate);const [goal,setGoal]=useState(sprint.goal ?? '');const [status,setStatus]=useState(sprint.status ?? 'Planned');const [error,setError]=useState('');const [pending,startTransition]=useTransition();
  return <PlanningDialog title="แก้ไข Sprint" onClose={()=>{if(!pending)onClose();}}><form className="sd-edit-form" onSubmit={e=>{e.preventDefault();setError('');startTransition(async()=>{const result=await updateSprint({sprintId:sprint.id,groupId:sprint.groupId,name,startDate:start,endDate:end,goal,status,expectedUpdatedAt:sprint.updatedAt ?? ''});if(result.error)setError(result.error);else onSaved();});}}><label className="text-field"><span>ชื่อ Sprint</span><input required maxLength={120} value={name} onChange={e=>setName(e.target.value)}/></label><div className="two-column-fields"><label className="text-field"><span>วันเริ่ม</span><input type="date" value={start} onChange={e=>setStart(e.target.value)}/></label><label className="text-field"><span>วันสิ้นสุด</span><input type="date" min={start || undefined} value={end} onChange={e=>setEnd(e.target.value)}/></label></div><label className="text-field"><span>เป้าหมาย Sprint</span><textarea rows={3} maxLength={2000} value={goal} onChange={e=>setGoal(e.target.value)}/></label><label className="text-field"><span>สถานะ</span><select value={status} onChange={e=>setStatus(e.target.value as typeof status)}><option value="Planned">Planned · วางแผน</option><option value="Active">Active · กำลังดำเนินการ</option><option value="Completed">Completed · สิ้นสุดแล้ว</option></select></label><p className="dialog-help">เก็บประวัติทุกการแก้ไข โดยไม่เปลี่ยน ID ของ Sprint หรือผลทดสอบเดิม</p>{error && <p className="form-error" role="alert">{error}</p>}<footer className="dialog-footer"><button type="button" className="secondary-button" disabled={pending} onClick={onClose}>ยกเลิก</button><button type="submit" className="primary-button" disabled={pending}>{pending && <LoaderCircle size={16} className="spin"/>}บันทึก Sprint</button></footer></form></PlanningDialog>;
}

function RowMenu({project,href,onManage}:{project:Project;href:string;onManage:()=>void}) {
  const menu=useRef<HTMLDivElement>(null);
  const id=`project-menu-${project.id}`;
  return <><button type="button" className="icon-button" popoverTarget={id} aria-label={`จัดการ ${project.name}`} onClick={event=>{
    const rect=event.currentTarget.getBoundingClientRect();
    if(menu.current) {menu.current.style.left=`${Math.max(8,Math.min(rect.right-230,window.innerWidth-238))}px`;menu.current.style.top=`${Math.max(8,Math.min(rect.bottom+4,window.innerHeight-120))}px`;}
  }}><MoreHorizontal size={19}/></button><div id={id} popover="auto" ref={menu} className="sd-row-popover" aria-label={`จัดการ ${project.name}`}><Link href={href} onClick={()=>menu.current?.hidePopover()}>เปิด Test cases</Link><button type="button" onClick={()=>{menu.current?.hidePopover();onManage();}}>{project.canManage ? 'แก้ไข / ย้าย / จัดการ QA' : 'ดูประวัติ'}</button></div></>;
}
