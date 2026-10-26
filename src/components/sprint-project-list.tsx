"use client";
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import type { SprintDashboardData } from '../lib/sprint-dashboard';
import { filterSprintProjectEntries, sprintEntryHref } from '../lib/sprint-project-entries';
import type { Project } from '../lib/types';

export function SprintProjectList({data,groupId,year,renderActions}:{data:SprintDashboardData;groupId:string;year:number;renderActions?:(project:Project)=>ReactNode}) {
 const [query,setQuery]=useState(''),[qaId,setQaId]=useState(''),[scope,setScope]=useState<'all'|'current'|'continued'>('all'),[page,setPage]=useState(0);
 const filtered=filterSprintProjectEntries(data.entries,{query,qaId,scope});
 const safePage=Math.min(page,Math.max(0,Math.ceil(filtered.length/10)-1));
 const members=[...new Map([...data.team,...data.entries.flatMap(e=>e.historical?.qa ?? [])].map(q=>[q.userId,q])).values()];
 return <section className="sd-panel sd-projects" aria-label="Projects ใน Sprint"><div className="sd-section-heading"><div><h2>Projects ใน Sprint <span>{filtered.length} / {data.entries.length}</span></h2><p>กำลังทำ {data.entries.filter(e=>e.kind==='current').length} · ส่งต่อแล้ว {data.entries.filter(e=>e.kind==='continued').length} · ข้อมูลย้อนหลังตรึง ณ วันที่ส่งต่อ</p></div><div className="sd-filters">
 <input className="sd-search" aria-label="ค้นหา Project" placeholder="ค้นหา Project…" value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}}/>
 <select aria-label="กรองตาม QA" value={qaId} onChange={e=>{setQaId(e.target.value);setPage(0);}}><option value="">QA ทั้งหมด</option>{members.map(m=><option key={m.userId} value={m.userId}>{m.name}</option>)}</select>
 <select aria-label="กรองการส่งต่อ" value={scope} onChange={e=>{setScope(e.target.value as typeof scope);setPage(0);}}><option value="all">ทั้งหมด</option><option value="current">ทำอยู่ใน Sprint นี้</option><option value="continued">ส่งต่อแล้ว</option></select></div></div>
 <div className="sd-table-scroll"><table><thead><tr><th>Project</th><th>QA ที่รับผิดชอบ</th><th>ความคืบหน้า</th><th>Failed</th><th>Defects ปิด/ทั้งหมด</th><th>PO Approval</th><th>จัดการ</th></tr></thead><tbody>{filtered.slice(safePage*10,(safePage+1)*10).map(entry=>{
 const live=data.projects.find(p=>p.id===entry.projectId),h=entry.historical;
 const unknown=entry.kind==='current' && data.summaryPending?.includes(entry.projectId);
 const counts=entry.kind==='continued' ? h!.counts : live!.counts;
 const qa=entry.kind==='continued' ? h!.qa : live!.qa;
 const approval=entry.kind==='continued' ? h!.approval : live!.approval;
 const done=(counts.pass ?? 0)+(counts.failed ?? 0)+(counts.skip ?? 0),progress=counts.totalCases ? Math.round(done/counts.totalCases*100) : 0;
 return <tr key={entry.projectId}><td><Link className="sd-project-name" href={sprintEntryHref(entry,groupId,year)}><strong>{entry.name}</strong></Link><small>{h?.project.environment ?? live?.environment}</small>{live?.dashboardSummary && <small>อัปเดตยอด {new Date(live.dashboardSummary.updatedAt).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'})}</small>}{live?.coverSummary?.fields.length ? <details><summary>ข้อมูล Cover</summary><dl>{live.coverSummary.fields.map((field,index)=><div key={index}><dt>{field.label}</dt><dd>{field.value}</dd></div>)}</dl></details> : null}{entry.kind==='continued' ? <p className="sprint-continuation-badge">ทำต่อใน Sprint {entry.destination?.sprintName ?? 'ถัดไป'} · ดูย้อนหลัง</p> : entry.previousSprintName && <p className="sprint-continuation-badge">ต่อจาก Sprint {entry.previousSprintName}</p>}{data.episodes.some(e=>e.projectId===entry.projectId && e.exitedAt) && <details className="sprint-episode-history"><summary>ประวัติใน Sprint นี้</summary>{data.episodes.filter(e=>e.projectId===entry.projectId && e.exitedAt).map(e=><Link key={e.id} href={sprintEntryHref({...entry,kind:"continued",participationId:e.id},groupId,year)}>ข้อมูล ณ {e.exitedAt?.slice(0,10)} · {e.reason || "ส่งต่อ"}</Link>)}</details>}</td><td><div className="sd-qa-chips">{qa.length ? qa.map(q=><span key={q.userId}>{q.name}</span>) : <span className="sd-unassigned">{h?.participation.snapshotKind==='legacy-summary' ? 'ไม่มีข้อมูลย้อนหลัง' : 'ยังไม่มอบหมาย'}</span>}</div></td><td><div className="sd-project-progress">{unknown ? <span>ยังไม่มียอดสรุป · เปิด Project เพื่ออัปเดต</span> : <><span>{done} / {counts.totalCases ?? 0} ({progress}%)</span><progress value={progress} max={100}/></>}</div></td><td>{unknown?'—':counts.failed ?? 0}</td><td>{unknown?'—':`${counts.closedDefects ?? 0}/${counts.totalDefects ?? counts.openDefects ?? 0}`}</td><td>{h?.participation.snapshotKind==='legacy-summary' ? 'ไม่มีข้อมูลย้อนหลัง' : approval.total ? `Approved ${approval.approved}/${approval.total}${approval.pending ? ' · รอรีวิว' : ''}${approval.changesRequested ? ' · ขอแก้ไข' : ''}` : 'ยังไม่ส่ง'}</td><td>{entry.kind==='current' && live ? renderActions ? renderActions(live) : <Link href={`/groups/${groupId}/projects/${live.id}/settings`}>จัดการ</Link> : <Link href={`/groups/${groupId}/projects/${entry.projectId}/test-cases`}>เปิดงานปัจจุบัน</Link>}</td></tr>;
 })}</tbody></table></div>{!filtered.length && <p className="sd-empty">ไม่พบ Project</p>}
 {filtered.length>10 && <footer className="sd-pagination"><button className="secondary-button" disabled={!safePage} onClick={()=>setPage(safePage-1)}>ก่อนหน้า</button><span>{safePage+1} / {Math.ceil(filtered.length/10)}</span><button className="secondary-button" disabled={(safePage+1)*10>=filtered.length} onClick={()=>setPage(safePage+1)}>ถัดไป</button></footer>}
 </section>;
}
