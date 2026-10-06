import assert from "node:assert/strict";
import test from "node:test";
import { casesFromRows } from "./testcase-rows";
import { mergeWorkspaceAndGoogleCases } from "./sync/workspace-merge";
import { parseStoredResults, serializeStoredResults } from "./project-data";
import { needsStepTemplateRefresh } from "./step-reconciliation";

const makeCase = () => casesFromRows([["Test Case (TC ID)", "Step#", "Description Step", "Expected Result", "Status"], ["ENQ_01_TC_01", "step 01", "Landing", "Correct", "NotStart"]])[0];
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
