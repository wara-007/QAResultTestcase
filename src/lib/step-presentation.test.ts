import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TestCaseSteps, stepResultTitle } from "../components/test-case-steps";
import { casesFromRows } from "./testcase-rows";
test("shared Step metadata renders once while empty descriptions disappear and differences remain", () => {
  const testCase = casesFromRows([["Test Case (TC ID)", "Step#", "Description Step", "Expected Result", "Device", "Sprint", "Ref (Result Testing)"], ["TC01", "Step01", "", "", "Android", "67", "TC01"], ["", "Step02", "Actual description", "", "Android", "67", "TC01"]])[0];
  for (const readOnly of [true, false]) {
    const html = renderToStaticMarkup(React.createElement(TestCaseSteps, { testCase, readOnly }));
    const visible = html.replace(/<details><summary>กำหนดข้อมูลเฉพาะ Step นี้<\/summary>[\s\S]*?<\/details>/g, "");
    assert.equal((visible.match(/Android/g) ?? []).length, 1);
    assert.equal((html.match(/>67</g) ?? []).length, 1);
    assert.ok(!html.includes("—"));
    assert.match(html, /Actual description/);
  }
  testCase.stepDefinitions![1].device = "iOS";
  const html = renderToStaticMarkup(React.createElement(TestCaseSteps, { testCase, readOnly: true }));
  assert.match(html, /Android/);
  assert.match(html, /iOS/);
});
test("Step results render once inside their owning Step with a per-Step add action", () => {
  const testCase = casesFromRows([["Test Case (TC ID)", "Step#", "Description Step", "Expected Result"], ["ENQ_01_TC_01", "step 01", "Landing", "Correct"]])[0];
  testCase.results = [{ id: "result-1", stepId: "Testcase:2", status: "Pass", actualResult: "Evidence content", apiResponse: "", log: "", evidence: [], createdAt: "" }];
  const props = { testCase, readOnly: false, renderResults: (results: NonNullable<typeof testCase.results>) => React.createElement("article", null, results.map(result => result.actualResult).join("")), onAddResult: () => {} };
  const html = renderToStaticMarkup(React.createElement(TestCaseSteps, props));
  assert.match(html, /Evidence content/);
  assert.equal((html.match(/Evidence content/g) ?? []).length, 1);
  assert.match(html, /เพิ่ม Result ให้ step 01/);
  const stepMarkup = html.replace(/<details><summary>กำหนดข้อมูลเฉพาะ Step นี้<\/summary>[\s\S]*?<\/details>/g, "");
  assert.ok(stepMarkup.indexOf("Evidence content") < stepMarkup.indexOf("</details>"));
});
test("QA and PO show additional titled Step columns without duplicating mapped Device values", () => {
  const testCase = casesFromRows([["Test Case (TC ID)", "Step#", "Description Step", "Expected Result", "Device", "Sprint", ""], ["ENQ_01_TC_01", "step 01", "Landing", "Correct", "Android", "66", "Other data"]])[0];
  for (const readOnly of [true, false]) {
    const html = renderToStaticMarkup(React.createElement(TestCaseSteps, { testCase, readOnly }));
    assert.match(html, /Sprint/);
    assert.match(html, /66/);
    assert.match(html, /คอลัมน์ G/);
    assert.match(html, /Other data/);
    const visible = html.replace(/<details><summary>กำหนดข้อมูลเฉพาะ Step นี้<\/summary>[\s\S]*?<\/details>/g, "");
    assert.equal((visible.match(/Android/g) ?? []).length, 1);
  }
});

test("QA and PO render the same distinct Step definitions while PO has no edit controls", () => {
  const testCase = casesFromRows([["Test Case (TC ID)", "Step#", "Description Step", "Expected Result", "Status"], ["ENQ_01_TC_01", "step 08", "BE response", "API return", "Block"], ["", "step 08", "Legacy response", "Legacy return", "TESTING"]])[0];
  const readOnly = renderToStaticMarkup(React.createElement(TestCaseSteps, { testCase, readOnly: true }));
  assert.match(readOnly, /BE response/);
  assert.match(readOnly, /Legacy response/);
  assert.match(readOnly, /Blocked/);
  assert.match(readOnly, /2 Steps/);
  assert.ok(!readOnly.includes("<select"));
  const editable = renderToStaticMarkup(React.createElement(TestCaseSteps, { testCase, readOnly: false, onChange: () => {} }));
  assert.match(editable, /<select/);
  assert.equal(stepResultTitle(testCase, { stepId: "Testcase:3" }), "step 08 · Legacy response");
  assert.equal(stepResultTitle(testCase, {}), "ผลที่ยังไม่ผูก Step");
});
