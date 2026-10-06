import assert from "node:assert/strict";
import test from "node:test";
import { parseStepTestCases } from "./step-testcases";
import { parseStepSheetResults } from "./step-sheet-results";

const header = ["Test Scenario*", "Test Scenario Description*\n(High Level Test Case)", "Test Case\n(TC ID)*", "Test Case Name*", "Positive/Negative Case*", "Step#*", "Description Step*", "Expected Result*"];
const definition = ["ENQ_01", "Enquiry", "ENQ_01_TC_01", "Payment", "Positive", "step 01", "Landing page", "Correct"];
const next = ["", "", "", "", "Positive", "step 02", "Coin", "Updated"];
const main = parseStepTestCases([header, definition, next], "Testcase")![0];
test("Result columns use their own nearby table titles instead of the definition register titles", () => {
  const parsed = parseStepSheetResults([header, definition, ["Result Testing"], ["Step#", "Description Step", "Expected Result", "API response", "Log"], ["step 01", "Landing page", "Correct", '{"status":"S"}', "log entry"]], main, main.id)!;
  const fields = parsed.results.find(result => result.stepId)?.sheetSections?.flatMap(section => section.rows.flatMap(row => row.fields));
  assert.ok(fields?.some(field => field.ref === "D5" && field.label === "API response"));
  assert.ok(fields?.some(field => field.ref === "E5" && field.label === "Log"));
  assert.equal(parsed.results.length, 1);
});
test("Result Step markers are discovered beyond the first four columns", () => {
  const parsed = parseStepSheetResults([header, definition, ["Result Testing"], ["", "", "", "", "", "step 01", "Landing page", "Correct"], ["", "", "", "", "", "", "", "", "extra data"]], main, main.id)!;
  assert.equal(parsed.results[0].stepId, "Testcase:2");
  assert.equal(parsed.results[0].sourceRange?.startRow, 4);
});
test("detail extra columns remain visible even when their Step has no Result section", () => {
  const parsed = parseStepSheetResults([[...header, "QA note"], [...definition, "Unrecorded detail note"]], main, main.id)!;
  assert.ok(parsed.results.some(result => result.sheetSections?.some(section => section.rows.some(row => row.fields.some(field => field.label === "QA note" && field.value === "Unrecorded detail note")))));
});
test("detail definition extras stay attached to the owning Result rather than disappearing", () => {
  const parsed = parseStepSheetResults([[...header, "QA note"], [...definition, "Detail-only note"], ["Result Testing"], ["step 01", "Landing page", "Correct"], ["response data"]], main, main.id)!;
  const fields = parsed.results[0].sheetSections?.flatMap(section => section.rows.flatMap(row => row.fields));
  assert.ok(fields?.some(field => field.ref === "I2" && field.label === "QA note" && field.value === "Detail-only note"));
});
test("detail Results retain extra columns with source titles and never discard differing heading values", () => {
  const rows = [[...header, "Extra QA", ""], definition, ["Result Testing"], ["step 02 FN", "Different description", "Different expected", "", "", "", "", "", "proof", "unnamed"], ["", "", "", "", "", "", "", "", "more proof"]];
  const parsed = parseStepSheetResults(rows, main, main.id)!;
  const fields = parsed.results[0].sheetSections?.flatMap(section => section.rows.flatMap(row => row.fields));
  assert.ok(fields?.some(field => field.ref === "I4" && field.label === "Extra QA" && field.value === "proof"));
  assert.ok(fields?.some(field => field.ref === "J4" && field.label === "คอลัมน์ J" && field.value === "unnamed"));
  assert.ok(fields?.some(field => field.ref === "B4" && field.value === "Different description"));
  assert.ok(fields?.some(field => field.ref === "C4" && field.value === "Different expected"));
  assert.ok(fields?.some(field => field.ref === "I5" && field.value === "more proof"));
});
test("unique Step name without descriptive evidence remains unassigned", () => {
  const parsed = parseStepSheetResults([["Result Testing"], ["step 01"], ["log data"]], main, main.id)!;
  assert.equal(parsed.results[0].stepId, undefined);
});

