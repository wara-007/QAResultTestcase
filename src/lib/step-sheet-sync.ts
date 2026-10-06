import { TEST_STATUSES, type TestCase, type TestResult } from "./types";
import { parseStepTestCases, stepHeaderColumns } from "./step-testcases";

const columnName = (column: number) => {
  let index = column + 1, name = "";
  while (index) { index--; name = String.fromCharCode(65 + index % 26) + name; index = Math.floor(index / 26); }
  return name;
};
export const STEP_SNAPSHOT_START = "QA Workspace Results v1";
const STEP_SNAPSHOT_END = "QA Workspace Results end";

export function buildStepSheetWritePlan(cases: TestCase[], rows: unknown[][]): { range: string; values: unknown[][] }[] {
  const sourceCases = parseStepTestCases(rows, "Testcase");
  if (!sourceCases) throw new Error("รูปแบบตาราง Step เปลี่ยน กรุณาโหลดจาก Sheets ใหม่ก่อนซิงค์");
  const writes: { range: string; values: unknown[][] }[] = [];
  const usedRows = new Set<number>();
  for (const testCase of cases.filter(item => item.stepDefinitions?.length)) {
    const owner = sourceCases.find(item => item.id === testCase.id);
    if (!owner) throw new Error(`Test Case ${testCase.id} เปลี่ยนหรือยังไม่มีใน Sheets กรุณาโหลดจาก Sheets ใหม่`);
    for (const step of testCase.stepDefinitions ?? []) {
      if (step.sourceSheetName !== "Testcase") throw new Error("ตำแหน่ง Step เปลี่ยน: ซิงค์ได้เฉพาะตาราง Testcase ไม่ใช่ Cover");
      if (usedRows.has(step.sourceRow) || !owner.stepDefinitions?.some(item => item.sourceRow === step.sourceRow && item.name === step.name && item.description === step.description && item.expected === step.expected && item.classification === step.classification)) throw new Error(`ตำแหน่งหรือรายละเอียด Step ${step.name} เปลี่ยน กรุณาโหลดจาก Sheets ใหม่`);
      usedRows.add(step.sourceRow);
      const header = rows.slice(0, step.sourceRow).reverse().find(row => stepHeaderColumns(row));
      const columns = header ? stepHeaderColumns(header)! : null;
      if (!columns) throw new Error("หัวตาราง Step เปลี่ยน");
      for (const field of ["status", "device", "environment", "appVersion", "resultReference", "executedBy", "executedDate", "remark"] as const) {
        const column = columns[field];
        if (column < 0 || String(rows[step.sourceRow - 1]?.[column] ?? "").startsWith("=")) continue;
        const value = field === "status" ? (({ "In Progress": "TESTING", "Blocked": "Block", "Not Start": "NotStart", "Unknown": step.rawStatus } as Record<string, string>)[step.status] ?? step.status) : step[field];
        writes.push({ range: `'${step.sourceSheetName.replaceAll("'", "''")}'!${columnName(column)}${step.sourceRow}`, values: [[value]] });
      }
    }
  }
  return writes;
}

export function stepResultSnapshotRows(testCase: TestCase): string[][] {
  const rows: string[][] = [[STEP_SNAPSHOT_START, testCase.id]];
  const append = (label: string, text: string) => {
    if (!text) { rows.push([label, ""]); return; }
    for (let start = 0; start < text.length; start += 49000) rows.push([label, text.slice(start, start + 49000)]);
  };
  for (const result of testCase.results ?? []) {
    if (result.source === "sheets" && !result.editedLocally) continue;
    rows.push(["QA Result", result.id, result.stepId ?? "", result.status, result.createdAt, result.testerName ?? "", result.sourceSheetName ?? "", result.source ?? "web"]);
    append("Actual result", result.actualResult);
    append("API response", result.apiResponse);
    append("Log", result.log);
    append("Evidence", JSON.stringify(result.evidence));
    append("QA metadata", JSON.stringify({ sheetSections: result.sheetSections, textHighlights: result.textHighlights, customFields: result.customFields }));
  }
  rows.push([STEP_SNAPSHOT_END, testCase.id]);
  if (rows.flat().some(value => value.length >= 50000)) throw new Error("ข้อมูลหัวข้อ Result ยาวเกินขนาดเซลล์ที่ Sheets รองรับ");
  return rows;
}

export function readStepResultSnapshots(rows: unknown[][], caseId: string): TestResult[] {
  let active = false;
  let result: TestResult | undefined;
  let results: TestResult[] = [], pending: TestResult[] = [];
  let evidence = "", metadata = "";
  const finish = () => {
    if (!result) return;
    try { const parsed = JSON.parse(evidence); if (Array.isArray(parsed)) result.evidence = parsed; } catch { /* Keep the Result even when evidence metadata is damaged. */ }
    try { const parsed = JSON.parse(metadata); if (parsed && typeof parsed === "object") { result.sheetSections = parsed.sheetSections; result.textHighlights = parsed.textHighlights; result.customFields = parsed.customFields; } } catch { /* Keep text independently of metadata. */ }
    pending.push(result); result = undefined; evidence = metadata = "";
  };
  for (const row of rows) {
    const value = (column: number) => String(row[column] ?? "");
    if (value(0) === STEP_SNAPSHOT_START) { active = value(1) === caseId; pending = []; result = undefined; evidence = metadata = ""; continue; }
    if (!active) continue;
    if (value(0) === STEP_SNAPSHOT_END) { finish(); results = pending; active = false; continue; }
    if (value(0) === "QA Result") {
      finish();
      result = { id: value(1), stepId: value(2) || undefined, status: TEST_STATUSES.includes(value(3) as TestResult["status"]) ? value(3) as TestResult["status"] : "Not Start", createdAt: value(4), testerName: value(5), sourceSheetName: value(6) || undefined, source: value(7) === "sheets" ? "sheets" : "web", editedLocally: true, actualResult: "", apiResponse: "", log: "", evidence: [] };
    } else if (result) {
      if (value(0) === "Actual result") result.actualResult += value(1);
      if (value(0) === "API response") result.apiResponse += value(1);
      if (value(0) === "Log") result.log += value(1);
      if (value(0) === "Evidence") evidence += value(1);
      if (value(0) === "QA metadata") metadata += value(1);
    }
  }
  return results;
}
