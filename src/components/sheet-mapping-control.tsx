"use client";

import { Check, Link2, LoaderCircle, Unlink } from "lucide-react";
import { useId, useMemo, useState } from "react";
import type { ProjectSheetMapping, TestCase, WorkbookSheet } from "@/lib/types";

export function SheetMappingControl({
  projectId,
  sheet,
  cases,
  existingMapping,
  suggestedTestcaseKey,
  canEdit,
  onChanged,
}: {
  projectId: string;
  sheet: WorkbookSheet;
  cases: TestCase[];
  existingMapping?: ProjectSheetMapping;
  suggestedTestcaseKey?: string;
  canEdit: boolean;
  onChanged: (mapping: ProjectSheetMapping | null) => void;
}) {
  const listId = useId();
  const [query, setQuery] = useState(existingMapping?.testcaseKey ?? suggestedTestcaseKey ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const matchingCase = useMemo(() => cases.find((item) => item.id.trim().toLocaleUpperCase() === query.trim().toLocaleUpperCase()), [cases, query]);

  if (sheet.sheetId == null) return <p className="sheet-mapping-note">Mapping แบบถาวรใช้ได้เมื่อโหลดจาก Google Sheets</p>;
  if (!canEdit) return <p className="sheet-mapping-note"><Link2 size={14} />{existingMapping ? `ผูกกับ ${existingMapping.testcaseKey}` : suggestedTestcaseKey ? `ระบบจับคู่กับ ${suggestedTestcaseKey}` : "ยังไม่ได้ผูกกับ Test Case · ต้องมีสิทธิ์แก้ไข Project"}</p>;

  async function save() {
    if (!matchingCase || sheet.sheetId == null) return setError("กรุณาเลือก Test Case จากรายการ");
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/projects/${projectId}/sheet-mappings/${sheet.sheetId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheetName: sheet.name, testcaseKey: matchingCase.id }),
      });
      const data = await response.json() as { mapping?: ProjectSheetMapping; error?: string };
      if (!response.ok || !data.mapping) throw new Error(data.error ?? "บันทึก mapping ไม่สำเร็จ");
      setQuery(data.mapping.testcaseKey);
      onChanged(data.mapping);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "บันทึก mapping ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (sheet.sheetId == null) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/projects/${projectId}/sheet-mappings/${sheet.sheetId}`, { method: "DELETE" });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "ยกเลิก mapping ไม่สำเร็จ");
      setQuery("");
      onChanged(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "ยกเลิก mapping ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return <div className="sheet-mapping-control" onClick={(event) => event.stopPropagation()}>
    <label htmlFor={`${listId}-input`}>{existingMapping ? "เปลี่ยน Test Case ที่ผูก" : suggestedTestcaseKey ? "ยืนยันหรือเปลี่ยน Test Case ที่ระบบจับคู่" : "ผูกแท็บนี้กับ Test Case"}</label>
    <div className="sheet-mapping-fields">
      <input
        id={`${listId}-input`}
        list={listId}
        value={query}
        onChange={(event) => { setQuery(event.target.value); setError(""); }}
        placeholder="ค้นหา เช่น TC-18"
        disabled={busy}
      />
      <datalist id={listId}>{cases.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</datalist>
      <button type="button" className="primary-button" disabled={busy || !matchingCase || matchingCase.id === existingMapping?.testcaseKey} onClick={() => void save()}>{busy ? <LoaderCircle className="spin" size={15} /> : <Check size={15} />}บันทึก</button>
      {existingMapping && <button type="button" className="secondary-button" disabled={busy} onClick={() => void remove()}><Unlink size={15} />ยกเลิกการผูก</button>}
    </div>
    {matchingCase && <small>เลือก: {matchingCase.id} · {matchingCase.name || "ไม่มีชื่อ Test Case"}</small>}
    {error && <small className="sheet-mapping-error">{error}</small>}
  </div>;
}
