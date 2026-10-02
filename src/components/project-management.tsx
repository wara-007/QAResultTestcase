"use client";
import { useEffect, useState, useTransition } from "react";
import { LoaderCircle } from "lucide-react";
import { getProjectHistory, getProjectPlanning, setProjectQa, updateProjectDetails } from "@/app/planning-actions";
import type { PlanningTeamMember, Project, ProjectHistoryEntry, Sprint } from "@/lib/types";
import { formatFlexibleDate } from "@/lib/date-format";

export function ProjectManagement({ project, onSaved }: { project: Project; onSaved: (project: Project) => void }) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [environment, setEnvironment] = useState(project.environment);
  const [sprintId, setSprintId] = useState(project.sprintId ?? "");
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [team,setTeam]=useState<PlanningTeamMember[]>([]);
  const [qaIds,setQaIds]=useState<string[]>([]);
  const [moveReason,setMoveReason]=useState('');
  const [year, setYear] = useState(project.year ?? 0);
  const [entries, setEntries] = useState<ProjectHistoryEntry[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    let cancelled = false;
    Promise.all([getProjectPlanning(project.id), getProjectHistory(project.id)]).then(([planning, history]) => {
      if (cancelled) return;
      setSprints(planning.sprints); setTeam(planning.team); setQaIds(planning.qaIds); setEntries(history.entries); setHasMore(history.entries.length === 50); setError(planning.error || history.error); setLoading(false);
    }).catch((reason) => { if (!cancelled) { setError(reason instanceof Error ? reason.message : "โหลดข้อมูลไม่สำเร็จ"); setLoading(false); } });
    return () => { cancelled = true; };
  }, [project.id]);
  function save(event: React.FormEvent) {
    event.preventDefault(); setError(""); setNotice("");
    startTransition(async () => {
      const result = await updateProjectDetails({ projectId: project.id, name, description, environment, sprintId, expectedUpdatedAt: project.updatedAt ?? "",moveReason });
      if (result.error) return setError(result.error);
      onSaved({ ...project, name: name.trim(), description: description.trim(), environment: environment.trim(), sprintId, sprintNo: result.sprintNo ?? project.sprintNo, year: sprints.find((s) => s.id === sprintId)?.year, updatedAt: result.updatedAt });
      const history = await getProjectHistory(project.id);
      setEntries(history.entries); setHasMore(history.entries.length === 50); setError(history.error); setNotice("บันทึก Project และประวัติแล้ว"); setMoveReason('');
    });
  }
  return <section className="project-management"><h2>ข้อมูล Project และ Sprint</h2>{loading ? <p><LoaderCircle className="spin" size={18} />กำลังโหลดข้อมูลและประวัติ…</p> : <>
    {project.canManage && <form onSubmit={save}><label className="text-field"><span>ชื่อ Project</span><input required maxLength={160} value={name} onChange={(e) => setName(e.target.value)} /></label><label className="text-field"><span>รายละเอียด</span><textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></label><label className="text-field"><span>Environment</span><input required value={environment} onChange={(e) => setEnvironment(e.target.value)} /></label><div className="two-column-fields"><label><span>ปี</span><select value={year} onChange={(e) => { const next = Number(e.target.value); setYear(next); setSprintId(sprints.find((s) => s.year === next)?.id ?? ""); }}>{[...new Set(sprints.map((s) => s.year))].sort((a, b) => b - a).map((y) => <option key={y} value={y}>{y}</option>)}</select></label><label><span>Sprint</span><select required value={sprintId} onChange={(e) => setSprintId(e.target.value)}><option value="">เลือก Sprint</option>{sprints.filter((s) => s.year === year).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label></div>{sprintId!==project.sprintId && <label className="text-field"><span>เหตุผลที่ย้าย Sprint</span><textarea required maxLength={2000} rows={3} value={moveReason} onChange={e=>setMoveReason(e.target.value)} placeholder="เช่น รอแก้ไข Defect จึงนำไปทำต่อ Sprint หน้า" /></label>}<p className="dialog-help">ย้ายแล้วเก็บ snapshot สถานะ ณ ตอนย้าย และ Sprint ต้นกำเนิดของ Results เดิม ไม่ลบข้อมูลหรือ Google Sheets</p><button className="primary-button" disabled={pending || !sprintId}>{pending && <LoaderCircle size={16} className="spin" />}บันทึก Project</button></form>}
    <section className="project-qa-editor"><h3>QA ที่รับผิดชอบ</h3><p className="dialog-help">เลือกได้หลายคน การมอบหมายงานไม่เปลี่ยนสิทธิ์การเข้าถึง Project</p><div className="qa-assignment-list">{team.filter(m=>['qa','qa_lead','admin'].includes(m.role)).map(member=><label key={member.userId}><input type="checkbox" checked={qaIds.includes(member.userId)} disabled={!project.canManage || pending} onChange={e=>setQaIds(ids=>e.target.checked ? [...ids,member.userId] : ids.filter(id=>id!==member.userId))} /><span><strong>{member.name}</strong><small>{member.email} · {member.role}</small></span></label>)}</div>{project.canManage && <button type="button" className="secondary-button" disabled={pending} onClick={()=>startTransition(async()=>{setError('');const result=await setProjectQa(project.id,qaIds);if(result.error)return setError(result.error);onSaved({...project,updatedAt:result.updatedAt});const history=await getProjectHistory(project.id);setEntries(history.entries);setError(history.error);setNotice('บันทึก QA และประวัติแล้ว');})}>บันทึกผู้รับผิดชอบ</button>}</section>
    <h3>ประวัติการแก้ไข / ย้าย Sprint</h3><div className="project-history-list">{entries.map((entry) => <article key={entry.id}><header><strong>{entry.after_data.kind==='sprint_move' ? 'ย้าย Sprint' : entry.after_data.kind==='qa_assignment' ? 'เปลี่ยน QA ที่รับผิดชอบ' : entry.before_data ? "แก้ไข Project" : entry.after_data.migration ? "นำเข้าข้อมูลเดิม" : "สร้าง Project"}</strong><time>{formatFlexibleDate(entry.created_at)}</time></header><small>{entry.actor_email || "ระบบ"}</small><dl>{["name", "description", "environment", "year", "sprint",'reason','qaIds'].filter((key) => entry.after_data[key]!==undefined && (!entry.before_data || entry.before_data[key] !== entry.after_data[key])).map((key) => <div key={key}><dt>{({ name: "ชื่อ", description: "รายละเอียด", environment: "Environment", year: "ปี", sprint: "Sprint",reason:'เหตุผล',qaIds:'QA' } as Record<string, string>)[key]}</dt><dd>{entry.before_data && entry.before_data[key]!==undefined && <>{historyValue(entry.before_data[key],team)} → </>}{historyValue(entry.after_data[key],team)}</dd></div>)}</dl>{entry.after_data.moveSnapshot && typeof entry.after_data.moveSnapshot==='object' ? <p className="move-snapshot-note">สถานะ ณ ตอนย้าย: {snapshotText(entry.after_data.moveSnapshot as Record<string,unknown>)}</p> : null}</article>)}{!entries.length && <p>ยังไม่มีประวัติ</p>}</div>{hasMore && <button className="secondary-button" disabled={pending} onClick={() => startTransition(async () => { const more = await getProjectHistory(project.id, entries.length); setEntries((current) => [...current, ...more.entries]); setHasMore(more.entries.length === 50); setError(more.error); })}>โหลดประวัติเพิ่ม</button>}
  </>}{error && <p className="form-error">{error}</p>}{notice && <p role="status">{notice}</p>}</section>;
}

function historyValue(value:unknown,team:PlanningTeamMember[]) {return Array.isArray(value) ? value.map(id=>team.find(m=>m.userId===id)?.name ?? String(id)).join(', ') || 'ไม่มีผู้รับผิดชอบ' : String(value || '—');}
function snapshotText(s:Record<string,unknown>) {return `${s.totalCases ?? 0} เคส · Pass ${s.pass ?? 0} · Failed ${s.failed ?? 0} · Skip ${s.skip ?? 0} · In Progress ${s.inProgress ?? 0} · Not Start ${s.notStart ?? 0} · Defects เปิด ${s.openDefects ?? 0}`;}
