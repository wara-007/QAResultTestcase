import test from "node:test";
import assert from "node:assert/strict";
import { stepResultTitle } from "../components/test-case-steps";
import { casesFromRows } from "./testcase-rows";
import { reconcileStepCases } from "./step-reconciliation";
import type { TestResult } from "./types";

const testCase = () => casesFromRows([["Test Case Id", "Test Case Name"], ["TC02", "Second"]])[0];
const result: TestResult = { id: "shared", sharedSheetMappingVersion: 2, source: "sheets", sourceSheetName: "TC01, TC02", status: "Not Start", actualResult: "", apiResponse: "", log: "", evidence: [], createdAt: "", sheetSections: [{ id: "step2", title: "Step02 Result · ผลร่วม: TC01, TC02", kind: "fields", rows: [] }] };
test("a shared Result keeps its source Step heading instead of an unmapped label", () => {
  assert.equal(stepResultTitle(testCase(), result), "Step02 Result");
});
test("fresh shared Results remove obsolete mapping warnings but retain unrelated issues", () => {
  const stored = { ...testCase(), importIssues: ["Step02 Result: ไม่พบ Step ที่ตรงกัน กรุณาจับคู่ผลด้วยตนเอง", "Step02 Result: อ้างอิงหลาย Test Case กรุณาจับคู่ผลด้วยตนเอง", "ข้อมูล Step อื่นเปลี่ยน"] };
  const incoming = { ...testCase(), results: [result] };
  assert.deepEqual(reconcileStepCases(stored, incoming).testCase.importIssues, ["ข้อมูล Step อื่นเปลี่ยน"]);
});
test("a web Result still uses the testcase's assigned Step", () => {
  const item = casesFromRows([["Test Case (TC ID)", "Step#", "Description Step", "Expected Result", "Status"], ["TC02", "Step01", "Open", "Shown", "Pass"]])[0];
  assert.equal(stepResultTitle(item, { ...result, sharedSheetMappingVersion: undefined, stepId: item.stepDefinitions![0].id }), "Step01 · Open");
});
