import { useState } from "react";
import type { TestCaseStep, TestResult } from "../lib/types";

export function ResultStepMapping({ result, steps, saving, onSave }: { result: TestResult; steps: TestCaseStep[]; saving: boolean; onSave: (stepId: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState(result.stepId ?? "");
  const step = steps.find(step => step.id === selected);
  return <div className="result-step-mapping">
    <small>แหล่งผล: {result.sourceSheetName || "Web"}{result.sourceRange ? ` · แถว ${result.sourceRange.startRow}–${result.sourceRange.endRow}` : ""}</small>
    {!editing ? <button type="button" className="secondary-button" disabled={saving} onClick={() => { setSelected(result.stepId ?? ""); setEditing(true); }}>{result.stepId ? "เปลี่ยนการจับคู่ Step" : "เลือก Step ให้ผลนี้"}</button> : <>
      <label><span>Step ของผลการทดสอบ</span><select value={selected} disabled={saving} onChange={event => setSelected(event.target.value)}><option value="">ยังไม่ผูก Step</option>{steps.map(step => <option key={step.id} value={step.id}>{step.name} · {step.description}</option>)}</select></label>
      {step && <div className="multiline"><strong>{step.description}</strong><p>Expected Result: {step.expected || "—"}</p></div>}
      <button type="button" className="primary-button" disabled={saving || selected === (result.stepId ?? "")} onClick={async () => { try { await onSave(selected); setEditing(false); } catch { /* Parent shows the error and keeps the selection for retry. */ } }}>บันทึกการจับคู่</button>
      <button type="button" className="secondary-button" disabled={saving} onClick={() => setEditing(false)}>ยกเลิก</button>
    </>}
    {!!result.stepMappingHistory?.length && <details><summary>ประวัติการจับคู่</summary>{result.stepMappingHistory.map((entry, index) => <p key={index}>{entry.by} · {entry.at} · {steps.find(step => step.id === entry.fromStepId)?.name || "ไม่ผูก Step"} → {steps.find(step => step.id === entry.toStepId)?.name || "ไม่ผูก Step"}</p>)}</details>}
  </div>;
}
