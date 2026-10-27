"use client";

import { useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, CircleAlert, Info, LoaderCircle } from 'lucide-react';
import { projectImportProgress, sheetImportProgressLabel, type SheetImportProgress } from '../lib/sheet-import-progress';
import type { RowLoadState } from '../lib/result-preview';

type Props = {
  projectName: string;
  names: string[];
  states: Record<string, RowLoadState>;
  progress: Record<string, SheetImportProgress>;
  active: boolean;
  ready: boolean;
  expectedImages?: number;
  persistedImages: number;
  missingEvidence?: { sheetName: string }[];
  refreshRequired?: boolean;
  conflictPending?: boolean;
  errorMessage?: string;
  actionLabel?: string;
  actionDescription?: string;
  canRetry: boolean;
  onRetry: () => void;
};

export function ProjectEvidenceProgress({ projectName, names, states, progress, active, ready, expectedImages, persistedImages, missingEvidence = [], refreshRequired, conflictPending, errorMessage, actionLabel, actionDescription, canRetry, onRetry }: Props) {
  const [collapsed, setCollapsed] = useState(true);
  const view = projectImportProgress(names, states, progress, active, ready && !errorMessage, expectedImages, conflictPending ?? false);
  const total = active ? view.imageTotal : expectedImages ?? view.imageTotal;
  const uploaded = active ? view.uploaded : persistedImages;
  const missingBySheet = new Map<string, number>();
  for (const item of missingEvidence) missingBySheet.set(item.sheetName, (missingBySheet.get(item.sheetName) ?? 0) + 1);
  const missingDescription = [...missingBySheet].map(([name, count]) => `${name} (${count} รูป)`).join(' · ');
  const titles = { details: 'กำลังอ่านและบันทึกรายละเอียด', workbook: 'กำลังเตรียมไฟล์รูปหลักฐาน', images: 'กำลังอัปโหลดรูป', saving: 'กำลังตรวจและบันทึก', conflict: 'รอยืนยันข้อมูลที่ขัดแย้ง', error: 'นำเข้ายังไม่ครบ', complete: 'บันทึกหลักฐานครบแล้ว' };
  const failed = !active && (!!errorMessage || view.failed > 0) && !view.ready && view.stage !== 'conflict';
  const unverified = !active && !view.ready && !failed && !refreshRequired && view.stage !== 'conflict' && expectedImages === undefined;
  const awaitingVerification = !active && !view.ready && !failed && !refreshRequired && view.stage !== 'conflict' && !unverified && view.total > 0 && view.loaded === view.total;
  const pendingTabs = Math.max(0, view.total - view.loaded);
  const imagesSaved = total !== undefined && persistedImages === total;
  const title = failed ? 'นำเข้าหยุดชั่วคราว' : unverified ? 'ยังไม่พร้อมส่ง PO' : awaitingVerification ? (persistedImages < (total ?? 0) ? `ยังขาดรูปหลักฐาน ${(total ?? 0) - persistedImages} รูป` : 'รอตรวจยืนยันความครบถ้วนของหลักฐาน') : !active && refreshRequired && view.stage !== 'conflict' ? 'พร้อมอัปเดตข้อมูลล่าสุดจาก Sheets' : !active && !refreshRequired && imagesSaved && pendingTabs > 0 ? `รูปครบแล้ว · เหลือข้อมูลอีก ${pendingTabs} แท็บ` : titles[view.stage];
  const label = actionLabel ?? (view.ready || refreshRequired ? 'อัปเดตข้อมูลจาก Sheets' : unverified ? 'ตรวจและนำเข้าหลักฐาน' : 'นำเข้าส่วนที่เหลือต่อ');
  const percent = total === undefined || (total === 0 && !view.ready) ? undefined : total === 0 ? 100 : Math.min(100, Math.floor(uploaded / total * 100));
  return <section className={`project-evidence-progress evidence-stage-${view.stage}`} aria-label="ข้อมูลและหลักฐานจาก Sheets">
    <header className="evidence-progress-heading">
      <span className="evidence-progress-icon">{active ? <LoaderCircle size={22} className="spin" /> : view.ready ? <CheckCircle2 size={22} /> : <CircleAlert size={22} />}</span>
      <div><h2>ข้อมูลและหลักฐานจาก Sheets</h2><p>{projectName}</p></div>
      <button type="button" className="secondary-button evidence-collapse" aria-expanded={!collapsed} onClick={() => setCollapsed(!collapsed)}>{collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}{collapsed ? 'รายละเอียด' : 'ซ่อนรายละเอียด'}</button>
    </header>
    <>
      <div className="evidence-progress-body">
        <div className="evidence-progress-status" role="status"><strong>{title}</strong>{(active || view.ready || failed) && <span className="evidence-progress-percent">{failed ? 'ลองใหม่ได้' : percent === undefined ? 'กำลังโหลด…' : `${percent}%`}</span>}</div>
        {(active || view.ready || (percent !== undefined && !refreshRequired && !(imagesSaved && pendingTabs > 0))) && <div className={`evidence-progress-track ${percent === undefined && active ? 'evidence-progress-indeterminate' : ''}`} role="progressbar" aria-label="ความคืบหน้าการอัปโหลดรูป" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-valuetext={percent === undefined ? title : `อัปโหลดรูป ${percent}% · ${title}`}><div style={{width:`${percent ?? 0}%`}} /></div>}
        <p className="evidence-progress-caption"><span>{total === undefined ? active ? view.stage === 'saving' ? 'กำลังบันทึกข้อมูลก่อนตรวจรูปหลักฐาน' : 'กำลังตรวจจำนวนรูป' : 'ยังไม่ได้ตรวจรูปหลักฐาน' : `${active ? 'อัปโหลดรูปแล้ว' : 'รูปหลักฐานที่บันทึกไว้'} ${uploaded}/${total}`}</span><span>{unverified || (!active && missingEvidence.length > 0) ? 'อ่านข้อมูลแล้ว' : 'บันทึกครบ'} {view.loaded}/{view.total} แท็บ{view.failed ? ` · ไม่สำเร็จ ${view.failed}` : ''}</span></p>
        {!active && missingEvidence.length > 0 && <p className="evidence-progress-stats" role="status">ยังขาดรูปหลักฐาน {missingEvidence.length} รูป: {missingDescription}</p>}
        {!collapsed && <div className="evidence-progress-expanded">
          <div className="evidence-progress-note">{view.ready ? <CheckCircle2 size={17} /> : !active ? <CircleAlert size={17} /> : <Info size={17} />}<span>{view.ready ? 'ตรวจและบันทึกหลักฐานครบแล้ว พร้อมใช้ส่งให้ PO อนุมัติ' : view.stage === 'conflict' ? 'กรุณาเลือกข้อมูลในหน้าต่างยืนยันเพื่อให้นำเข้าต่อได้' : active ? 'ใช้หน้าอื่นในเว็บได้ โดยอย่าปิดแท็บระหว่างนำเข้า ระบบจะตรวจและบันทึกครบก่อนเปิดให้ส่ง PO' : unverified ? 'อ่านข้อมูลทดสอบแล้ว แต่ยังไม่ได้ตรวจว่ารูปหลักฐานนำเข้าและบันทึกครบหรือไม่' : actionDescription ?? 'ข้อมูลที่บันทึกแล้วจะถูกเก็บไว้ระหว่างตรวจหลักฐาน'}</span></div>
          <div className="evidence-progress-details"><ul>{[...new Set(names)].map(name => <li key={name}><strong>{name}</strong><span>{!active && missingBySheet.has(name) ? `ยังขาดรูปหลักฐาน ${missingBySheet.get(name)} รูป` : sheetImportProgressLabel(states[name] ?? 'idle',progress[name])}{progress[name]?.failed ? ` · รูปไม่สำเร็จ ${progress[name].failed}` : ''}</span></li>)}</ul></div>
        </div>}
      </div>
      <footer className="evidence-progress-footer"><span>{active ? 'ส่ง PO ได้หลังตรวจและบันทึกหลักฐานครบ' : view.stage === 'conflict' ? 'ยืนยันข้อมูลที่ขัดแย้งเพื่อดำเนินการต่อ' : actionDescription ?? (view.ready ? 'หลักฐานพร้อมส่งอนุมัติ' : 'ตรวจว่าผลทดสอบและรูปหลักฐานถูกบันทึกครบก่อนส่ง PO')}</span>{view.stage !== 'conflict' && canRetry && <button className="secondary-button" type="button" disabled={active} onClick={onRetry}>{active ? 'กำลังนำเข้า…' : label}</button>}</footer>
    </>
  </section>;
}
