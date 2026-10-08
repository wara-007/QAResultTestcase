import type { TestCase, TestResult } from "./types";
import { parseStepTestCases, stepHeaderKey, stepColumnName } from "./step-testcases";

// Opt in only to a local API/Response/Log table. Other sheet layouts retain
// their existing parser, including Result Testing definition-style tables.
export function parseApiLogSheetResults(rows: unknown[][], testCase: TestCase, sheetName: string, cases: TestCase[] = [testCase]) {
  const isHeader = (row: unknown[]) => ["api", "response", "log"].every(key => row.some(cell => stepHeaderKey(cell) === key));
  const headerRow = rows.findIndex(isHeader);
  if (headerRow < 0) return null;
  const definitions = parseStepTestCases(rows.slice(0, headerRow), sheetName);
  const owners = definitions?.length ? definitions.map(item => cases.find(candidate => stepHeaderKey(candidate.id) === stepHeaderKey(item.id)) ?? item) : cases;
  const primary = owners[0]?.id ?? testCase.id;
  const issues: string[] = [];
  const results: TestResult[] = [];
  const representedCells = new Set<string>();
  rows.slice(0, headerRow + 1).forEach((row, index) => row.forEach((_, col) => representedCells.add(`${stepColumnName(col)}${index + 1}`)));
  const resultStart = rows.slice(0, headerRow).findIndex(row => {
    const populated = row.filter(cell => String(cell ?? "").trim());
    return populated.length === 1 && ["result", "resulttesting"].includes(stepHeaderKey(populated[0]));
  });
  const preamble = resultStart < 0 ? [] : rows.slice(resultStart + 1, headerRow).flatMap((row, offset) => {
    const rowNumber = resultStart + offset + 2;
    const fields = row.flatMap((value, column) => String(value ?? "").trim() && !/^step\s*\d+\b/i.test(String(value).trim()) ? [{ ref: `${stepColumnName(column)}${rowNumber}`, column, label: "ข้อมูลการทดสอบ", value: String(value) }] : []);
    return fields.length ? [{ row: rowNumber, fields }] : [];
  });
  if (preamble.length && stepHeaderKey(primary) === stepHeaderKey(testCase.id)) results.push({ id: `SHEET-IMPORT-${sheetName}-API-CONTEXT`, source: "sheets", sourceSheetName: sheetName, status: "Not Start", actualResult: "", apiResponse: "", log: "", evidence: [], createdAt: "", sheetSections: [{ id: `${sheetName}:api-context`, title: "ข้อมูลการทดสอบ", kind: "fields", rows: preamble }] });
  let headers = rows[headerRow];
  let current: TestResult | undefined;
  for (let index = headerRow + 1; index < rows.length; index++) {
    const row = rows[index];
    if (isHeader(row)) { headers = row; current = undefined; continue; }
    const apiColumn = headers.findIndex(cell => stepHeaderKey(cell) === "api");
    const markerColumn = row.findIndex(cell => /^step\s*\d+\b/i.test(String(cell ?? "").trim()));
    const marker = markerColumn >= 0 ? String(row[markerColumn]).trim() : "";
    const heading = marker || String(row[apiColumn] ?? "").trim();
    if (!row.some(cell => String(cell ?? "").trim())) { current = undefined; continue; }
    if (heading || !current) {
      const matches = marker ? owners.flatMap(owner => (owner.stepDefinitions ?? []).filter(step => stepHeaderKey(step.name) === stepHeaderKey(marker)).map(step => ({ owner, step }))) : [];
      const match = matches.length === 1 ? matches[0] : undefined;
      const ownerId = match?.owner.id ?? primary;
      current = { id: `SHEET-IMPORT-${sheetName}-API-${index + 1}`, source: "sheets", sourceSheetName: sheetName, stepId: match?.step.id,
        sourceRange: { startRow: index + 1, endRow: index + 1 }, status: match?.step.status === "Pass" || match?.step.status === "Failed" || match?.step.status === "Skip" ? match.step.status : "Not Start",
        actualResult: "", apiResponse: "", log: "", evidence: [], createdAt: "", sheetSections: [{ id: `${sheetName}:api:${index + 1}`, title: heading || "ข้อมูลผลการทดสอบ", kind: "fields", rows: [] }] };
      if (stepHeaderKey(ownerId) === stepHeaderKey(testCase.id)) {
        results.push(current);
        if (marker && !match) issues.push(`${marker}: ${matches.length > 1 ? "อ้างอิงหลาย Test Case" : "ไม่พบ Step ที่ตรงกัน"} กรุณาจับคู่ผลด้วยตนเอง`);
        if (!marker && owners.length > 1) issues.push(`${heading || "ผลการทดสอบ"}: อ้างอิงหลาย Test Case กรุณาจับคู่ผลด้วยตนเอง`);
      }
    }
    const fields = row.flatMap((value, column) => {
      if (column === markerColumn || !String(value ?? "").trim()) return [];
      const ref = `${stepColumnName(column)}${index + 1}`;
      representedCells.add(ref);
      return [{ ref, column, label: String(headers[column] ?? "").trim() || `คอลัมน์ ${stepColumnName(column)}`, value: String(value) }];
    });
    current!.sheetSections![0].rows.push({ row: index + 1, fields });
    current!.sourceRange!.endRow = index + 1;
  }
  return { results, issues, representedCells };
}
