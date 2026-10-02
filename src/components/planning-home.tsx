"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ClipboardCheck, LogOut, Plus, FolderKanban, CalendarDays, ChevronRight, LoaderCircle, X } from "lucide-react";
import { createWorkspaceYear, createSprint } from "@/app/planning-actions";
import { signOut } from "@/app/auth/actions";
import { GoogleCleanupWarning } from './google-cleanup-warning';
import type { CurrentUser, Project, Sprint, WorkspaceYear } from "@/lib/types";
import type { summarizeSprint } from "@/lib/sprint-summary";
import { groupsForYearHref } from '@/lib/year-navigation';

type Props = { groupId: string; groupName: string; years: WorkspaceYear[]; sprints: Sprint[]; projects: Project[]; currentUser: CurrentUser | null; canPlan: boolean; error: string; year?: number; sprintId?: string; summary?: ReturnType<typeof summarizeSprint> };
export function PlanningHome(props: Props) {
  const { groupId, years, sprints, projects, year, sprintId, currentUser, summary } = props;
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [yearInput, setYearInput] = useState(String(year ?? new Date().getFullYear()));
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const yearRow = years.find((item) => item.year === year);
  const sprint = sprints.find((item) => item.id === sprintId);
  const base = `/groups/${groupId}/years`;
  const heading = sprint ? sprint.name : year ? `ปี ${year} · Sprints` : "เลือกปี";
  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    startTransition(async () => {
      const result = yearRow ? await createSprint({ groupId, yearId: yearRow.id, name, startDate, endDate }) : await createWorkspaceYear(groupId, year ?? Number(yearInput));
      if (result.error) return setError(result.error);
      setShowCreate(false); setName(""); setStartDate(""); setEndDate(""); router.refresh();
    });
  }
  return <main className="groups-screen">
    <header className="groups-topbar"><Link className="groups-brand" href="/groups"><span><ClipboardCheck size={23} /></span><div><strong>QA Workspace</strong><small>Test execution</small></div></Link>{currentUser && <div className="groups-user"><div><strong>{currentUser.name}</strong><small>{currentUser.email}</small></div><form action={signOut}><button><LogOut size={16} />ออกจากระบบ</button></form></div>}</header>
    <section className="groups-content planning-content">
      <nav className="breadcrumb"><Link href="/groups">เลือกปี</Link><ChevronRight size={15}/>{year && <><Link href={groupsForYearHref(year)}>ปี {year} · Groups</Link><ChevronRight size={15}/></>}<Link href={year ? `${base}/${year}/sprints` : base}>{props.groupName}</Link>{sprint && <><ChevronRight size={15}/><strong>{sprint.name}</strong></>}</nav>
      <div className="groups-heading"><div><p className="eyebrow">{sprint ? "SPRINT DASHBOARD" : "WORKSPACE"}</p><h1>{heading}</h1><span>{sprint ? `${year} · ${sprint.startDate || "ไม่ระบุวันเริ่ม"} — ${sprint.endDate || "ไม่ระบุวันสิ้นสุด"}` : `เลือก Sprint ของ ${props.groupName} ในปี ${year ?? ""}`}</span></div>{!sprintId && props.canPlan && !props.error && <button className="primary-button" onClick={() => setShowCreate(true)}><Plus size={17} />{yearRow ? "สร้าง Sprint" : year ? `เพิ่มปี ${year} ในกลุ่ม` : "เพิ่มปี"}</button>}</div>
      {props.error && <div className="project-error"><strong>โหลดข้อมูลไม่สำเร็จ</strong><p>{props.error}</p></div>}
      {!props.error && !year && <div className="planning-list">{years.map((item) => <Link className="planning-row" key={item.id} href={`${base}/${item.year}/sprints`}><CalendarDays size={24} /><strong>{item.year}</strong><span>{sprints.filter((s) => s.yearId === item.id).length} Sprints</span><span>{projects.filter((p) => p.year === item.year).length} Projects</span><ChevronRight size={18} /></Link>)}{!years.length && <div className="panel groups-empty"><h2>ยังไม่มีปี</h2><p>เพิ่มปีเพื่อเริ่มจัด Sprint และ Projects</p></div>}</div>}
      {!props.error && year && !sprintId && <div className="planning-list">{sprints.filter((item) => item.yearId === yearRow?.id).map((item) => <Link className="planning-row" key={item.id} href={`${base}/${year}/sprints/${item.id}`}><FolderKanban size={24} /><strong>{item.name}</strong><span>{item.startDate || "ไม่ระบุวันเริ่ม"} — {item.endDate || "ไม่ระบุวันสิ้นสุด"}</span><span>{projects.filter((p) => p.sprintId === item.id).length} Projects</span><ChevronRight size={18} /></Link>)}{!sprints.some((s) => s.yearId === yearRow?.id) && <div className="panel groups-empty"><h2>ยังไม่มี Sprint ในปีนี้</h2><p>{yearRow ? "สร้าง Sprint ก่อนเพิ่ม Project" : props.canPlan ? `เพิ่มปี ${year} ในกลุ่มนี้ก่อน แล้วจึงสร้าง Sprint` : "ผู้มีสิทธิ์จัดการกลุ่มสามารถเพิ่มปีและสร้าง Sprint ได้"}</p></div>}</div>}
      {sprint && summary && <>
        <div className="sprint-dashboard-stats">{[["Projects", summary.projects], ["Test cases", summary.totalCases], ["Pass", summary.pass], ["Failed", summary.failed], ["In Progress", summary.inProgress], ["Not Start", summary.notStart], ["Skip", summary.skip], ["Defects ที่ยังเปิด", summary.openDefects], ["Projects Approved", summary.approvedProjects], ["Projects รอ Approval", summary.pendingApprovalProjects]].map(([label, value]) => <article className="panel" key={label}><span>{label}</span><strong>{value}</strong></article>)}</div>
        <section className="panel sprint-progress"><div><strong>ทดสอบแล้ว {summary.progress}%</strong><span>Pass + Failed + Skip / Test cases ทั้งหมด</span></div><progress max={100} value={summary.progress} /><small>สรุปจากข้อมูลที่บันทึกไว้ในเว็บ อัปเดตหลังบันทึกหรือดึงจาก Sheets</small></section>
        <Link className="primary-button sprint-projects-link" href={`${base}/${year}/sprints/${sprint.id}/projects`}><FolderKanban size={18} />ดู Projects ของ Sprint ({summary.projects})<ChevronRight size={18} /></Link>
      </>}
    </section>
    {showCreate && <div className="modal-backdrop"><form className="project-dialog" onSubmit={submit}><button type="button" className="icon-button close-button" onClick={() => setShowCreate(false)} aria-label="ปิด"><X size={18} /></button><h2>{yearRow ? `สร้าง Sprint · ${year}` : `เพิ่มปี${year ? ` ${year} ในกลุ่ม` : ""}`}</h2>{yearRow ? <><label className="text-field"><span>ชื่อ Sprint</span><input required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น Sprint 41" /></label><label className="text-field"><span>วันเริ่ม</span><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label><label className="text-field"><span>วันสิ้นสุด</span><input type="date" min={startDate || undefined} value={endDate} onChange={(e) => setEndDate(e.target.value)} /></label></> : <label className="text-field"><span>ปี ค.ศ.</span><input required type="number" min={2000} max={2200} value={yearInput} readOnly={!!year} onChange={(e) => setYearInput(e.target.value)} /></label>}{error && <p className="form-error">{error}</p>}<footer className="dialog-footer"><button type="button" className="secondary-button" onClick={() => setShowCreate(false)}>ยกเลิก</button><button className="primary-button" disabled={pending}>{pending && <LoaderCircle size={16} className="spin" />}บันทึก</button></footer></form></div>}
    <GoogleCleanupWarning />
  </main>;
}
