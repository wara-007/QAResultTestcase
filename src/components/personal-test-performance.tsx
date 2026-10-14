"use client";

import Link from 'next/link';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Users, X } from 'lucide-react';
import { buildPersonalPerformance, type PersonalEntry, type PersonalPerformanceInput, type PersonalPerformanceRow, type PerformanceFilters } from '@/lib/personal-test-performance';
import { formatReportDate } from '@/lib/date-format';

const columns=[['tested','เทสแล้ว',''],['pass','Pass','pass'],['failed','Fail','failed'],['inProgress','In Progress','in-progress'],['skip','Skip','skip'],['notStart','Not Start','not-start']] as const;
function entriesFor(entries:PersonalEntry[],metric:typeof columns[number][0]) {
  return entries.filter(e=>metric==='tested' ? e.status==='Pass' || e.status==='Failed' : e.status===({pass:'Pass',failed:'Failed',inProgress:'In Progress',skip:'Skip',notStart:'Not Start'} as const)[metric]);
}

export function PersonalTestPerformance({data,compact=false,onViewAll}:{data:PersonalPerformanceInput;compact?:boolean;onViewAll?:()=>void}) {
  const [projectId,setProjectId]=useState('');
  const [testerKey,setTesterKey]=useState('');
  const [source,setSource]=useState<PerformanceFilters['source']>();
  const [expanded,setExpanded]=useState('');
  const [details,setDetails]=useState<{title:string;entries:PersonalEntry[]}|null>(null);
  const all=useMemo(()=>buildPersonalPerformance(data),[data]);
  const rows=useMemo(()=>buildPersonalPerformance({...data,filters:{projectId,testerKey,source}}),[data,projectId,testerKey,source]);
  const projects=[...new Map(data.cases.map(c=>[c.projectId,c.projectName])).entries()];
  const shown=compact ? rows.slice(0,4) : rows;
  function show(person:PersonalPerformanceRow,metric:typeof columns[number][0],entries=person.entries,label=person.name) {
    setDetails({title:`${label} · ${columns.find(c=>c[0]===metric)?.[1]}`,entries:entriesFor(entries,metric)});
  }
  return <section className="sd-panel sd-team personal-performance" id="sprint-team">
    <div className="sd-section-heading"><div><h2><Users size={20}/>ผลการทดสอบรายบุคคล</h2><p>แยกงานที่รับผิดชอบจากผลที่ทดสอบจริง · กดชื่อเพื่อดูรายละเอียด</p></div>{compact && onViewAll && <button type="button" className="sd-text-button" onClick={onViewAll}>ดูทั้งหมด<ChevronRight size={16}/></button>}</div>
    <div className="personal-performance-filters">
      <label>Project<select aria-label="กรองผลงานตาม Project" value={projectId} onChange={e=>setProjectId(e.target.value)}><option value="">ทุก Project</option>{projects.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
      <label>ผู้ทดสอบ<select aria-label="กรองผู้ทดสอบ" value={testerKey} onChange={e=>setTesterKey(e.target.value)}><option value="">ทุกคน</option>{all.map(p=><option key={p.key} value={p.key}>{p.name}</option>)}</select></label>
      <label>แหล่งผล<select aria-label="กรองแหล่งผล" value={source ?? ''} onChange={e=>setSource((e.target.value || undefined) as PerformanceFilters['source'])}><option value="">ทั้งหมด · รวมงานยังไม่เริ่ม</option><option value="web">เว็บ</option><option value="sheets">Sheets / ข้อมูลเดิม</option></select></label>
    </div>
    <div className="sd-table-scroll"><table><thead><tr><th>ผู้ทดสอบ</th><th>รับผิดชอบ</th>{columns.slice(1).map(c=><th key={c[0]}>{c[1]}</th>)}</tr></thead><tbody>{shown.map(person=><Fragment key={person.key}>
      <tr className={expanded===person.key ? 'personal-selected' : undefined}><td><button type="button" className="personal-person-button" aria-expanded={expanded===person.key} onClick={()=>setExpanded(expanded===person.key ? '' : person.key)}>{expanded===person.key ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}<span className="sd-avatar">{person.name.slice(0,2).toUpperCase()}</span><span><strong>{person.name}</strong><small>{person.email || (person.key==='unknown' ? 'ไม่ได้ระบุ EXECUTED BY ในข้อมูลต้นฉบับ' : person.unresolved ? 'ชื่อจากผลทดสอบ · ยังไม่จับคู่บัญชี' : person.key==='unassigned' ? 'ยังไม่มีผู้รับผิดชอบ' : '')}</small></span></button></td><td><button type="button" className="personal-count" disabled={!person.assigned} aria-label={`${person.name} รับผิดชอบ ${person.assigned} เคส`} onClick={()=>setDetails({title:`${person.name} · งานที่รับผิดชอบ (ไม่ใช่ผลทดสอบ)`,entries:person.assignedEntries})}>{person.assigned}</button></td>{columns.slice(1).map(([key,label,color])=><td key={key}><button type="button" className={`personal-count status-${color}`} disabled={!person[key]} aria-label={`${person.name} ${label} ${person[key]} เคส`} onClick={()=>show(person,key)}>{person[key]}</button></td>)}</tr>
      {expanded===person.key && <tr><td colSpan={7} className="personal-expanded"><PersonCaseReport key={`${person.key}:${projectId}:${source ?? ''}`} person={person} compact={compact} onViewAll={()=>setDetails({title:`ผลทดสอบของ ${person.name}`,entries:person.entries})}/></td></tr>}
    </Fragment>)}</tbody></table></div>
    {!rows.length && <p className="sd-empty">ไม่มีผลหรือเคสที่ตรงกับตัวกรองจากข้อมูลที่บันทึกไว้</p>}
    {compact && rows.length>shown.length && <button type="button" className="sd-text-button personal-show-all" onClick={onViewAll}>ดูอีก {rows.length-shown.length} คน<ChevronRight size={16}/></button>}
    <p className="sd-footnote">รับผิดชอบ = งานที่มอบหมายรายเคส ไม่ใช่ผู้ทดสอบจริง · ผลใช้รายการล่าสุดต่อคนต่อเคสและแหล่งผล · Skip ไม่รวม Pass · หลายคนเทสเคสเดียวกันนับแยกคน</p>
    {rows.some(p=>p.entries.some(e=>e.inferred)) && <p className="sd-inferred">ข้อมูลเดิม/นำเข้าใช้ชื่อผู้ทดสอบจากผลที่บันทึกไว้ หากไม่ทราบ Sprint ต้นกำเนิดจะแสดงใน Sprint ปัจจุบัน พร้อมป้าย “ข้อมูลเดิม/นำเข้า”</p>}
    {details && <PerformanceDetails key={details.title} {...details} onClose={()=>setDetails(null)}/>}
  </section>;
}

function PersonCaseReport({person,compact,onViewAll}:{person:PersonalPerformanceRow;compact:boolean;onViewAll:()=>void}) {
  const [page,setPage]=useState(0);
  const entries=[...person.entries].sort((a,b)=>(Date.parse(b.recordedAt)||0)-(Date.parse(a.recordedAt)||0));
  const latest=entries.find(entry=>Number.isFinite(Date.parse(entry.recordedAt)))?.recordedAt;
  const size=compact ? 5 : 10;
  return <div className="personal-report"><h3>งานของ {person.name}</h3><p>{person.projects} Projects · รับผิดชอบ {person.assigned} เคส · อัปเดตล่าสุด {latest ? formatReportDate(latest) : 'ไม่ระบุเวลา'}</p>
    <div className="personal-report-head"><span>Project / Test case</span><span>ผลล่าสุด</span><span>อัปเดต</span><span className="sr-only">ดูเคส</span></div>
    {entries.slice(page*size,(page+1)*size).map(entry=><Link className="personal-report-row" href={entry.detailPath} key={entry.key}><span><strong>{entry.caseId}{entry.sourceRowKey && entry.sourceRowKey!=='base' ? ` (${entry.sourceRowKey})` : ''}</strong><small>{entry.projectName} · {entry.caseName}</small><small>{entry.source==='pending' ? 'งานที่มอบหมาย · ยังไม่มีผลของคนนี้' : entry.source==='web' ? 'เว็บ' : 'Sheets / ข้อมูลเดิม'}</small></span><span className={`personal-report-status status-${entry.status.toLowerCase().replaceAll(' ','-')}`}>{entry.status}</span><time>{entry.recordedAt ? formatReportDate(entry.recordedAt) : 'ไม่ระบุเวลา'}</time><ChevronRight size={16}/></Link>)}
    {!entries.length && <p className="sd-empty">ยังไม่มีผลทดสอบของคนนี้ งานที่มอบหมายดูได้จากจำนวน “รับผิดชอบ”</p>}
    {entries.length>size && <div className="sd-pagination"><button type="button" className="secondary-button" disabled={!page} onClick={()=>setPage(p=>p-1)}>ก่อนหน้า</button><span>{page+1} / {Math.ceil(entries.length/size)}</span><button type="button" className="secondary-button" disabled={(page+1)*size>=entries.length} onClick={()=>setPage(p=>p+1)}>ถัดไป</button></div>}
    {!!entries.length && <button type="button" className="sd-text-button" onClick={onViewAll}>ดูรายงานทั้งหมดของ {person.name}<ChevronRight size={16}/></button>}
  </div>;
}

function PerformanceDetails({title,entries,onClose}:{title:string;entries:PersonalEntry[];onClose:()=>void}) {
  const ref=useRef<HTMLDialogElement>(null);
  const [page,setPage]=useState(0);
  useEffect(()=>{ref.current?.showModal();},[]);
  return <dialog ref={ref} className="sd-dialog" aria-label={title} onCancel={onClose}>
    <header><h2>{title} · {entries.length} เคส</h2><button type="button" className="icon-button" aria-label="ปิดรายการเคส" onClick={onClose}><X size={20}/></button></header>
    <div className="personal-case-list">{entries.slice(page*10,(page+1)*10).map(e=><Link href={e.detailPath} key={e.key}><span><strong>{e.caseId}{e.sourceRowKey && e.sourceRowKey!=='base' ? ` (${e.sourceRowKey})` : ''} · {e.caseName}</strong><small>{e.projectName} · {e.source==='pending' ? 'งานที่มอบหมาย · ไม่ใช่ผลทดสอบ' : e.source==='web' ? 'เว็บ' : 'Sheets / ข้อมูลเดิม'}</small>{e.recordedAt && <small>{formatReportDate(e.recordedAt)}</small>}</span><span>{e.source==='pending' ? 'มอบหมายแล้ว' : e.status}<ChevronRight size={16}/></span></Link>)}</div>
    {entries.length>10 && <footer className="dialog-footer"><button type="button" className="secondary-button" disabled={!page} onClick={()=>setPage(p=>p-1)}>ก่อนหน้า</button><span>{page+1} / {Math.ceil(entries.length/10)}</span><button type="button" className="secondary-button" disabled={(page+1)*10>=entries.length} onClick={()=>setPage(p=>p+1)}>ถัดไป</button></footer>}
  </dialog>;
}
