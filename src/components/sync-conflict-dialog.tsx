"use client";

import { useState } from "react";
import { Check, ChevronDown, CircleAlert, CopyPlus, Database, FileSpreadsheet, X } from "lucide-react";
import type { TestCase } from "@/lib/types";
import type { CaseChoice, CaseConflict } from "@/lib/sync/client-conflicts";

const fieldLabels: Record<string, string> = {
  name: "ชื่อ Testcase", scenario: "Scenario", condition: "Conditions", steps: "ขั้นตอนการทดสอบ",
  expected: "ผลลัพธ์ที่คาดหวัง", testData: "ข้อมูลทดสอบ", platform: "Platform", status: "สถานะ",
  device: "อุปกรณ์", appVersion: "เวอร์ชันแอป", environment: "Environment", executedBy: "ผู้ทดสอบ",
  executedDate: "วันที่ทดสอบ", executedTime: "เวลาทดสอบ", remark: "หมายเหตุ", customFields: "ข้อมูลเพิ่มเติม",
  results: "บันทึกผลการทดสอบ", defects: "Defects",
};

function topLevelFields(conflict: CaseConflict) {
  if (conflict.changedFields.includes("เพิ่มใหม่ทั้งสองฝั่ง")) return ["name", "scenario", "condition"];
  return [...new Set(conflict.changedFields.map((field) => field.split(".")[0]))];
}

function fieldValue(testCase: TestCase, field: string) {
  const value = (testCase as unknown as Record<string, unknown>)[field];
  if (value == null || value === "") return <span className="sync-empty-value">ไม่มีข้อมูล</span>;
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.length ? `${value.length} รายการ` : <span className="sync-empty-value">ไม่มีข้อมูล</span>;
  return JSON.stringify(value);
}

function ChoiceButton({ active, icon, title, description, onClick }: { active: boolean; icon: React.ReactNode; title: string; description: string; onClick: () => void }) {
  return <button type="button" className={`sync-choice-button${active ? " selected" : ""}`} aria-pressed={active} onClick={onClick}>
    <span className="sync-choice-icon">{active ? <Check size={17} /> : icon}</span>
    <span><strong>{title}</strong><small>{description}</small></span>
  </button>;
}

