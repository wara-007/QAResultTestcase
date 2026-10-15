import React from "react";
import { ExternalLink } from "lucide-react";
import type { TestCase, WorkbookSource } from "../lib/types";
import { validateWorkbook } from "../lib/workbook-validation";

export function WorkbookSummary({ cases, source }: { cases: TestCase[]; source: WorkbookSource }) {
  if (!source.coverSnapshot && !cases.some(testCase => testCase.stepDefinitions?.length)) return null;
  const report = validateWorkbook(cases, source);
  const cover = source.coverSnapshot;
  const fields = (cover?.fields ?? []).map(field => {
    const value = field.value.trim();
    const link = /^https?:\/\/[^\s]+$/i.test(value) ? value : undefined;
    return { ...field, link, wide: !link && (/description|รายละเอียด|คำอธิบาย/i.test(field.label) || value.length > 180) };
  });
  return <section className="panel workbook-summary"><div className="panel-heading"><div><h2>สรุปและตรวจสอบข้อมูล</h2><p>ตรวจความครบถ้วน/ความสอดคล้อง ไม่ใช่การยืนยันว่าฟังก์ชันทำงานถูกต้อง หรือผลอนุมัติของ PO</p></div></div><div className="workbook-summary-body">
    <section className="workbook-system-summary" aria-label="คำนวณจากข้อมูลในระบบ">
      <h3>คำนวณจากข้อมูลในระบบ</h3>
      <dl className="workbook-summary-metrics"><div><dt>Test Cases</dt><dd>{report.caseCount}</dd></div><div><dt>Steps</dt><dd>{report.stepCount}</dd></div>{Object.entries(report.statusTotals).map(([status, count]) => <div key={status} className={`workbook-metric-${status.toLowerCase().replace(/\s+/g, "-")}`}><dt>{status}</dt><dd>{count}</dd></div>)}</dl>
    </section>
    {cover && <section className="workbook-cover-summary" aria-label={`ข้อมูลจาก ${cover.sheetName}`}>
      <header className="workbook-cover-heading"><div><h3>ข้อมูลจาก {cover.sheetName}</h3><p>สรุปต้นฉบับ · อ่านอย่างเดียว · แยกจากยอดที่ระบบคำนวณ</p></div><div className="workbook-cover-counts"><span>Test Scenarios <strong>{cover.scenarioCount ?? "—"}</strong></span><span>Test Cases <strong>{cover.testcaseCount ?? "—"}</strong></span></div></header>
      <dl className="workbook-cover-fields">{fields.filter(field => !field.link && !field.wide).map((field, index) => <div key={index}><dt>{field.label}</dt><dd>{field.value || "—"}</dd></div>)}</dl>
      <dl className="workbook-cover-descriptions">{fields.filter(field => field.wide).map((field, index) => <div className="workbook-cover-description" key={index}><dt>{field.label}</dt><dd>{field.value || "—"}</dd></div>)}</dl>
      {fields.some(field => field.link) && <dl className="workbook-cover-links">{fields.filter(field => field.link).map((field, index) => <div key={index}><dt>{field.label}</dt><dd><a href={field.link} target="_blank" rel="noopener noreferrer" title={field.value}>{field.link!.match(/\/browse\/([^/?#]+)/)?.[1] ?? `เปิด ${field.label.replace(/[:：]\s*$/, "")}`}<ExternalLink size={15} aria-hidden="true"/></a></dd></div>)}</dl>}
      <details className="workbook-cover-original"><summary>ดูข้อมูลต้นฉบับทั้งหมดจาก Cover</summary><div className="sheet-cell-list">{cover.cells.map(cell => <div key={cell.ref}><strong>{cell.ref}</strong><pre>{cell.value}</pre></div>)}</div></details>
    </section>}
  </div></section>;
}
