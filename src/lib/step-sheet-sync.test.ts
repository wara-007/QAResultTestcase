import assert from "node:assert/strict";
import test from "node:test";
import { casesFromRows } from "./testcase-rows";
import { buildStepSheetWritePlan, stepResultSnapshotRows, readStepResultSnapshots } from "./step-sheet-sync";

const rows = [["Test Case (TC ID)", "Step#", "Description Step", "Expected Result", "Status", "Device", "Env"], ["ENQ_01_TC_01", "step 08", "BE", "API", "TESTING", "iOS", "UAT"], ["", "step 08", "Legacy", "API", "Skip", "Android", "UAT"]];
test("Step sync changes only mapped execution cells and never replaces headers or merged definitions", () => {
  const testCase = casesFromRows(rows)[0];
  testCase.stepDefinitions![0].status = "Pass";
  testCase.stepDefinitions![1].status = "Blocked";
  const writes = buildStepSheetWritePlan([testCase], rows);
  assert.deepEqual(writes.map(write => write.range), ["'Testcase'!E2", "'Testcase'!F2", "'Testcase'!G2", "'Testcase'!E3", "'Testcase'!F3", "'Testcase'!G3"]);
  assert.deepEqual(writes.filter(write => write.range.startsWith("'Testcase'!E")).map(write => write.values), [[["Pass"]], [["Block"]]]);
});
test("sync rejects stale row ownership and leaves formula cells untouched", () => {
  const testCase = casesFromRows(rows)[0];
  const changed = rows.map(row => [...row]);
  changed[1][0] = "ANOTHER_TC";
  assert.throws(() => buildStepSheetWritePlan([testCase], changed), /เปลี่ยน/);
  const changedDefinition = rows.map(row => [...row]);
  changedDefinition[1][2] = "Replacement procedure";
  assert.throws(() => buildStepSheetWritePlan([testCase], changedDefinition), /เปลี่ยน/);
  const formulas = rows.map(row => [...row]);
  formulas[1][4] = '=IF(A2="","","TESTING")';
  assert.ok(!buildStepSheetWritePlan([testCase], formulas).some(write => write.range === "'Testcase'!E2"));
});
test("owned result snapshots preserve long text, Step ownership and evidence and newest snapshot wins", () => {
  const testCase = casesFromRows(rows)[0];
  testCase.results = [{ id: "web-result", source: "web", stepId: "Testcase:2", status: "Pass", actualResult: "Correct", apiResponse: "x".repeat(70000), log: "log", evidence: [{ fileId: "image", mimeType: "image/png", name: "proof" }], createdAt: "2026-10-06" }];
  const first = stepResultSnapshotRows(testCase);
  assert.ok(first.flat().every(value => value.length < 50000));
  testCase.results[0].actualResult = "Edited";
  const parsed = readStepResultSnapshots([...first, ...stepResultSnapshotRows(testCase)], testCase.id);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].actualResult, "Edited");
  assert.equal(parsed[0].apiResponse.length, 70000);
  assert.equal(parsed[0].stepId, "Testcase:2");
  assert.equal(parsed[0].evidence[0].fileId, "image");
});
