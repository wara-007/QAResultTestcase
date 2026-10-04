import assert from "node:assert/strict";
import test from "node:test";
import { casesFromRows } from "./testcase-rows";

const header = ["Test Case Id", "Test Scenarios", "", "Test Case Name", "Test Step Description *", "Expected Result *", "Test result", "App Version", "Env.", "Ref\n(Result Testing)", "Executed By", "Executed Date", "Remarks"];
const row = (id: string) => [id, "Scenario", "POSTPAID", "Case name", "Steps", "Expected", "PASSED", "10.5.0", "UAT", id, "QA", "23 Apr 2025"];

test("imports all 72 testcase IDs across sections rather than only 13 TC rows", () => {
  const rows: unknown[][] = [header];
  for (let n = 1; n <= 13; n++) rows.push(row(`TC_${String(n).padStart(2, "0")}`));
  rows.push(['Usage main gauge "no use no pay"']);
  for (let n = 1; n <= 16; n++) rows.push(row(`True_${String(n).padStart(2, "0")}`));
  for (let n = 1; n <= 15; n++) rows.push(row(`Dtac_${String(n).padStart(2, "0")}`));
  rows.push(["Regresstion Test"], row("RG_01"), row("RG_02"));
  rows.push(["Switch product", "Login", "Switch to", "Switch to", "View Usage"]);
  for (let n = 1; n <= 25; n++) rows.push(row(`SW_${String(n).padStart(2, "0")}`));
  rows.push(row("RES_01"));
  const cases = casesFromRows(rows);
  assert.equal(cases.length, 72);
  assert.equal(cases.find(c => c.id === "True_01")?.sourceRow, 16);
  assert.equal(cases.at(-1)?.sourceRow, 76);
  assert.equal(cases.find(c => c.id === "SW_01")?.status, "Pass");
});

test("section boundaries stop scenario and steps leaking from previous sections", () => {
  const cases = casesFromRows([header, row("TC_01"), ["Regression"], ["RG_01", "", "", "New case", "", "Expected", "Skip"]]);
  assert.equal(cases[1]?.scenario, "");
  assert.equal(cases[1]?.steps, "");
  assert.equal(cases[1]?.customFields?.find(f => f.key === "testcase:source-section")?.value, "Regression");
});

test("partial section headers preserve Login and both Switch to fields instead of mapping them as case name", () => {
  const cases = casesFromRows([header, ["Switch product", "Login", "Switch to", "Switch to", "View Usage"], ["SW_01", "CVG", "TMH", "TVS", "All child + parent", "Correct", "PASSED"]]);
  assert.equal(cases.length, 1);
  assert.equal(cases[0].name, "");
  assert.equal(cases[0].expected, "Correct");
  assert.deepEqual(cases[0].customFields?.filter(f => f.label === "Switch to").map(f => [f.column, f.value]), [[2, "TMH"], [3, "TVS"]]);
  assert.equal(cases[0].customFields?.find(f => f.label === "Login")?.value, "CVG");
});

test("repeated full headers can change column order and keep physical source rows", () => {
  const cases = casesFromRows([header, row("TC_01"), ["Other section"], ["Test Case Name", "Status", "Case ID", "Expected Result", "Test Step"], ["Another", "Failed", "PAY_99", "Payment", "Checkout"]]);
  assert.deepEqual(cases.map(c => [c.id, c.name, c.status, c.sourceRow]), [["TC_01", "Case name", "Pass", 2], ["PAY_99", "Another", "Failed", 5]]);
});

test("compact keys without a TC prefix or number are valid but a title-only section is not a testcase", () => {
  const cases = casesFromRows([header, ["Regression"], ["checkout_happy_path", "", "", "Checkout", "Submit", "Success"]]);
  assert.deepEqual(cases.map(c => c.id), ["checkout_happy_path"]);
});
