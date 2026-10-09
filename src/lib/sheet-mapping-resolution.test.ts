import test from "node:test";
import assert from "node:assert/strict";
import { resolveSheetAssociations } from "./sheet-mapping-resolution";
import { registeredTestCases } from "./sheet-mapping-model";
import { workspaceCasesForRegister } from "./sheet-register-cases";
import { parseStoredResults, serializeStoredResults } from "./project-data";
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

test("a combined result tab is accessible from every referenced register case", () => {
  const result = resolveSheetAssociations([sheet(10, "TC01, TC02, TC03, TC04")],
    [testCase("TC01"), testCase("TC02"), testCase("TC03"), testCase("TC04"), testCase("TC05")], []);
  assert.deepEqual(result.associations.map(item => item.testCase.id), ["TC01", "TC02", "TC03", "TC04"]);
  assert.deepEqual(result.unmapped, []);
});

test("validated compact definition owners can access a tab even when omitted from its title", () => {
  const source = { ...sheet(10, "TC05, TC06", ["TC05", "TC06", "TC15"]), definitionCaseIds: ["TC05", "TC06", "TC15"] };
  const result = resolveSheetAssociations([source], [testCase("TC05"), testCase("TC06"), testCase("TC15")], []);
  assert.deepEqual(result.associations.map(item => item.testCase.id), ["TC05", "TC06", "TC15"]);
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

test("a combined tab with a missing register owner stays entirely unmapped until QA chooses", () => {
  const result = resolveSheetAssociations([sheet(10, "TC01, TC99")], [testCase("TC01")], []);
  assert.deepEqual(result.associations, []);
  assert.deepEqual(result.unmapped.map(item => item.name), ["TC01, TC99"]);
});

test("sheet-only imported placeholders cannot make an unknown tab look registered", () => {
  const placeholder = { ...testCase("TC99"), sourceSheetName: "RC TC99", sourceRow: 0 };
  const result = resolveSheetAssociations([sheet(10, "RC TC99")], [testCase("TC01"), placeholder], []);
  assert.deepEqual(result.associations, []);
  assert.deepEqual(result.unmapped.map(item => item.name), ["RC TC99"]);
});

test("case list excludes imported tab placeholders while retaining authored and registered cases", () => {
  const items = [testCase("TC01"), { ...testCase("Run A"), sourceSheetName: "Run A" }, { ...testCase("Web case"), sourceRow: 0, steps: "Login" }];
  assert.deepEqual(registeredTestCases(items).map(item => item.id), ["TC01", "Web case"]);
});

test("legacy sheet placeholders without a persisted marker are not register cases", () => {
  const legacy = { ...testCase("TC99"), sourceRow: 0, results: [{ id: "old", sourceSheetName: "RC TC99", status: "Pass" as const, actualResult: "Proof", apiResponse: "", log: "", createdAt: "", evidence: [] }] };
  assert.deepEqual(registeredTestCases([testCase("TC01"), legacy]).map(item => item.id), ["TC01"]);
});

test("legacy empty arbitrary-tab rows stay outside the testcase register", () => {
  assert.deepEqual(registeredTestCases([testCase("TC01"), { ...testCase("ชีต6"), sourceRow: 0 }]).map(item => item.id), ["TC01"]);
});

test("manual mapping exposes the preserved tab result and image on its target, without adding a case", () => {
  const target = testCase("TC01");
  const snapshot = { ...testCase("Run A"), sourceSheetName: "Run A", results: [{ id: "proof", sourceSheetName: "Run A", status: "Pass" as const, actualResult: "Complete result", apiResponse: "API", log: "Log", createdAt: "", evidence: [{ fileId: "img1", name: "Proof", mimeType: "image/png" }] }] };
  const { sourceSheetName: _source, ...databaseRow } = snapshot;
  void _source;
  const reopened = { ...databaseRow, ...parseStoredResults(serializeStoredResults(snapshot)) };
  assert.equal(reopened.sourceSheetName, "Run A");
  const output = workspaceCasesForRegister([target, reopened], [sheet(10, "Run A")], [mapping(10, "Run A", "TC01")]);
  assert.deepEqual(output.map(item => item.id), ["TC01"]);
  assert.equal(output[0].results?.[0].actualResult, "Complete result");
  assert.equal(output[0].results?.[0].evidence[0].fileId, "img1");
  assert.equal(target.results?.length, 0);
});
