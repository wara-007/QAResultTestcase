import test from "node:test";
import assert from "node:assert/strict";
import { projectDefectsFromRows, collectProjectDefects, defectRecordsForSync, summarizeProjectDefects } from "./project-defects";
import type { TestCase } from "./types";

test("sync retains registered project defects and allocates new IDs without overwriting them", () => {
  const existing = projectDefectsFromRows([["Defected Id", "Description"], ["DEF-01", "Existing"]], "Defected");
  const cases = [{ id: "TC-01", defects: [{ ...existing[0], id: "web-uuid", description: "New", title: "New" }] }] as TestCase[];
  const records = defectRecordsForSync(cases, existing);
  assert.deepEqual(records.map(record => record.displayId), ["DEF-02", "DEF-01"]);
  assert.equal(records[1].testCase.id, "");
  assert.equal(records[1].defect.description, "Existing");
});

test("Defected table imports project defects without requiring a Testcase reference", () => {
  const defects = projectDefectsFromRows([["Defected Id", "Platform", "App version", "Defected Description", "Jira Card", "Status", "Reporter", "Report Date", "Ref\n(Testcase)"], ["DEF-01", "App", "123", "Wrong text", "https://example.com/DEF-01", "Passed", "QA", "5/11/2025", ""], ["DEF-02", "App", "124", "Wrong price", "", "Open", "QA", "", "TC-02, TC-03"]], "Defected");
  assert.equal(defects.length, 2);
  assert.equal(defects[0].title, "Wrong text");
  assert.equal(defects[0].status, "Passed");
  assert.equal(defects[0].reporter, "QA");
  assert.equal(defects[1].testCaseReference, "TC-02, TC-03");
  assert.equal(defects[0].sourceSheetName, "Defected");
});

test("same defect in a Testcase and project register is counted once", () => {
  const defect = projectDefectsFromRows([["Defect Id", "Description"], ["DEF-01", "Bug"]], "Defected")[0];
  const all = collectProjectDefects([{ ...defect, testCaseReference: "TC-01" }], [defect]);
  assert.equal(all.length, 1);
  assert.equal(all[0].testCaseReference, "TC-01");
});

test("overview counts a shared Jira once and treats Passed as closed", () => {
  const web = projectDefectsFromRows([["Defect Id", "Status", "Jira Card"], ["web-id", "Open", "https://jira/BUG-1"]], "TC-01");
  const register = projectDefectsFromRows([["Defected Id", "Status", "Jira Card"], ["DEF-01", "Passed", "https://jira/BUG-1"], ["DEF-02", "Open", ""]], "Defected");
  const all = collectProjectDefects(web, register);
  assert.deepEqual(summarizeProjectDefects(all), { total: 2, closed: 1, open: 1 });
});

test("hyperlinked defect IDs keep the label while Jira keeps its destination URL", () => {
  const defect = projectDefectsFromRows([["Defected Id", "Jira Card"], ['=HYPERLINK("#gid=123","DEF-01")', '=HYPERLINK("https://jira.example/BUG-1","BUG-1")']], "Defected")[0];
  assert.equal(defect.id, "DEF-01");
  assert.equal(defect.jiraUrl, "https://jira.example/BUG-1");
});
