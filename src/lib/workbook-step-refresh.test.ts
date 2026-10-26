import assert from "node:assert/strict";
import test from "node:test";
import { casesFromRows } from "./testcase-rows";
import { refreshWorkbookStepEvidence } from "./workbook-step-refresh";

test("reopening moves stored unassigned screenshot evidence into the repaired Step without changing live text", () => {
  const owner = casesFromRows([["Test Case (TC ID)", "Step#", "Description Step", "Expected Result"], ["TC_01", "Step1", "Open", "Shown"]])[0];
  const result = { id: "SHEET-IMPORT-TC_01-STEP-6", source: "sheets" as const, sourceSheetName: "TC_01", status: "Pass" as const, actualResult: "live text", apiResponse: "", log: "", evidence: [], createdAt: "" };
  const evidence = { fileId: "saved-image", name: "timestamp-sheet-TC_01-13-1-proof.png", mimeType: "image/png" };
  owner.results = [result, { ...result, id: "SHEET-IMPORT-TC_01-UNASSIGNED", actualResult: "นำเข้าจาก Google Sheets · TC_01", evidence: [evidence] }];
  const fresh = { sheetName: "TC_01", testCaseId: "TC_01", resultId: result.id, stepId: "Testcase:2", sourceRange: { startRow: 6, endRow: 13 }, actualResult: "workbook text", apiResponse: "", log: "" };
  const images = [{ sheetName: "TC_01", testCaseId: "TC_01", resultId: result.id, row: 13, column: 1 }];
  const [refreshed] = refreshWorkbookStepEvidence([owner], [fresh], images);
  assert.equal(refreshed.results!.length, 1);
  assert.equal(refreshed.results![0].actualResult, "live text");
  assert.equal(refreshed.results![0].stepId, "Testcase:2");
  assert.deepEqual(refreshed.results![0].sourceRange, { startRow: 6, endRow: 13 });
  assert.deepEqual(refreshed.results![0].evidence, [evidence]);
  assert.equal(owner.results.length, 2);
  owner.results[1].editedLocally = true;
  const [edited] = refreshWorkbookStepEvidence([owner], [fresh], images);
  assert.equal(edited.results!.length, 2);
  assert.deepEqual(edited.results![1].evidence, [evidence]);
  assert.deepEqual(edited.results![0].evidence, []);
});

test('workbook fallback cannot overwrite a QA-edited imported result', async () => {
 const { workbookResultFallback }=await import('./workbook-step-refresh');
 const edited={id:'SHEET-IMPORT-1',source:'sheets' as const,editedLocally:true,status:'Pass' as const,actualResult:'QA edit',apiResponse:'QA response',log:'QA log',evidence:[],createdAt:''};
 const fresh={resultId:edited.id,testCaseId:'TC_01',sheetName:'TC_01',actualResult:'Sheets text',apiResponse:'Sheets response',log:'Sheets log'};
 const result=workbookResultFallback(edited,fresh);
 assert.equal(result.actualResult,'QA edit');assert.equal(result.apiResponse,'QA response');assert.equal(result.log,'QA log');
 assert.equal(workbookResultFallback({...edited,editedLocally:false},fresh).actualResult,'Sheets text');
});
