import type { TestCase, TestResult } from "./types";
import { stepHeaderKey, stepHeaderColumns, parseStepTestCases } from "./step-testcases";
import { freeformTextFromCells } from "./sheet-detail";
import { readStepResultSnapshots, STEP_SNAPSHOT_START } from "./step-sheet-sync";

export const sheetColumn = (index: number) => {
  let value = index + 1, result = "";
  while (value > 0) { value--; result = String.fromCharCode(65 + value % 26) + result; value = Math.floor(value / 26); }
  return result;
};
const stepNumber = (name: string) => {
  const digits = name.trim().match(/^step\s*(\d+)\b/i)?.[1];
  return digits?.replace(/^0+(?=\d)/, "");
};
const resultColumnHeaders = (row: unknown[]) => row.some(cell => stepHeaderKey(cell) === "step") && !row.some(cell => /^step\s*\d+\b/i.test(String(cell ?? "").trim()));
export function parseStepSheetResults(rows: unknown[][], testCase: TestCase, sheetName: string): { results: TestResult[]; issues: string[]; representedCells: Set<string> } | null {
  if (!testCase.stepDefinitions?.length) return null;
  const ownedResults = readStepResultSnapshots(rows, testCase.id);
  const ownedStart = rows.findIndex(row => row[0] === STEP_SNAPSHOT_START);
  if (ownedStart >= 0) rows = rows.slice(0, ownedStart);
  const start = rows.findIndex(row => row.some(value => stepHeaderKey(value) === "resulttesting"));
  const headers = rows.slice(0, start < 0 ? rows.length : start).find(row => stepHeaderColumns(row)) ?? [];
  const detailSteps = parseStepTestCases(rows.slice(0, start < 0 ? rows.length : start), sheetName)?.flatMap(item => item.stepDefinitions ?? []) ?? [];
  const detailExtras = detailSteps.flatMap(step => step.sourceFields ?? []).filter(field => !field.mapped && field.value.trim());
  const extraResult = (fields: typeof detailExtras): TestResult => ({ id: `SHEET-IMPORT-${sheetName}-EXTRA-COLUMNS`, source: "sheets", sourceSheetName: sheetName, status: "Not Start", actualResult: "ข้อมูลเพิ่มเติมจากตาราง Step (ไม่ใช่ผลยืนยันสถานะการทดสอบ)", apiResponse: "", log: "", evidence: [], createdAt: "", sheetSections: [{ id: `${sheetName}:extra-columns`, title: "ข้อมูลเพิ่มเติมจากตาราง Step", kind: "fields", rows: fields.map(field => ({ row: Number(field.ref.match(/\d+$/)?.[0]), fields: [field] })) }] });
  const representedCells = new Set<string>();
  const definitionEnd = start < 0 ? rows.length : start + 1;
  rows.slice(0, definitionEnd).forEach((row, index) => row.forEach((_, column) => representedCells.add(`${sheetColumn(column)}${index + 1}`)));
  if (start < 0) return { results: [...(detailExtras.length ? [extraResult(detailExtras)] : []), ...ownedResults], issues: ["ไม่พบส่วน Result Testing ในแท็บรายละเอียด"], representedCells };
  const markers = rows.flatMap((row, index) => {
    if (index <= start) return [];
    const column = row.findIndex(cell => /^step\s*\d+\b/i.test(String(cell ?? "").trim()));
    if (column < 0) return [];
    return [{ row: index + 1, column, name: String(row[column]).trim(), description: String(row[column + 1] ?? "").trim(), expected: String(row[column + 2] ?? "").trim() }];
  });
  const issues: string[] = [];
  const sections = [...markers];
  if (rows.slice(start + 1, (markers[0]?.row ?? rows.length + 1) - 1).some(row => !resultColumnHeaders(row) && row.some(value => String(value ?? "").trim()))) {
    sections.unshift({ row: start + 2, column: -1, name: "ผลที่ยังไม่ผูก Step", description: "", expected: "" });
  }
  const results = sections.map((marker, index): TestResult => {
    const activeHeaders = rows.slice(start + 1, marker.row - 1).reverse().find(resultColumnHeaders) ?? headers;
    const endRow = (sections[index + 1]?.row ?? rows.length + 1) - 1;
    const namedSteps = testCase.stepDefinitions!.filter(step => stepHeaderKey(step.name) === stepHeaderKey(marker.name));
    const candidates = namedSteps.filter(step => (!marker.description || stepHeaderKey(step.description) === stepHeaderKey(marker.description))
      && (!marker.expected || stepHeaderKey(step.expected) === stepHeaderKey(marker.expected)));
    let step = candidates.length === 1 && (marker.description || marker.expected) ? candidates[0] : undefined;
    // Number fallback is scoped to this case and only applies when no exact
    // name exists. Never resolve a conflicting exact name or duplicate number.
    if (!step && !namedSteps.length) {
      const number = stepNumber(marker.name);
      const numberedSteps = number === undefined ? [] : testCase.stepDefinitions!.filter(item => stepNumber(item.name) === number);
      if (numberedSteps.length === 1) {
        step = numberedSteps[0];
        issues.push(`${marker.name}: จับคู่จากเลข Step ${number} → ${step.name} (ชื่อ/รายละเอียดต้นฉบับไม่ตรงกัน)`);
      }
    }
    if (!step) issues.push(`${marker.name}: ยังผูกผลกับ Step ไม่ได้ กรุณาตรวจชื่อ/รายละเอียดจากตารางหลัก`);
    const cells = rows.slice(marker.row - 1, endRow).flatMap((row, offset) => row.flatMap((value, column) => {
      if (resultColumnHeaders(row)) return [];
      // Omit definitions only when the selected Step already displays that value.
      if (!offset && marker.column >= 0 && column === marker.column) return [];
      if (!offset && step && ((column === marker.column + 1 && stepHeaderKey(marker.description) === stepHeaderKey(step.description)) || (column === marker.column + 2 && stepHeaderKey(marker.expected) === stepHeaderKey(step.expected)))) return [];
      return String(value ?? "").trim() ? [{ ref: `${sheetColumn(column)}${marker.row + offset}`, value: String(value), column }] : [];
    }));
    const text = freeformTextFromCells(cells);
    const detailMatches = detailSteps.filter(item => stepHeaderKey(item.name) === stepHeaderKey(marker.name) && (!marker.description || stepHeaderKey(item.description) === stepHeaderKey(marker.description)) && (!marker.expected || stepHeaderKey(item.expected) === stepHeaderKey(marker.expected)));
    const additionalFields = detailMatches.length === 1 ? (detailMatches[0].sourceFields ?? []).filter(field => !field.mapped && field.value.trim()) : [];
    const fields = cells.map(cell => {
      const column = cell.column;
      const headingField = marker.column < 0 ? "" : cell.ref === `${sheetColumn(marker.column + 1)}${marker.row}` ? "Description Step" : cell.ref === `${sheetColumn(marker.column + 2)}${marker.row}` ? "Expected Result" : "";
      return { ...cell, label: headingField || String(activeHeaders[column] ?? "").trim() || `คอลัมน์ ${cell.ref.replace(/\d+$/, "")}` };
    });
    if (fields.length || additionalFields.length) text.sheetSections = [{ id: `${sheetName}:step:${marker.row}`, title: marker.name, kind: "fields", rows: [...additionalFields.map(field => ({ row: Number(field.ref.match(/\d+$/)?.[0]), fields: [field] })), ...[...new Set(fields.map(field => Number(field.ref.match(/\d+$/)?.[0])))].map(row => ({ row, fields: fields.filter(field => Number(field.ref.match(/\d+$/)?.[0]) === row) }))] }];
    return { id: `SHEET-IMPORT-${sheetName}-STEP-${marker.row}`, source: "sheets", sourceSheetName: sheetName, stepId: step?.id, sourceRange: { startRow: marker.row, endRow }, status: step?.status === "Pass" || step?.status === "Failed" || step?.status === "Skip" ? step.status : testCase.status,
      ...text, actualResult: text.actualResult || `ผลจาก ${marker.name}`, evidence: [], createdAt: "" };
  });
  const displayed = new Set(results.flatMap(result => result.sheetSections?.flatMap(section => section.rows.flatMap(row => row.fields.map(field => field.ref))) ?? []));
  const remaining = detailExtras.filter(field => !displayed.has(field.ref));
  return { results: [...new Map([...results, ...(remaining.length ? [extraResult(remaining)] : []), ...ownedResults].map(result => [result.id, result])).values()], issues, representedCells };
}
