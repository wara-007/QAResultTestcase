import { casesFromRows } from "./testcase-rows";
import assert from "node:assert/strict";
import test from "node:test";
import { parseStoredResults, serializeStoredResults } from "./stored-results";
import type { TestCase, TestDefect } from "./types";

const defect: TestDefect = {
  id: "DEF-01", title: "Wrong price", description: "Price differs", status: "Open",
  jiraUrl: "https://jira.example/BUG-1", apiResponse: "{}", log: "trace", evidence: [],
  createdAt: "2026-10-23", sourceSheetName: "Defected", platform: "iOS", appVersion: "1.2",
  reporter: "QA", testCaseReference: "TC-01, TC-02", rcReference: "RC-01",
};

test("saved defects retain register context after a serialize/parse round trip", () => {
  const serialized = serializeStoredResults({ resultReference: "reference", defects: [defect] } as TestCase);
  assert.deepEqual(parseStoredResults(serialized).defects, [defect]);
});

test("legacy result defects retain register context when migrated to their testcase", () => {
  const parsed = parseStoredResults(`qa-results:${JSON.stringify({ version: 1, results: [{ id: "result-1", defects: [defect] }] })}`);
  assert.deepEqual(parsed.defects, [defect]);
  assert.equal(parsed.results[0].defects, undefined);
});

test("resolved Ref link targets survive saving and reopening a case", () => {
  const saved = serializeStoredResults({ ...casesFromRows([['Test Case Id','Test Case Name'],['TC01','First']])[0], resultReference: 'Open result', resultReferenceTargets: ['CAN_02','CAN_03'], results: [] });
  assert.deepEqual(parseStoredResults(saved).resultReferenceTargets, ['CAN_02','CAN_03']);
});

test('register row identity survives saving and reopening repeated source IDs',async()=>{
 const {assignRegisterCaseIdentities}=await import('./register-case-identity');
 const cases=assignRegisterCaseIdentities(casesFromRows([['Testcase ID','Test Case Name'],['TC01','First'],['TC01','Second']]));
 for(const item of cases) assert.deepEqual(parseStoredResults(serializeStoredResults(item)).registerIdentity,item.registerIdentity);
});
