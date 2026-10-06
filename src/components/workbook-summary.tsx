import React from "react";
import type { TestCase, WorkbookSource } from "../lib/types";
import { validateWorkbook } from "../lib/workbook-validation";

export function WorkbookSummary({ cases, source }: { cases: TestCase[]; source: WorkbookSource }) {
  if (!source.coverSnapshot && !cases.some(testCase => testCase.stepDefinitions?.length)) return null;
  const report = validateWorkbook(cases, source);
  const cover = source.coverSnapshot;
  return <section className="panel workbook-summary"><div className="panel-heading"><div><h2>สรุปและตรวจสอบข้อมูล</h2><p>ตรวจความครบถ้วน/ความสอดคล้อง ไม่ใช่การยืนยันว่าฟังก์ชันทำงานถูกต้อง หรือผลอนุมัติของ PO</p></div></div><div className="workbook-summary-body">
    <h3>คำนวณจากข้อมูลในระบบ</h3><p>{report.caseCount} Test Cases · {report.stepCount} Steps</p><div className="case-context">{Object.entries(report.statusTotals).map(([status, count]) => <span key={status}>{status}: {count}</span>)}</div>
    {cover && <><h3>ข้อมูลจาก {cover.sheetName} — สรุปต้นฉบับ (อ่านอย่างเดียว)</h3><p>Test Scenarios: {cover.scenarioCount ?? "—"} · Test Case ตาม Cover: {cover.testcaseCount ?? "—"}</p><dl className="workbook-cover-fields">{cover.fields.map((field, index) => <div key={index}><dt>{field.label}</dt><dd>{field.value || "—"}</dd></div>)}</dl><details><summary>ดูข้อมูลต้นฉบับทั้งหมดจาก Cover</summary><div className="sheet-cell-list">{cover.cells.map(cell => <div key={cell.ref}><strong>{cell.ref}</strong><pre>{cell.value}</pre></div>)}</div></details></>}
    <h3>ผลตรวจสอบของระบบ</h3>{report.issues.length ? <ul className="workbook-validation-issues">{report.issues.map((issue, index) => <li key={index}>{issue.message}</li>)}</ul> : <p>ไม่พบความคลาดเคลื่อนจากข้อมูลที่ตรวจได้</p>}
  </div></section>;
}