test("detail definition table is excluded and results retain individual Step ranges and highlights", () => {
  const rows = [header, definition, next, [], ["Result Testing"], [], ["step 01", "Landing page", "Correct"], ["", '{"status":"S"}'], [], ["step 02", "Coin", "Updated"], ["Success"]];
  const result = parseStepSheetResults(rows, main, main.id)!;
  assert.equal(result.results.length, 2);
  assert.deepEqual(result.results.map(r => r.stepId), ["Testcase:2", "Testcase:3"]);
  assert.deepEqual(result.results.map(r => r.sourceRange), [{ startRow: 7, endRow: 9 }, { startRow: 10, endRow: 11 }]);
  assert.match(result.results[0].apiResponse, /status/);
  assert.ok(!result.results[0].actualResult.includes("Enquiry"));
  assert.ok(result.representedCells.has("C2"));
  assert.equal(result.issues.length, 0);
});

test("an existing exact Step name with conflicting definitions remains unassigned", () => {
  const rows = [header, definition, ["", "", "", "", "Positive", "step 02 FN", "Other data", "Different"], [], ["Result Testing"], ["step 02 FN", "Other data", "Different"], ["response"]];
  const parsed = parseStepSheetResults(rows.map(row => row.map(cell => cell === "step 02 FN" ? "step 02" : cell)), main, main.id)!;
  assert.equal(parsed.results.length, 1);
  assert.equal(parsed.results[0].stepId, undefined);
  assert.ok(parsed.issues.length > 0);
  assert.match(parsed.results[0].actualResult, /response/);
});

test("a missing Step name falls back to its unique number while retaining original Result text", () => {
  const register = parseStepTestCases([header, definition, ["", "", "", "", "Positive", "step 02 support", "N8N", "mock tpe"]], "Testcase")![0];
  const parsed = parseStepSheetResults([["Result Testing"], ["step 2 FN", "Verify coin", "Updated"], ["API response", '{"coin":100}']], register, main.id)!;
  assert.equal(parsed.results[0].stepId, "Testcase:3");
  assert.match(parsed.results[0].apiResponse, /coin/);
  assert.match(parsed.issues.join("\n"), /จับคู่จากเลข Step/);
  assert.match(parsed.issues.join("\n"), /step 02 support/);
  assert.ok(!parsed.issues.some(issue => issue.includes("ยังผูกผล")));
});

test("number fallback never guesses among multiple Steps with the same number", () => {
  const register = parseStepTestCases([header, definition, ["", "", "", "", "Positive", "step 02 support", "N8N", "mock tpe"], ["", "", "", "", "Positive", "step 02 BE", "BE", "API"]], "Testcase")![0];
  const parsed = parseStepSheetResults([["Result Testing"], ["step 02 FN", "Verify coin", "Updated"], ["log data"]], register, main.id)!;
  assert.equal(parsed.results[0].stepId, undefined);
  assert.ok(parsed.issues.some(issue => issue.includes("ยังผูกผล")));
});

test("exact definition match still wins when the Step number is duplicated", () => {
  const register = parseStepTestCases([header, definition, ["", "", "", "", "Positive", "step 02 FN", "Coin", "Updated"], ["", "", "", "", "Positive", "step 02 BE", "BE", "API"]], "Testcase")![0];
  const parsed = parseStepSheetResults([["Result Testing"], ["step 02 FN", "Coin", "Updated"], ["log data"]], register, main.id)!;
  assert.equal(parsed.results[0].stepId, "Testcase:3");
  assert.equal(parsed.issues.length, 0);
});

test("an unknown number cannot attach to a different numbered Step", () => {
  const parsed = parseStepSheetResults([["Result Testing"], ["step 20 FN", "Coin", "Updated"], ["log data"]], main, main.id)!;
  assert.equal(parsed.results[0].stepId, undefined);
});

test("duplicate Step names use description and expected result, ambiguous sections stay unassigned", () => {
  const caseWithDuplicates = parseStepTestCases([header, definition, ["", "", "", "", "Positive", "step 01", "Other", "Other expected"]], "Testcase")![0];
  const parsed = parseStepSheetResults([["Result Testing"], ["step 01"], ["log data"]], caseWithDuplicates, main.id)!;
  assert.equal(parsed.results[0].stepId, undefined);
  assert.ok(parsed.issues.length);
});
