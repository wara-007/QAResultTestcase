import type { WorkbookSource, TestCase } from "./types";
import { stepHeaderKey, stepStatus } from "./step-testcases";
import { sheetColumn } from "./step-sheet-results";
export type CoverSnapshot = { sheetName: string; fields: { label: string; value: string }[]; testcaseCount?: number; scenarioCount?: number; statusTotals: Record<string, number>; cells: { ref: string; value: string }[] };
export function parseCoverSnapshot(rows: unknown[][], sheetName: string): CoverSnapshot {
  const snapshot: CoverSnapshot = { sheetName, fields: [], statusTotals: {}, cells: [] };
  let statusSection = false;
  rows.forEach((row, index) => row.forEach((cell, column) => {
    const value = String(cell ?? "").trim();
    if (!value) return;
    snapshot.cells.push({ ref: `${sheetColumn(column)}${index + 1}`, value });
    const key = stepHeaderKey(value);
    if (value.endsWith(":")) snapshot.fields.push({ label: value, value: row.slice(column + 1).map(v => String(v ?? "").trim()).find(Boolean) ?? "" });
    if (["testcase", "testcases", "testscenario", "testscenarios"].includes(key)) {
      const number = Number(String(rows[index + 1]?.[column] ?? "").replaceAll(",", ""));
      if (String(rows[index + 1]?.[column] ?? "").trim() && Number.isFinite(number)) {
        if (key.startsWith("testscenario")) snapshot.scenarioCount = number;
        else snapshot.testcaseCount = number;
      }
    }
    if (column === 0 && key === "status") statusSection = true;
    else if (statusSection && column === 0) {
      if (key === "total") { statusSection = false; return; }
      const count = Number(String(row[1] ?? "").replaceAll(",", ""));
      if (!String(row[1] ?? "").trim() || !Number.isFinite(count)) { statusSection = false; return; }
      snapshot.statusTotals[stepStatus(value) === "Unknown" ? value : stepStatus(value)] = count;
    }
  }));
  return snapshot;
}
export function validateWorkbook(cases: TestCase[], source: WorkbookSource) {
  const issues: { code: string; message: string }[] = [];
  const statusTotals: Record<string, number> = {};
  const ids = new Set<string>();
  const steps = cases.flatMap(testCase => testCase.stepDefinitions ?? []);
  for (const testCase of cases) {
    const key = testCase.id.trim().toLowerCase();
    if (ids.has(key)) issues.push({ code: "duplicate-case", message: `Test Case ID ซ้ำ: ${testCase.id}` });
    ids.add(key);
    for (const issue of testCase.importIssues ?? []) issues.push({ code: "source-conflict", message: `${testCase.id}: ${issue}` });
    for (const step of testCase.stepDefinitions ?? []) {
      statusTotals[step.status] = (statusTotals[step.status] ?? 0) + 1;
      if (step.status === "Unknown") issues.push({ code: "unknown-status", message: `${testCase.id} / ${step.name}: สถานะไม่รู้จัก (${step.rawStatus})` });
      if (step.status === "Pass") {
        const results = (testCase.results ?? []).filter(result => result.stepId === step.id);
        if (!results.length || !results.some(result => result.evidence.some(evidence => evidence.mimeType.startsWith("image/")))) issues.push({ code: "pass-evidence", message: `${testCase.id} / ${step.name}: บันทึก Pass แต่ยังไม่มี Result พร้อมรูปหลักฐาน` });
      }
    }
    if (testCase.stepDefinitions?.length && !source.sheets.some(sheet => sheet.testCaseIds.includes(testCase.id) && sheet.kind !== "testcase")) issues.push({ code: "missing-reference", message: `${testCase.id}: ไม่พบแท็บรายละเอียดที่อ้างอิง` });
  }
  if (!source.sheetImport?.complete || source.sheetImport.refreshRequired) issues.push({ code: "incomplete-import", message: "ข้อมูล/รูปจาก Sheets ยังโหลดไม่ครบ หรือยังไม่ได้ยืนยันการโหลดครบ" });
  const comparisonCount = steps.length || cases.length;
  if (source.coverSnapshot?.testcaseCount !== undefined && source.coverSnapshot.testcaseCount !== comparisonCount) issues.push({ code: "cover-count", message: `Cover ระบุ ${source.coverSnapshot.testcaseCount} แต่ระบบอ่านได้ ${comparisonCount} ${steps.length ? "Steps" : "Test Cases"}` });
  for (const [status, expected] of Object.entries(source.coverSnapshot?.statusTotals ?? {})) {
    if (steps.length && expected !== (statusTotals[status] ?? 0)) issues.push({ code: "cover-status", message: `Cover: ${status} ${expected} · จาก Steps: ${statusTotals[status] ?? 0}` });
  }
  return { issues, caseCount: cases.length, stepCount: steps.length, statusTotals };
}
