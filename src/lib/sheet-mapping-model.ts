import type { ProjectSheetMapping, WorkbookSheet, WorkbookSheetKind } from "./types";

const normalizeSheetName = (value: string) => value.toLowerCase().replace(/[\n\r*._()/-]+/g, " ").replace(/\s+/g, " ").trim();

export const testCaseIdsFromSheetText = (name: string) => Array.from(name.matchAll(/\b(TC|DEF)[\s:_-]*(\d+)/gi), (match) => `${match[1].toUpperCase()}-${match[2].padStart(2, "0")}`)
  .filter((value, index, values) => values.indexOf(value) === index);

export function workbookSheetKind(name: string): WorkbookSheetKind {
  const value = normalizeSheetName(name);
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
  const name = properties.title?.trim() || `Sheet ${fallbackOrder + 1}`;
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
