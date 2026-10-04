import test from "node:test";
import assert from "node:assert/strict";
import { resolveSheetAssociations } from "./sheet-mapping-resolution";
import type { ProjectSheetMapping, TestCase, WorkbookSheet } from "./types";

const testCase = (id: string): TestCase => ({
  id,
  sourceRow: 1,
  name: id,
  platform: "",
  condition: "",
  scenario: "",
  steps: "",
  expected: "",
  testData: "",
  status: "Not Start",
  device: "",
  appVersion: "",
  environment: "",
  resultReference: "",
  executedBy: "",
  executedDate: "",
  executedTime: "",
  remark: "",
  evidence: [],
  results: [],
  defects: [],
});

const sheet = (sheetId: number | undefined, name: string, inferred: string[] = []): WorkbookSheet => ({
  sheetId,
  name,
  path: sheetId == null ? name : String(sheetId),
  order: sheetId ?? 0,
  kind: "result",
  testCaseIds: inferred,
  imageCount: 0,
  hidden: false,
});

const mapping = (sheetId: number, sheetName: string, testcaseKey: string): ProjectSheetMapping => ({
  projectId: "project-1",
  spreadsheetId: "spreadsheet-1",
  sheetId,
  sheetName,
  testcaseKey,
  mappedBy: "user-1",
  createdAt: "2026-09-29T00:00:00.000Z",
  updatedAt: "2026-09-29T00:00:00.000Z",
});

test("a persisted mapping wins over automatic inference", () => {
  const result = resolveSheetAssociations(
    [sheet(10, "RC TC-01", ["TC-01"])],
    [testCase("TC-01"), testCase("TC-02")],
    [mapping(10, "RC TC-01", "TC-02")],
  );
  assert.deepEqual(result.associations.map((item) => [item.sheet.name, item.testCase.id, item.source]), [["RC TC-01", "TC-02", "manual"]]);
  assert.deepEqual(result.unmapped, []);
});

test("a renamed Google tab keeps its mapping by stable sheet id", () => {
  const result = resolveSheetAssociations(
    [sheet(10, "Renamed result tab")],
    [testCase("TC-02")],
    [mapping(10, "Old result tab", "TC-02")],
  );
  assert.equal(result.associations[0]?.sheet.name, "Renamed result tab");
  assert.equal(result.associations[0]?.testCase.id, "TC-02");
});

test("two distinct tabs can be mapped to the same Test Case", () => {
  const result = resolveSheetAssociations(
    [sheet(10, "Run A"), sheet(11, "Run B")],
    [testCase("TC-02")],
    [mapping(10, "Run A", "TC-02"), mapping(11, "Run B", "TC-02")],
  );
  assert.deepEqual(result.associations.map((item) => item.sheet.sheetId), [10, 11]);
});

test("removing a mapping restores automatic inference", () => {
  const result = resolveSheetAssociations([sheet(10, "RC TC-01", ["TC-01"])], [testCase("TC-01")], []);
  assert.equal(result.associations[0]?.source, "automatic");
  assert.equal(result.associations[0]?.testCase.id, "TC-01");
});

test("a mapping to a missing Test Case is invalid and must not fall back to inference", () => {
  const result = resolveSheetAssociations(
    [sheet(10, "RC TC-01", ["TC-01"])],
    [testCase("TC-01")],
    [mapping(10, "RC TC-01", "TC-99")],
  );
  assert.deepEqual(result.associations, []);
  assert.deepEqual(result.unmapped, []);
  assert.equal(result.invalidMappings[0]?.mapping.testcaseKey, "TC-99");
});

test("an Excel tab without a stable Google sheet id stays unmapped when its mutable name is insufficient", () => {
  const result = resolveSheetAssociations([sheet(undefined, "Regression evidence")], [testCase("TC-01")], []);
  assert.equal(result.unmapped[0]?.name, "Regression evidence");
  assert.deepEqual(result.associations, []);
});

test("a summary tab does not auto-map from Test Case references found only in its cells", () => {
  const defected = { ...sheet(12, "Defected", ["TC-01", "TC-02"]), kind: "defect" as const };
  const result = resolveSheetAssociations([defected], [testCase("TC-01"), testCase("TC-02")], []);
  assert.deepEqual(result.associations, []);
  assert.equal(result.unmapped[0]?.name, "Defected");
});

test("non-TC IDs map from their tab names without matching unrelated IDs in cell references", () => {
  const result = resolveSheetAssociations([sheet(1, "True_01"), sheet(2, "SW_21"), sheet(3, "RC Dtac_02"), sheet(4, "True_011")], [testCase("True_01"), testCase("SW_21"), testCase("Dtac_02")], []);
  assert.deepEqual(result.associations.map(a => [a.sheet.name, a.testCase.id]), [["True_01", "True_01"], ["SW_21", "SW_21"], ["RC Dtac_02", "Dtac_02"]]);
  assert.deepEqual(result.unmapped.map(s => s.name), ["True_011"]);
});
