import type { TestCase, TestResult } from "./types";
import { stepColumnName, stepHeaderKey } from "./step-testcases";

// A narrow opt-in: a testcase register with Test Steps, followed by a
// standalone Result heading. References elsewhere must not become owners.
function compactDefinition(rows: unknown[][]) {
  const start = rows.findIndex(row => row.filter(value => String(value ?? "").trim()).length === 1 && row.some(value => stepHeaderKey(value) === "result"));
  if (start < 0) return null;
  const headerIndex = rows.slice(0, start).findIndex(row => row.some(value => ["testcaseno", "testcaseid"].includes(stepHeaderKey(value))) && row.some(value => stepHeaderKey(value) === "teststeps") && row.some(value => stepHeaderKey(value) === "expectedresult"));
  if (headerIndex < 0) return null;
  const headers = rows[headerIndex];
  const idColumn = headers.findIndex(value => ["testcaseno", "testcaseid"].includes(stepHeaderKey(value)));
  const definitions = rows.slice(headerIndex + 1, start).filter(row => String(row[idColumn] ?? "").trim());
  return { start, headers, definitions, idColumn };
}

export function compactResultCaseIds(rows: unknown[][], cases: readonly { id: string }[]) {
  const definition = compactDefinition(rows);
  if (!definition) return [];
  return cases.filter(item => definition.definitions.some(row => stepHeaderKey(row[definition.idColumn]) === stepHeaderKey(item.id))).map(item => item.id);
}

export function parseCompactSheetResults(rows: unknown[][], testCase: TestCase, sheetName: string, cases: TestCase[]) {
  const definition = compactDefinition(rows);
  if (!definition) return null;
  const { start, headers, definitions } = definition;
  const owners = compactResultCaseIds(rows, cases);
  const width = Math.max(headers.length, ...definitions.map(row => row.length));
  const table = { headers: Array.from({ length: width }, (_, column) => String(headers[column] ?? "")), rows: definitions.map(row => Array.from({ length: width }, (_, column) => String(row[column] ?? ""))) };
  const populatedRows = rows.flatMap((row, index) => index > start && row.some(value => String(value ?? "").trim()) ? [index] : []);
  const results: TestResult[] = [];
  const representedCells = new Set<string>();
  rows.slice(0, start + 1).forEach((row, index) => row.forEach((_, column) => representedCells.add(`${stepColumnName(column)}${index + 1}`)));
  for (const [position, index] of populatedRows.entries()) {
    const row = rows[index];
    const title = String(row[0] ?? "").trim() || "ผลการทดสอบ";
    // The complete Result section belongs to the shared source tab. Similar
    // Test Steps are not an instruction to hide other proof rows.
    const resultOwners = owners;
    if (!resultOwners.includes(testCase.id)) continue;
    const fields = row.flatMap((value, column) => {
      if ((column === 0 && row.length > 1) || !String(value ?? "").trim()) return [];
      const ref = `${stepColumnName(column)}${index + 1}`;
      representedCells.add(ref);
      return [{ ref, column, label: column <= 1 ? "ผลการทดสอบ" : `คอลัมน์ ${stepColumnName(column)}`, value: String(value) }];
    });
    results.push({ id: `SHEET-IMPORT-${sheetName}-ROW-${index + 1}`, source: "sheets", sourceSheetName: sheetName, sourceRange: { startRow: index + 1, endRow: (populatedRows[position + 1] ?? rows.length) }, sharedSheetMappingVersion: 4, status: "Not Start", actualResult: "", apiResponse: "", log: "", evidence: [], createdAt: "", sheetSections: [{ id: `${sheetName}:row:${index + 1}`, title: resultOwners.length > 1 ? `${title} · ผลร่วม: ${resultOwners.join(", ")}` : title, kind: "fields", rows: [{ row: index + 1, fields }] }], ...(results.length === 0 ? { sheetDefinitionTable: table } : {}) });
  }
  return { results, issues: [] as string[], representedCells };
}
