"use client";

import { useEffect, useRef, useState, useTransition } from 'react';
import { LoaderCircle, X } from 'lucide-react';
import { setTestCaseQa, type getTestCaseAssignments } from '@/app/planning-actions';

export type AssignmentData = Awaited<ReturnType<typeof getTestCaseAssignments>>;
export type CaseAssignmentTarget = {caseId?:string;testcaseKey:string;sourceSheet:string};

export function TestCaseAssignmentDialog({projectId,targets,data,onClose,onSaved}:{projectId:string;targets:CaseAssignmentTarget[];data:AssignmentData;onClose:()=>void;onSaved:()=>void}) {
  const ref=useRef<HTMLDialogElement>(null);
  const resolved=targets.map(t=>({...t,caseId:t.caseId || data.cases.find(c=>c.testcase_key===t.testcaseKey)?.id}));
  const missing=resolved.filter(t=>!t.caseId);
  const [qaIds,setQaIds]=useState<string[]>(()=>{
    if(resolved.length!==1) return [];
    return data.assignments.filter(a=>a.test_case_id===resolved[0].caseId && a.source_sheet===resolved[0].sourceSheet).map(a=>a.user_id);
  });
  const [error,setError]=useState('');
  const [pending,startTransition]=useTransition();
  useEffect(()=>{ref.current?.showModal();},[]);
  const unavailable=qaIds.filter(id=>!data.team.some(m=>m.userId===id));
  return <dialog ref={ref} className="sd-dialog" aria-label="มอบหมายผู้รับผิดชอบ Test cases" onCancel={event=>{if(pending)event.preventDefault();else onClose();}}>
    <header><h2>มอบหมาย QA · {targets.length} แถว</h2><button type="button" className="icon-button" disabled={pending} aria-label="ปิดการมอบหมาย" onClick={onClose}><X size={20}/></button></header>
    <p className="dialog-help" style={{padding:'0 24px'}}>ผู้รับผิดชอบชุดที่เลือกจะใช้แทนชุดเดิมของทุกแถวที่เลือก แยกแท็บผลออกจากกัน เลือกได้หลายคน หรือไม่เลือกเพื่อยกเลิกการมอบหมาย</p>
    <p style={{padding:'0 24px'}}>{targets.map(t=>`${t.testcaseKey}${t.sourceSheet ? ` (${t.sourceSheet})` : ''}`).join(', ')}</p>
    {missing.length>0 && <p className="form-error" role="alert" style={{padding:'0 24px'}}>ยังไม่พบข้อมูลที่บันทึกของ {missing.map(t=>t.testcaseKey).join(', ')} กรุณาบันทึก/นำเข้าเคสก่อน ไม่ได้มอบหมายแถวอื่นแทน</p>}
    {data.error && <p className="form-error" role="alert" style={{padding:'0 24px'}}>{data.error}</p>}
    <div className="case-assignment-people">{data.team.map(m=><label key={m.userId}><input type="checkbox" checked={qaIds.includes(m.userId)} disabled={pending} onChange={e=>setQaIds(ids=>e.target.checked ? [...ids,m.userId] : ids.filter(id=>id!==m.userId))}/><span><strong>{m.name}</strong><small>{m.email}</small></span></label>)}{!data.team.length && !data.error && <p>ยังไม่มี QA ที่มีสิทธิ์ในกลุ่มนี้ กรุณาเพิ่มสมาชิกกลุ่มก่อน</p>}{unavailable.length>0 && <div><p>มีผู้รับผิดชอบเดิมที่ไม่มีสิทธิ์รับงานใหม่ กรุณานำออกก่อนบันทึก</p><button type="button" className="secondary-button" disabled={pending} onClick={()=>setQaIds(ids=>ids.filter(id=>!unavailable.includes(id)))}>นำผู้ไม่มีสิทธิ์ออกจากชุดที่เลือก</button></div>}</div>
    {error && <p className="form-error" role="alert" style={{padding:'0 24px'}}>{error}</p>}
    <footer className="dialog-footer"><button type="button" className="secondary-button" disabled={pending} onClick={onClose}>ยกเลิก</button><button type="button" className="primary-button" disabled={pending || !!data.error || !!missing.length || !!unavailable.length || !targets.length || targets.length>500} onClick={()=>{setError('');startTransition(async()=>{try {const result=await setTestCaseQa(projectId,resolved.map(t=>({caseId:t.caseId!,sourceSheet:t.sourceSheet})),qaIds);if(result.error)setError(result.error);else onSaved();} catch {setError('บันทึกไม่สำเร็จ กรุณาลองใหม่');}});}}>{pending && <LoaderCircle size={16} className="spin"/>}{qaIds.length ? `แทนที่ผู้รับผิดชอบด้วย QA ${qaIds.length} คน` : 'ยกเลิกผู้รับผิดชอบของแถวที่เลือก'}</button></footer>
  </dialog>;
}
