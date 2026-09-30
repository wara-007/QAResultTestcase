import test from "node:test";
import assert from "node:assert/strict";
import {
  mappingUpsertPayload,
  projectSheetMappingFromRow,
  validateGoogleSheetId,
  workbookSheetFromGoogleProperties,
} from "./sheet-mapping-model";

test("preserves the numeric Google sheet id in workbook metadata", () => {
  assert.deepEqual(workbookSheetFromGoogleProperties({ sheetId: 42, title: "RC TC-18", index: 3, hidden: false }), {
    sheetId: 42,
    name: "RC TC-18",
    path: "42",
    order: 3,
    kind: "result",
    testCaseIds: ["TC-18"],
    imageCount: 0,
    hidden: false,
  });
});

test("maps a database row to the public mapping shape", () => {
  assert.deepEqual(projectSheetMappingFromRow({
    project_id: "project-1",
    spreadsheet_id: "spreadsheet-1",
    sheet_id: 42,
    sheet_name: "RC TC-18",
    testcase_key: "TC-18",
    mapped_by: "user-1",
    created_at: "2026-09-29T00:00:00.000Z",
    updated_at: "2026-09-29T01:00:00.000Z",
  }), {
    projectId: "project-1",
    spreadsheetId: "spreadsheet-1",
    sheetId: 42,
    sheetName: "RC TC-18",
    testcaseKey: "TC-18",
    mappedBy: "user-1",
    createdAt: "2026-09-29T00:00:00.000Z",
    updatedAt: "2026-09-29T01:00:00.000Z",
  });
});

test("accepts zero as a valid Google sheet id and rejects invalid values", () => {
  assert.equal(validateGoogleSheetId(0), 0);
  assert.equal(validateGoogleSheetId(42), 42);
  for (const invalid of [-1, 1.5, Number.NaN, "42", null]) {
    assert.throws(() => validateGoogleSheetId(invalid), /sheetId/);
  }
});

test("renaming a tab changes only its display name in the upsert payload", () => {
  const original = mappingUpsertPayload({ projectId: "project-1", spreadsheetId: "spreadsheet-1", sheetId: 42, sheetName: "Old", testcaseKey: "TC-18" }, "user-1");
  const renamed = mappingUpsertPayload({ projectId: "project-1", spreadsheetId: "spreadsheet-1", sheetId: 42, sheetName: "New", testcaseKey: "TC-18" }, "user-1");
  assert.deepEqual(
    { project_id: renamed.project_id, spreadsheet_id: renamed.spreadsheet_id, sheet_id: renamed.sheet_id },
    { project_id: original.project_id, spreadsheet_id: original.spreadsheet_id, sheet_id: original.sheet_id },
  );
  assert.equal(renamed.sheet_name, "New");
});
