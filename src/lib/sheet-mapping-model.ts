import type { ProjectSheetMapping, TestCase, WorkbookSheet, WorkbookSheetKind } from "./types";

const normalizeSheetName = (value: string) => value.toLowerCase().replace(/[\n\r*._()/-]+/g, " ").replace(/\s+/g, " ").trim();

export function isProjectSummarySheet(name: string): boolean {
  return /^(?:cover(?: page)?|summary(?: page)?|สรุป(?:ผล)?)$/.test(normalizeSheetName(name));
}

/** Sheet-only snapshots are retained for preview, not promoted into the register. */
export function registeredTestCases(cases: readonly TestCase[]) {
  return cases.filter(item => {
    const legacySnapshot = item.remark.startsWith("นำเข้าจาก tab ") || (
      !item.steps.trim() && !item.expected.trim() && !item.sourceFields?.length && !item.stepDefinitions?.length && item.sourceRow === 0
      && (item.results?.some(result => result.sourceSheetName) || !/(?:^|[\s_-])TC[\s_-]*\d+$/i.test(item.id))
    );
    return !item.sourceSheetName && !legacySnapshot && !isProjectSummarySheet(item.id);
  });
}

export function automaticSheetCaseIds(name: string, cases: readonly TestCase[], definitionIds: readonly string[] = []) {
  const register = registeredTestCases(cases);
  const key = (value: string) => value.toUpperCase().replace(/[\s:_-]+/g, "");
  const named = testCaseIdsMatchingSheetName(name, register);
  // Do not silently attach a mixed TC01, TC99 tab to TC01 alone.
  const references = testCaseIdsFromSheetText(name).filter(id => !named.some(match => key(match).endsWith(key(id))));
  const owners = [...new Set([...named, ...references, ...definitionIds])];
  const matched = owners.map(id => register.filter(item => key(item.id) === key(id)));
  return matched.every(items => items.length === 1) ? [...new Set(matched.flatMap(items => items.map(item => item.id)))] : [];
}

export const testCaseIdsFromSheetText = (name: string) => Array.from(name.matchAll(/\b(TC|DEF)[\s:_-]*(\d+)/gi), (match) => `${match[1].toUpperCase()}-${match[2].padStart(2, "0")}`)
  .filter((value, index, values) => values.indexOf(value) === index);

/** Only recognize arbitrary prefixes when they exist in the testcase register. */
export function testCaseIdsMatchingSheetName(name: string, cases: readonly { id: string }[]) {
  const matching = cases.filter(testCase => {
    const tokens = testCase.id.trim().split(/[\s:_-]+/).map(token => token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    return new RegExp(`(?:^|[^\\p{L}\\p{N}])${tokens.join("[\\s:_-]*")}(?=$|[^\\p{L}\\p{N}])`, "iu").test(name);
  }).map(testCase => testCase.id);
  return matching.length ? matching : testCaseIdsFromSheetText(name);
}

export function workbookSheetKind(name: string): WorkbookSheetKind {
  const value = normalizeSheetName(name);
  if (isProjectSummarySheet(name)) return "summary";
  if (value === "testcase" || value.includes("test case")) return "testcase";
  if (value.includes("summary")) return "summary";
  if (value.includes("defect")) return /def[\s:_-]*\d+/i.test(name) || value.startsWith("rc") ? "result" : "defect";
  if (value === "data test" || value.includes("test data")) return "data";
  if (/\b(?:tc|def)[\s:_-]*\d+/i.test(name) || value.startsWith("rc")) return "result";
  return "other";
}

export function validateGoogleSheetId(value: unknown) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) throw new Error("sheetId ต้องเป็นเลขจำนวนเต็มตั้งแต่ 0 ขึ้นไป");
  return value;
}

export function workbookSheetFromGoogleProperties(properties: { sheetId?: number | null; title?: string | null; index?: number | null; hidden?: boolean | null }, fallbackOrder = 0): WorkbookSheet {
  const sheetId = validateGoogleSheetId(properties.sheetId);
  const name = properties.title || `Sheet ${fallbackOrder + 1}`;
  return {
    sheetId,
    name,
    path: String(sheetId),
    order: properties.index ?? fallbackOrder,
    kind: workbookSheetKind(name),
    testCaseIds: testCaseIdsFromSheetText(name),
    imageCount: 0,
    hidden: properties.hidden ?? false,
  };
}

export type ProjectSheetMappingRow = {
  project_id: string;
  spreadsheet_id: string;
  sheet_id: number;
  sheet_name: string;
  testcase_key: string;
  mapped_by: string;
  created_at: string;
  updated_at: string;
};

export function projectSheetMappingFromRow(row: ProjectSheetMappingRow): ProjectSheetMapping {
  return {
    projectId: row.project_id,
    spreadsheetId: row.spreadsheet_id,
    sheetId: validateGoogleSheetId(row.sheet_id),
    sheetName: row.sheet_name,
    testcaseKey: row.testcase_key,
    mappedBy: row.mapped_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type SaveSheetMappingInput = Pick<ProjectSheetMapping, "projectId" | "spreadsheetId" | "sheetId" | "sheetName" | "testcaseKey">;

export function mappingUpsertPayload(input: SaveSheetMappingInput, userId: string) {
  return {
    project_id: input.projectId,
    spreadsheet_id: input.spreadsheetId.trim(),
    sheet_id: validateGoogleSheetId(input.sheetId),
    sheet_name: input.sheetName.trim(),
    testcase_key: input.testcaseKey.trim(),
    mapped_by: userId,
    updated_at: new Date().toISOString(),
  };
}
