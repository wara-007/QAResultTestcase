import assert from "node:assert/strict";
import test from "node:test";
import { casesFromRows } from "./testcase-rows";

export const stepHeaders = ["Test Scenario*", "Test Scenario Description*\n(High Level Test Case)", "Test Case\n(TC ID)*", "Test Case Name*", "Positive/Negative Case*", "Step#*", "Description Step*", "Expected Result*\nFN", "Status", "Device", "Env", "App V.", "Ref\n(Result Testing)", "Executed By", "Executed Date", "Spint", "Testcase", "REMARK"];
const row = (id: string, step: string, status = "NotStart") => ["ENQ_01", "Enquiry balance", id, "Verify pay advance", "Positive", step, "Verify data", "Correct data", status, "iOS", "UAT", "1.0", "", "QA", "6/10/2026"];
test("Step templates use Condition for testcase conditions, independently of Positive/Negative classification", () => {
  const headers = [...stepHeaders, "Condition*"];
  const data = [...row("TC01", "step 01")];
  while (data.length < stepHeaders.length) data.push("");
  const item = casesFromRows([headers, [...data, "Existing TOL customer"]])[0];
  assert.equal(item.condition, "Existing TOL customer");
  assert.equal(item.stepDefinitions![0].classification, "Positive");
  assert.equal(item.stepDefinitions![0].sourceFields!.find(field => field.label === "Condition*")?.mapped, true);
  assert.equal(casesFromRows([headers, [...data, ""]])[0].condition, "");
  assert.equal(casesFromRows([stepHeaders, data])[0].condition, "");
});
test("Step source columns preserve unknown and duplicate titles, blank headers and continuation values", () => {
  const cases = casesFromRows([[...stepHeaders, "Extra", "Extra", ""], [...row("ENQ_01_TC_01", "step 01"), "66", "TC", "note", "first", "second", "last"], ["", "", "", "", "Positive", "step 02", "Verify", "Correct", "NotStart", "", "", "", "", "", "", "67"]]);
  const fields = cases[0].stepDefinitions?.[0].sourceFields;
  assert.equal(fields?.length, 21);
  assert.deepEqual(fields?.slice(18).map(field => [field.label, field.value, field.ref]), [["Extra", "first", "S2"], ["Extra", "second", "T2"], ["คอลัมน์ U", "last", "U2"]]);
  assert.equal(cases[0].stepDefinitions?.[1].sourceFields?.find(field => field.label === "Spint")?.value, "67");
  assert.equal(fields?.find(field => field.label === "Device")?.mapped, true);
  assert.equal(fields?.find(field => field.label === "Extra")?.mapped, false);
});

test("main template retains 14 ordered steps including duplicate numbers without creating 14 cases", () => {
  const rows = [stepHeaders, row("ENQ_01_TC_01", "step 01 legacy customer portal", "TESTING"), ...Array.from({ length: 13 }, (_, i) => ["", "", "", "", "Positive", `step ${i < 2 ? "08" : i + 2} BE`, "Verify data", "Correct data", i === 0 ? "Block" : "NotStart"])];
  const cases = casesFromRows(rows);
  assert.equal(cases.length, 1);
  assert.equal(cases[0].id, "ENQ_01_TC_01");
  assert.equal(cases[0].stepDefinitions?.length, 14);
  assert.equal(new Set(cases[0].stepDefinitions?.map(s => s.id)).size, 14);
  assert.deepEqual(cases[0].stepDefinitions?.slice(0, 3).map(s => [s.sourceRow, s.status]), [[2, "In Progress"], [3, "Blocked"], [4, "Not Start"]]);
  assert.equal(cases[0].status, "In Progress");
  assert.match(cases[0].scenario, /Enquiry balance/);
});

test("blank sections and repeated headers do not attach orphan steps to preceding cases", () => {
  const cases = casesFromRows([stepHeaders, row("ENQ_01_TC_01", "step 01", "Pass"), [], ["", "", "", "", "", "orphan step", "orphan data"], stepHeaders, row("ENQ_01_TC_02", "step 01", "custom status")]);
  assert.equal(cases.length, 2);
  assert.equal(cases[0].stepDefinitions?.length, 1);
  assert.equal(cases[1].stepDefinitions?.length, 1);
  assert.equal(cases[1].stepDefinitions?.[0].rawStatus, "custom status");
  assert.equal(cases[1].stepDefinitions?.[0].status, "Unknown");
  assert.notEqual(cases[1].status, "Pass");
});
