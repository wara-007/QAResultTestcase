import assert from "node:assert/strict";
import test from "node:test";
import { refreshCaseDraft } from "./case-draft-refresh";
import { casesFromRows } from "./testcase-rows";

test("an open detail form receives new imported results and Steps without discarding unsaved input", () => {
  const previous = casesFromRows([["Test Case Id", "Test Case Name"], ["TC01", "Home"]])[0];
  const draft = { ...previous, testData: "unsaved test data" };
  const incoming = { ...previous, name: "Updated Home", results: [{ id: "new-import", status: "Not Start" as const, actualResult: "new response", apiResponse: "", log: "", createdAt: "", evidence: [] }] };
  const refreshed = refreshCaseDraft(draft, previous, incoming);
  assert.equal(refreshed.name, "Updated Home");
  assert.equal(refreshed.results?.[0].id, "new-import");
  assert.equal(refreshed.testData, "unsaved test data");
});
test("unmodified fields follow future imports while locally edited fields remain untouched", () => {
  const previous = casesFromRows([["Test Case Id", "Test Case Name"], ["TC01", "Home"]])[0];
  assert.equal(refreshCaseDraft({ ...previous, name: "QA edit" }, previous, { ...previous, name: "Sheet edit", environment: "UAT" }).name, "QA edit");
  assert.equal(refreshCaseDraft(previous, previous, { ...previous, environment: "UAT" }).environment, "UAT");
});
