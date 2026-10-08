import assert from "node:assert/strict";
import test from "node:test";
import { casesFromRows } from "./testcase-rows";
import { mergeWorkspaceAndGoogleCases } from "./sync/workspace-merge";
import { parseStoredResults, serializeStoredResults } from "./project-data";
import { needsStepTemplateRefresh } from "./step-reconciliation";
import { mergeCaseChoices } from "./sync/client-conflicts";
import { workbookSheetFromGoogleProperties } from "./sheet-mapping-model";

const makeCase = () => casesFromRows([["Test Case (TC ID)", "Step#", "Description Step", "Expected Result", "Status"], ["ENQ_01_TC_01", "step 01", "Landing", "Correct", "NotStart"]])[0];
test("cached compact results filtered to one proof must be refreshed for every shared owner", () => {
  const sheet = workbookSheetFromGoogleProperties({ title: "TC05, TC06", sheetId: 1 });
  const source = { fileName: "compact.xlsx", buffer: new ArrayBuffer(0), bufferLoaded: false, sheetName: "Testcase", sheetPath: "", columns: {}, sheets: [sheet] };
  const cases = ["TC05", "TC06"].map(id => ({ ...makeCase(), id, results: [{ id: `SHEET-IMPORT-${sheet.name}-ROW-10`, sharedSheetMappingVersion: 3 as const, sourceSheetName: sheet.name, status: "Not Start" as const, actualResult: "old filtered proof", apiResponse: "", log: "", evidence: [], createdAt: "" }] }));
  assert.equal(needsStepTemplateRefresh(cases, source), true);
});
test("a loaded combined tab cannot hide missing results of its other register cases", () => {
  const first = { ...makeCase(), id: "TC01" };
  const second = { ...makeCase(), id: "TC02" };
  const sheet = workbookSheetFromGoogleProperties({ title: "TC01, TC02", sheetId: 1 });
  const source = { fileName: "shared.xlsx", buffer: new ArrayBuffer(0), bufferLoaded: false, sheetName: "Testcase", sheetPath: "", columns: {}, sheets: [sheet] };
  first.results = [{ id: "SHEET-IMPORT-TC01, TC02-API-2", sharedSheetMappingVersion: 3, sourceSheetName: sheet.name, status: "Not Start", actualResult: "shared result", apiResponse: "", log: "", evidence: [], createdAt: "" }];
  assert.equal(needsStepTemplateRefresh([first, second], source), true);
  second.results = [...first.results];
  assert.equal(needsStepTemplateRefresh([first, second], source), false);
  second.results = [{ ...first.results[0], sharedSheetMappingVersion: undefined }];
  assert.equal(needsStepTemplateRefresh([first, second], source), true);
  source.sheets = [workbookSheetFromGoogleProperties({ title: "TC02", sheetId: 1 })];
  second.results = [];
  assert.equal(needsStepTemplateRefresh([first, second], source), false);
});
test("refresh does not assign importer to Sheet Skip with no EXECUTED BY", () => {
  const incoming = makeCase(); incoming.status = "Skip"; incoming.executedBy = "";
  incoming.stepDefinitions![0].status = "Skip";
  incoming.stepDefinitions![0].executedBy = "";
  const local = { ...incoming, persistedLocally: true, executedBy: "wara pp" };
  assert.equal(mergeWorkspaceAndGoogleCases([local], [incoming], "wara pp").cases[0].executedBy, "");
});
test("API matrix refresh replaces legacy whole-tab preview even without Step definitions", () => {
  const local = makeCase(); delete local.stepDefinitions;
  local.results = [{ id: "SHEET-IMPORT-TC01", source: "sheets", sourceSheetName: "TC01", status: "Not Start", actualResult: "old entire tab", apiResponse: "", log: "", evidence: [], createdAt: "" }];
  const fresh = { ...local, results: [{ ...local.results[0], id: "SHEET-IMPORT-TC01-API-10", sourceRange: { startRow: 10, endRow: 10 }, actualResult: "new row" }] };
  assert.equal(mergeWorkspaceAndGoogleCases([local], [fresh], "QA").cases[0].results!.length, 1);
  local.results[0].editedLocally = true;
  assert.equal(mergeWorkspaceAndGoogleCases([local], [fresh], "QA").cases[0].results!.length, 2);
});
test("default import conflict choices do not undo refreshed Steps and imported Results", () => {
  const local = makeCase();
  const incoming = makeCase();
  incoming.stepDefinitions!.push({ ...incoming.stepDefinitions![0], id: "Testcase:3", name: "step 02" });
  const refreshed = mergeWorkspaceAndGoogleCases([local], [incoming], "QA").cases;
  const selected = mergeCaseChoices([local], refreshed, {});
  assert.equal(mergeWorkspaceAndGoogleCases(selected, refreshed, "QA").cases[0].stepDefinitions!.length, 2);
});
test("refresh updates imported text but retains QA Step mapping and its history", () => {
  const local = makeCase();
  const result = { id: "SHEET-IMPORT-ENQ-STEP-19", sourceSheetName: "ENQ", status: "Pass" as const, actualResult: "Old", apiResponse: "", log: "", evidence: [], createdAt: "", stepId: "Testcase:2", stepMappingHistory: [{ fromStepId: null, toStepId: "Testcase:2", by: "QA", at: "2026-10-06T10:00:00Z" }] };
  local.results = [result];
  const incoming = makeCase();
  incoming.results = [{ ...result, actualResult: "Updated", stepId: undefined, stepMappingHistory: undefined }];
  const merged = mergeWorkspaceAndGoogleCases([local], [incoming], "QA").cases[0].results![0];
  assert.equal(merged.stepId, "Testcase:2");
  assert.equal(merged.actualResult, "Updated");
  assert.deepEqual((merged as typeof result).stepMappingHistory, result.stepMappingHistory);
  const reopened = parseStoredResults(serializeStoredResults({ ...local, results: [merged] }));
  assert.equal(reopened.results[0].stepId, "Testcase:2");
  assert.deepEqual(reopened.results[0].stepMappingHistory, result.stepMappingHistory);
  local.results = [{ ...result, stepId: undefined, stepMappingHistory: [...result.stepMappingHistory, { fromStepId: "Testcase:2", toStepId: null, by: "QA", at: "2026-10-06T11:00:00Z" }] }];
  incoming.results = [result];
  assert.equal(mergeWorkspaceAndGoogleCases([local], [incoming], "QA").cases[0].results![0].stepId, undefined);
});
test("old Step definitions without source columns trigger refresh instead of reusing stale mapping", () => {
  const stored = makeCase();
  delete stored.stepDefinitions![0].sourceFields;
  assert.equal(needsStepTemplateRefresh([stored], null), true);
  const fresh = makeCase();
  assert.equal(needsStepTemplateRefresh([fresh], null), false);
});
test("a resolved number fallback replaces its stale unassigned import warning only", () => {
  const stored = makeCase();
  stored.importIssues = ["step 02 FN: ยังผูกผลกับ Step ไม่ได้ กรุณาตรวจชื่อ/รายละเอียดจากตารางหลัก", "step 03 FN: ยังผูกผลกับ Step ไม่ได้ กรุณาตรวจชื่อ/รายละเอียดจากตารางหลัก"];
  const incoming = makeCase();
  incoming.importIssues = ["step 02 FN: จับคู่จากเลข Step 2 → step 02 support (ชื่อ/รายละเอียดต้นฉบับไม่ตรงกัน)"];
  const merged = mergeWorkspaceAndGoogleCases([stored], [incoming], "QA").cases[0];
  assert.ok(!merged.importIssues?.some(issue => issue.startsWith("step 02 FN:") && issue.includes("ยังผูกผล")));
  assert.ok(merged.importIssues?.some(issue => issue.startsWith("step 03 FN:")));
  assert.ok(merged.importIssues?.some(issue => issue.includes("จับคู่จากเลข Step")));
});
test("stored execution restores Step definitions and Result ownership after reopen", () => {
  const original = makeCase();
  original.results = [{ id: "web-result", stepId: "Testcase:2", status: "Pass", actualResult: "Passed", apiResponse: "", log: "", evidence: [], createdAt: "" }];
  const stored = parseStoredResults(serializeStoredResults(original));
  assert.deepEqual(stored.stepDefinitions, original.stepDefinitions);
  assert.equal(stored.results[0].stepId, "Testcase:2");
});
test("reimport retains edited Step and web Result but surfaces conflicting source definition", () => {
  const stored = makeCase();
  stored.persistedLocally = true;
  stored.stepDefinitions![0].status = "Pass";
  stored.results = [{ id: "web-result", stepId: "Testcase:2", status: "Pass", actualResult: "Local result", apiResponse: "", log: "", evidence: [], createdAt: "" }];
  const incoming = makeCase();
  incoming.stepDefinitions![0].description = "Changed source definition";
  const merged = mergeWorkspaceAndGoogleCases([stored], [incoming], "QA").cases[0];
  assert.equal(merged.results?.[0].actualResult, "Local result");
  assert.equal(merged.stepDefinitions?.[0].status, "Pass");
  assert.ok(merged.importIssues?.some(issue => issue.includes("Changed source definition")));
});

test("refresh replaces the old whole-tab automatic preview without duplicating definitions or losing QA edits", () => {
  const local = makeCase();
  local.results = [{ id: "SHEET-IMPORT-ENQ_01_TC_01", source: "sheets", sourceSheetName: local.id, status: "In Progress", actualResult: "Old entire tab including definitions", apiResponse: "", log: "", evidence: [], createdAt: "" }];
  const incoming = makeCase();
  incoming.results = [{ id: "SHEET-IMPORT-ENQ_01_TC_01-STEP-19", source: "sheets", sourceSheetName: local.id, stepId: "Testcase:2", sourceRange: { startRow: 19, endRow: 42 }, status: "Pass", actualResult: "Step result", apiResponse: "", log: "", evidence: [], createdAt: "" }];
  assert.equal(mergeWorkspaceAndGoogleCases([local], [incoming], "QA").cases[0].results?.length, 1);
  local.results[0].editedLocally = true;
  assert.equal(mergeWorkspaceAndGoogleCases([local], [incoming], "QA").cases[0].results?.length, 2);
});
