import assert from "node:assert/strict";
import test from "node:test";
import { casesFromRows } from "./testcase-rows";
import { workspaceCasesForRegister } from "./sheet-register-cases";
import { parseStepSheetResults } from "./step-sheet-results";

test("saved Step headings display as owned results instead of synthetic result text", () => {
  const owner = casesFromRows([["Test Case (TC ID)", "Step#", "Description Step", "Expected Result"],
    ["TC_01", "Step1", "Open", "Shown"], ["", "Step2", "API", "Success"]])[0];
  const base = { source: "sheets" as const, sourceSheetName: "TC_01", status: "Pass" as const, apiResponse: "", log: "", evidence: [], createdAt: "" };
  owner.results = [{ ...base, id: "SHEET-IMPORT-TC_01-STEP-6", actualResult: "ผลจาก Step1" },
    { ...base, id: "SHEET-IMPORT-TC_01-STEP-33", actualResult: "API proof", sheetSections: [{ id: "step2", title: "Step2", kind: "fields", rows: [] }] }];
  const [displayed] = workspaceCasesForRegister([owner], [], []);
  assert.deepEqual(displayed.results!.map(result => result.stepId), ["Testcase:2", "Testcase:3"]);
  assert.equal(displayed.results![0].actualResult, "");
  assert.equal(displayed.results![1].actualResult, "API proof");
  assert.equal(owner.results[0].actualResult, "ผลจาก Step1");
  owner.results[0].stepMappingHistory = [{ fromStepId: "Testcase:2", toStepId: null, by: "QA", at: "2026-10-23" }];
  assert.equal(workspaceCasesForRegister([owner], [], [])[0].results![0].stepId, undefined);
});

test("a conflicting explicit result description is not reassigned by its heading alone", () => {
  const owner = casesFromRows([["Test Case (TC ID)", "Step#", "Description Step", "Expected Result"], ["TC_01", "Step1", "Open", "Shown"]])[0];
  owner.results = parseStepSheetResults([["Result Testing"], ["Step1", "Different action", "Shown"], ["proof"]], owner, "TC_01")!.results;
  assert.equal(owner.results[0].stepId, undefined);
  assert.equal(workspaceCasesForRegister([owner], [], [])[0].results![0].stepId, undefined);
});

test("cases referencing a shared tab retain their own row-scoped results without copying the other case", () => {
  const cases = casesFromRows([["Test Case (TC ID)", "Step#", "Description Step", "Expected Result", "Ref (Result Testing)"],
    ["FG01_TC01", "Step 01", "First", "Works", "FG01"], ["FG01_TC02", "Step 01", "Second", "Works", "FG01"]]);
  cases.forEach((owner, index) => { owner.results = [{ id: `SHEET-IMPORT-FG01-STEP-${index+2}`, source: "sheets", sourceSheetName: "FG01", stepSheetMappingVersion: 2,
    stepId: owner.stepDefinitions![0].id, status: "Pass", actualResult: `proof ${index+1}`, apiResponse: "", log: "", evidence: [], createdAt: "" }]; });
  const sheets = [{ name: "FG01", path: "FG01", order: 0, kind: "result" as const, testCaseIds: cases.map(item => item.id), imageCount: 0, hidden: false }];
  const displayed = workspaceCasesForRegister(cases, sheets, []);
  assert.deepEqual(displayed.map(owner => owner.results!.map(result => result.actualResult)), [["proof 1"], ["proof 2"]]);
});
