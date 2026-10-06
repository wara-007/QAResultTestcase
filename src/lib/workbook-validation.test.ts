import assert from "node:assert/strict";
import test from "node:test";
import { casesFromRows } from "./testcase-rows";
import { parseCoverSnapshot, validateWorkbook } from "./workbook-validation";
import type { WorkbookSource } from "./types";

const makeCase = () => casesFromRows([["Test Case (TC ID)", "Step#", "Description Step", "Expected Result", "Status"], ["ENQ_01_TC_01", "step 01", "Landing", "Correct", "Pass"], ["", "step 02", "Coin", "Correct", "Block"]])[0];
const source: WorkbookSource = { fileName: "template", buffer: new ArrayBuffer(0), bufferLoaded: false, sheetName: "Testcase", sheetPath: "", columns: {}, sheets: [] };
test("Cover snapshot counts are compared with Steps for the Step template, not collapsed case count", () => {
  const cover = parseCoverSnapshot([["Cover Page"], ["System Name:", "Example"], ["", "", "Test Scenarios", "", "Test Case"], ["", "", "1", "", "2"], ["Status", "Progress"], ["Pass", "1"], ["Block", "1"], ["Total", "2"]], "Cover");
  assert.equal(cover.testcaseCount, 2);
  assert.deepEqual(cover.fields.find(field => field.label === "System Name:"), { label: "System Name:", value: "Example" });
  const report = validateWorkbook([makeCase()], { ...source, coverSnapshot: cover });
  assert.equal(report.caseCount, 1);
  assert.equal(report.stepCount, 2);
  assert.ok(!report.issues.some(issue => issue.code === "cover-count"));
  assert.ok(report.issues.some(issue => issue.code === "pass-evidence"));
  assert.ok(report.issues.some(issue => issue.code === "incomplete-import"));
});
test("unknown status, conflicting totals and duplicate case IDs are reported independently of QA status", () => {
  const testCase = makeCase();
  testCase.stepDefinitions![1].status = "Unknown";
  testCase.stepDefinitions![1].rawStatus = "Custom";
  const report = validateWorkbook([testCase, testCase], { ...source, coverSnapshot: parseCoverSnapshot([["Test Case"], ["14"]], "Cover") });
  assert.ok(report.issues.some(issue => issue.code === "duplicate-case"));
  assert.ok(report.issues.some(issue => issue.code === "unknown-status"));
  assert.ok(report.issues.some(issue => issue.code === "cover-count"));
  assert.equal(testCase.status, "In Progress");
});
