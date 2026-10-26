import assert from "node:assert/strict";
import test from "node:test";
import { casesFromRows } from "./testcase-rows";
import { prioritizeReferencedSheets, withResultReferenceIssues, isMissingResultReferenceIssue } from "./register-result-references";
const cases = () => casesFromRows([["Test Case Id", "Test Case Name", "Ref (Result Testing)"], ["TC01", "First", "Proof B"], ["TC02", "Second", "Proof A"]]);

test("read the tabs referenced by register cases first, then retain other tabs for inspection", () => {
  const sheets = ["Unrelated", "Proof A", "Proof B"].map(name => ({ name }));
  assert.deepEqual(prioritizeReferencedSheets(sheets, cases()).map(sheet => sheet.name), ["Proof B", "Proof A", "Unrelated"]);
  assert.deepEqual(sheets.map(sheet => sheet.name), ["Unrelated", "Proof A", "Proof B"]);
});
test("a missing Ref tab warns its own case without dropping cases or inventing result tabs", () => {
  const original = cases();
  const updated = withResultReferenceIssues(original, [{ name: "Proof A" }]);
  assert.equal(updated.length, 2);
  assert.match(updated[0].importIssues![0], /ไม่พบแท็บที่อ้างอิง.*Proof B/);
  assert.deepEqual(updated[1].importIssues, []);
  assert.equal(original[0].importIssues, undefined);
  assert.equal(updated[0].results?.length ?? 0, 0);
});
test("resolved missing Ref warnings clear without clearing other import issues or saved evidence", () => {
  const original = withResultReferenceIssues(cases(), []);
  original[0].importIssues!.push("Other warning");
  original[0].evidence = [{ fileId: "saved", name: "proof.png", mimeType: "image/png" }];
  const updated = withResultReferenceIssues(original, [{ name: "Proof B" }, { name: "Proof A" }]);
  assert.deepEqual(updated[0].importIssues, ["Other warning"]);
  assert.deepEqual(updated[0].evidence, original[0].evidence);
  assert.ok(!updated.some(item => item.importIssues?.some(isMissingResultReferenceIssue)));
});
test("a register without Ref or result tabs remains importable with no missing-reference warning", () => {
  const original = casesFromRows([["Test Case Id", "Test Case Name"], ["TC01", "First"]]);
  assert.deepEqual(withResultReferenceIssues(original, []).map(item => item.importIssues), [[]]);
});

test("Ref hyperlinks use the real tab target while retaining the displayed case range", async () => {
  const { resolveRegisterReferenceTargets } = await import('./register-result-references');
  const original = casesFromRows([["Test Case Id", "Test Case Name", "Ref (Result Testing)"], ["CAN_02_TC01", "First", "CAN_02_TC01 - CAN_02_TC06"]]);
  const resolved = resolveRegisterReferenceTargets(original, [{ name: 'CAN_02', sheetId: 12 }], new Map([['C2', "'CAN_02'!A1"]]));
  assert.equal(resolved[0].resultReference, 'CAN_02_TC01 - CAN_02_TC06');
  assert.deepEqual(resolved[0].resultReferenceTargets, ['CAN_02']);
  assert.deepEqual(withResultReferenceIssues(resolved, [{name:'CAN_02'}])[0].importIssues, []);
});
test("Google gid links select the actual local tab and never match an external spreadsheet", async () => {
  const { resolveRegisterReferenceTargets } = await import('./register-result-references');
  const original = casesFromRows([["Test Case Id", "Ref (Result Testing)"], ["TC01", "Open results"]]);
  const sheets = [{ name: 'Real proof', sheetId: 42 }];
  assert.deepEqual(resolveRegisterReferenceTargets(original, sheets, new Map([['B2', '#gid=42']]))[0].resultReferenceTargets, ['Real proof']);
  assert.deepEqual(resolveRegisterReferenceTargets(original, sheets, new Map([['B2', 'https://docs.google.com/spreadsheets/d/other/edit#gid=42']]), 'current')[0].resultReferenceTargets, ['Open results']);
});
test("repeated register IDs retain separate rows and their own referenced tabs", async () => {
  const { resolveRegisterReferenceTargets } = await import('./register-result-references');
  const original = casesFromRows([["Test Case Id", "Test Case Name", "Ref (Result Testing)"], ["TC01", "First", "Proof A"], ["TC01", "Same case", "Proof B"]]);
  const resolved = resolveRegisterReferenceTargets(original, [{name:'Proof A'},{name:'Proof B'}]);
  assert.equal(resolved.length, 2);
  assert.deepEqual(resolved.map(item => item.resultReferenceTargets), [['Proof A'],['Proof B']]);
});

test('legacy tab snapshots cannot override evidence ownership established by a real register Ref', async () => {
  const { unreferencedSnapshotAssignments } = await import('./register-result-references');
  const owner = { ...cases()[0], resultReference: 'Proof B', resultReferenceTargets: ['Proof B'] };
  const legacy = { ...cases()[0], id: 'Proof B', sourceSheetName: 'Proof B', resultReference: 'Proof B' };
  assert.equal(unreferencedSnapshotAssignments([owner,legacy]).has('proof b'), false);
  assert.equal(unreferencedSnapshotAssignments([legacy]).get('proof b'), 'Proof B');
});

test('two register rows with the same displayed ID retain their own Ref targets', async()=>{
  const {displayTestCaseId}=await import('./register-case-identity');
  const source=casesFromRows([['Test Case Id','Test Case Name','Ref (Result Testing)'],['TC01','First','Proof A'],['TC01','Second','Proof B']]);
  const { resolveRegisterReferenceTargets } = await import('./register-result-references');
  const result=resolveRegisterReferenceTargets(source,[{name:'Proof A'},{name:'Proof B'}]);
  assert.equal(result.length,2);assert.equal(new Set(result.map(c=>c.id)).size,2);
  assert.deepEqual(result.map(displayTestCaseId),['TC01','TC01']);
  assert.deepEqual(result.map(c=>c.resultReferenceTargets),[['Proof A'],['Proof B']]);
});