export function SyncConflictDialog({ conflicts, operation, onCancel, onConfirm }: { conflicts: CaseConflict[]; operation: "pull" | "push"; onCancel: () => void; onConfirm: (choices: Record<string, CaseChoice>) => Promise<void> }) {
  const [choices, setChoices] = useState<Record<string, CaseChoice>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const unresolved = conflicts.filter((item) => !choices[item.id]);
  const resolvedCount = conflicts.length - unresolved.length;
  const differingFieldCount = conflicts.reduce((sum, item) => sum + item.changedFields.length, 0);
  const chooseAll = (side: "system" | "google") => { setChoices(Object.fromEntries(conflicts.map((item) => [item.id, { side }]))); setError(""); };

  async function confirm() {
    if (unresolved.length) return setError(`กรุณาเลือกข้อมูลอีก ${unresolved.length} Testcase`);
    setBusy(true); setError("");
    try { await onConfirm(choices); } catch (reason) { setError(reason instanceof Error ? reason.message : "ซิงค์ข้อมูลไม่สำเร็จ"); setBusy(false); }
  }

  return <div className="modal-backdrop sync-conflict-backdrop" role="presentation">
    <section className="sync-conflict-dialog" role="dialog" aria-modal="true" aria-labelledby="sync-conflict-title" aria-describedby="sync-conflict-description">
      <header className="sync-conflict-header">
        <div className="sync-conflict-title-wrap"><span className="sync-conflict-alert-icon"><CircleAlert size={22} /></span><div><span className="eyebrow">ตรวจสอบก่อนซิงค์</span><h2 id="sync-conflict-title">พบ Testcase ที่ข้อมูลไม่ตรงกัน</h2><p id="sync-conflict-description">เลือกข้อมูลที่ต้องการเก็บ ระบบจะแสดงเฉพาะฟิลด์ที่ต่างกันจริง</p></div></div>
        <button className="icon-button" onClick={onCancel} disabled={busy} aria-label="ปิดหน้าต่างตรวจสอบ"><X size={20} /></button>
      </header>

      <div className="sync-conflict-summary" aria-live="polite">
        <div><strong>{conflicts.length}</strong><span>Testcase ต้องตรวจสอบ</span></div><div><strong>{differingFieldCount}</strong><span>ฟิลด์ที่แตกต่าง</span></div><div className={unresolved.length ? "needs-action" : "complete"}><strong>{resolvedCount}/{conflicts.length}</strong><span>{unresolved.length ? `เลือกแล้ว · เหลือ ${unresolved.length}` : "เลือกครบแล้ว"}</span></div>
      </div>

      <div className="sync-conflict-toolbar"><span>เลือกเหมือนกันทุกรายการ</span><div><button className="secondary-button" onClick={() => chooseAll("system")} disabled={busy}><Database size={16} />ใช้ระบบทั้งหมด</button><button className="secondary-button" onClick={() => chooseAll("google")} disabled={busy}><FileSpreadsheet size={16} />ใช้ Google ทั้งหมด</button></div></div>

      <div className="sync-conflict-list">{conflicts.map((conflict, index) => {
        const choice = choices[conflict.id];
        const fields = topLevelFields(conflict);
        const isDuplicateCreation = conflict.changedFields.includes("เพิ่มใหม่ทั้งสองฝั่ง");
        return <details key={conflict.id} open={index === 0} className={choice ? "resolved" : ""}>
          <summary><span className="sync-case-status">{choice ? <Check size={15} /> : index + 1}</span><span className="sync-case-title"><strong>{conflict.id}</strong><small>{isDuplicateCreation ? "พบ ID เดียวกันที่สร้างใหม่ทั้งสองฝั่ง" : `${fields.length} ฟิลด์ไม่ตรงกัน: ${fields.map((field) => fieldLabels[field] ?? field).join(", ")}`}</small></span>{choice && <span className="sync-choice-summary">{choice.side === "system" ? "ใช้ข้อมูลระบบ" : choice.side === "google" ? "ใช้ Google Sheets" : "เก็บทั้งสองรายการ"}</span>}<ChevronDown className="sync-chevron" size={19} /></summary>
          <div className="sync-case-content">
            <div className="sync-diff-table" role="table" aria-label={`ข้อมูลที่แตกต่างของ ${conflict.id}`}>
              <div className="sync-diff-row sync-diff-head" role="row"><span role="columnheader">ฟิลด์</span><span role="columnheader"><Database size={15} />ข้อมูลในระบบ</span><span role="columnheader"><FileSpreadsheet size={15} />Google Sheets</span></div>
              {fields.map((field) => <div className="sync-diff-row" role="row" key={field}><strong role="rowheader">{fieldLabels[field] ?? field}</strong><p role="cell">{fieldValue(conflict.local, field)}</p><p role="cell">{fieldValue(conflict.google, field)}</p></div>)}
            </div>
            <fieldset className="sync-case-choices"><legend>ต้องการเก็บข้อมูลแบบไหน?</legend><div>
              <ChoiceButton active={choice?.side === "system"} icon={<Database size={17} />} title="ใช้ข้อมูลระบบ" description="แทนค่าจาก Google" onClick={() => setChoices((current) => ({ ...current, [conflict.id]: { side: "system" } }))} />
              <ChoiceButton active={choice?.side === "google"} icon={<FileSpreadsheet size={17} />} title="ใช้ Google Sheets" description="แทนค่าในระบบ" onClick={() => setChoices((current) => ({ ...current, [conflict.id]: { side: "google" } }))} />
              <ChoiceButton active={choice?.side === "both"} icon={<CopyPlus size={17} />} title="เก็บทั้งสองรายการ" description="สร้าง ID ใหม่ให้ Google" onClick={() => setChoices((current) => ({ ...current, [conflict.id]: { side: "both", newId: choice?.side === "both" ? choice.newId : `${conflict.google.id}-GS` } }))} />
            </div></fieldset>
            {choice?.side === "both" && <label className="sync-new-id"><span>ID ใหม่ของข้อมูล Google Sheets</span><input autoFocus value={choice.newId} onChange={(event) => setChoices((current) => ({ ...current, [conflict.id]: { side: "both", newId: event.target.value } }))} /><small>ต้องไม่ซ้ำกับ Testcase ที่มีอยู่</small></label>}
          </div>
        </details>;
      })}</div>

      <footer className="sync-conflict-footer"><div>{error ? <p className="form-error"><CircleAlert size={16} />{error}</p> : <span>{unresolved.length ? `เลือกอีก ${unresolved.length} รายการเพื่อดำเนินการต่อ` : "พร้อมดำเนินการต่อ"}</span>}</div><div><button className="secondary-button" onClick={onCancel} disabled={busy}>ยกเลิก</button><button className="primary-button" onClick={() => void confirm()} disabled={busy || Boolean(unresolved.length)}>{busy ? (operation === "pull" ? "กำลังโหลด..." : "กำลังซิงค์...") : (operation === "pull" ? "ยืนยันและโหลดข้อมูล" : "ยืนยันและซิงค์ข้อมูล")}</button></div></footer>
    </section>
  </div>;
}
