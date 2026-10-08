import assert from "node:assert/strict";
import test from "node:test";
import { parseStepTestCases } from "./step-testcases";
import { parseStepSheetResults } from "./step-sheet-results";

const header = ["Test Scenario*", "Test Scenario Description*\n(High Level Test Case)", "Test Case\n(TC ID)*", "Test Case Name*", "Positive/Negative Case*", "Step#*", "Description Step*", "Expected Result*"];
const definition = ["ENQ_01", "Enquiry", "ENQ_01_TC_01", "Payment", "Positive", "step 01", "Landing page", "Correct"];
const next = ["", "", "", "", "Positive", "step 02", "Coin", "Updated"];
const main = parseStepTestCases([header, definition, next], "Testcase")![0];
const compactRows = [["Test case No.", "TestCase", "Test Steps", "Expected Result "],
  ["TC05", "Login", "Click Login Home page", "Login successfully"],
  ["TC06", "Login", "Click Login TOL Landing page", "Login successfully"],
  ["TC07", "Login", "Deeplink :: trueapp://app.true.th/login-tolqr", "Login successfully"],
  ["TC08", "Login", "QR", "Login successfully"],
  ["TC15", "Feature", "Validate Feature TOL", "Works"], [], ["Result"], [],
  ["Click Login Home page", "Home page_Login TOL"],
  ["Click Login TOL Landing page\nand\nValidate Feature TOL", "TOL landing_Login TOL"],
  ["Deeplink :: trueapp://app.true.th/login-tolqr", "Deeplink"], ["scan QR code", "scan QR code"]];
test("compact Result rows retain proof fields, definition columns and original evidence ranges", () => {
  const cases = ["TC05", "TC06", "TC07", "TC08", "TC15"].map(id => ({ ...main, id }));
  const parsed = parseStepSheetResults(compactRows, cases[0], "TC05, TC06, TC07, TC08", cases)!;
  assert.equal(parsed.results.length, 4);
  assert.equal(parsed.results[0].sheetSections![0].title.split(" · ผลร่วม:")[0], "Click Login Home page");
  assert.equal(parsed.results[0].sheetSections![0].rows[0].fields[0].value, "Home page_Login TOL");
  assert.equal(parsed.results[0].sheetSections![0].rows[0].fields[0].ref, "B10");
  assert.deepEqual(parsed.results[0].sourceRange, { startRow: 10, endRow: 10 });
  assert.equal(parsed.results[0].sheetDefinitionTable!.rows.length, 5);
  assert.deepEqual(parsed.issues, []);
  assert.equal(parsed.results[0].status, "Not Start");
});
test("every compact combined-tab case receives all four source results, not only description matches", () => {
  const cases = ["TC05", "TC06", "TC07", "TC08", "TC15"].map(id => ({ ...main, id }));
  for (const id of ["TC05", "TC06", "TC07", "TC08", "TC15"]) {
    const parsed = parseStepSheetResults(compactRows, cases.find(item => item.id === id)!, "TC05, TC06, TC07, TC08", cases)!;
    assert.equal(parsed.results.length, 4, id);
    assert.deepEqual(parsed.results.map(result => result.sheetSections![0].rows[0].fields[0].value), ["Home page_Login TOL", "TOL landing_Login TOL", "Deeplink", "scan QR code"], id);
    assert.ok(parsed.results.every(result => result.status === "Not Start" && result.stepId === undefined));
  }
});
test("compact parser is opt-in and does not reinterpret ordinary definition or Result Testing layouts", () => {
  const result = parseStepSheetResults([header, definition, next], main, main.id)!;
  assert.equal(result.results.length, 0);
  assert.ok(result.issues.some(issue => issue.includes("Result Testing")));
});
test("API Response Log matrix separates rows, uses real titles and maps names without comparing response to expected", () => {
  const rows = [header, definition, next, [], ["Result"], ["", "API ::", "Response::", "Log::"], ["step 02", "GET /coins", '{"coin":1}', "request log"], ["", "", "continued"], ["step 01", "GET /home", "ok"]];
  const parsed = parseStepSheetResults(rows, main, "TC01")!;
  assert.equal(parsed.results.length, 2);
  assert.equal(parsed.results[0].stepId, main.stepDefinitions![1].id);
  const fields = parsed.results[0].sheetSections![0].rows.flatMap(row => row.fields);
  assert.ok(fields.some(field => field.label === "Response::" && field.value === '{"coin":1}'));
  assert.ok(fields.some(field => field.label === "Log::" && field.value === "request log"));
  assert.ok(fields.some(field => field.value === "continued"));
  assert.ok(!fields.some(field => field.label === "Expected Result"));
});
test("shared detail matrix does not infer exclusive ownership from Step numbers", () => {
  const otherDefinition = [...definition]; otherDefinition[2] = "TC02";
  const register = parseStepTestCases([header, definition, next, otherDefinition], "Testcase")!;
  const rows = [header, definition, next, otherDefinition, ["Result"], ["", "API", "Response", "Log"], ["step 01", "/home", "ok"], ["step 02", "/coins", "ok"]];
  const first = parseStepSheetResults(rows, register[0], "ENQ_01_TC_01, TC02", register)!;
  const second = parseStepSheetResults(rows, register[1], "ENQ_01_TC_01, TC02", register)!;
  assert.equal(first.results.length, 2);
  assert.equal(first.results[0].stepId, undefined);
  assert.equal(first.results[1].stepId, undefined);
  assert.equal(second.results.length, 2);
  assert.equal(second.results[0].stepId, undefined);
  assert.equal(second.results[0].sourceRange?.startRow, 7);
  assert.deepEqual(first.issues, []);
});

test("combined results preserve the definition table's original columns separately from Results", () => {
  const first = { ...main, id: "TC01" };
  const second = { ...main, id: "TC02" };
  const rows = [["Test Case Id", "Custom QA title", "Step#", "Description Step", "Expected Result", "QA note"],
    ["TC01", "One", "Step01", "Open", "Shown", "first note"],
    ["TC02", "Two", "Step01", "Check", "Correct", "second note"],
    ["Result"], ["", "API", "Response", "Log"], ["Step02 Result", "proof", "ok", "--"], ["Step03 Screen Record", "record", "video", "--"]];
  const parsed = parseStepSheetResults(rows, second, "TC01, TC02", [first, second])!;
  assert.deepEqual((parsed.results[0] as typeof parsed.results[0] & { sheetDefinitionTable?: unknown }).sheetDefinitionTable,
    { headers: ["Test Case Id", "Custom QA title", "Step#", "Description Step", "Expected Result", "QA note"], rows: [["TC01", "One", "Step01", "Open", "Shown", "first note"], ["TC02", "Two", "Step01", "Check", "Correct", "second note"]] });
  assert.equal(parsed.results.length, 2);
  assert.deepEqual(parsed.issues, []);
});

test("an explicit case heading still scopes a result inside a combined tab", () => {
  const first = { ...main, id: "TC01" };
  const second = { ...main, id: "TC02" };
  const rows = [["API", "Response", "Log"], ["TC01 Result", "first proof"], ["TC02 Result", "second proof"]];
  const parsed = parseStepSheetResults(rows, second, "TC01, TC02", [first, second])!;
  assert.equal(parsed.results.length, 1);
  assert.equal(parsed.results[0].sourceRange?.startRow, 3);
});

test("unpartitioned combined API results appear for TC02 without adopting another case status", () => {
  const other = { ...main, id: "TC02", status: "Skip" as const, stepDefinitions: undefined };
  const parsed = parseStepSheetResults([["API", "Response", "Log"], ["GET /shared", '{"data":1}', "shared log"]], other, "TC01, TC02", [{ ...main, id: "TC01" }, other])!;
  assert.equal(parsed.results.length, 1);
  assert.equal(parsed.results[0].status, "Not Start");
  assert.ok(parsed.results[0].sheetSections?.[0].title.includes("ผลร่วม"));
  assert.ok(parsed.results[0].sheetSections?.[0].rows[0].fields.some(field => field.value === "shared log"));
});
test("matrix without Steps retains separate API rows and every extra column", () => {
  const plain = { ...main, stepDefinitions: undefined };
  const parsed = parseStepSheetResults([["Test case No.", "Test case name"], [main.id, "Payment"], ["Result"], ["API ::", "Response::", "Log::", "QA note"], ["GET /one", '{"a":', "first log", "note"], ["GET /two", "text", "second log"]], plain, "TC01, TC02", [plain, { ...plain, id: "TC02" }])!;
  assert.equal(parsed.results.length, 2);
  const fields = parsed.results[0].sheetSections![0].rows[0].fields;
  assert.ok(fields.some(field => field.label === "QA note" && field.value === "note"));
  assert.ok(fields.some(field => field.label === "Response::" && field.value === '{"a":'));
  assert.ok(!fields.some(field => field.value === "Test case No."));
});
test("matrix preserves Test data above its header without repeating definitions", () => {
  const parsed = parseStepSheetResults([header, definition, ["Result"], ["Data test:", "subscriber 123"], ["API", "Response", "Log"], ["GET /home", "ok"]], main, "TC01")!;
  assert.ok(parsed.results.some(result => result.sheetSections?.some(section => section.rows.some(row => row.fields.some(field => field.value === "subscriber 123")))));
});
test("a Result description inside a Step definition is not the Result section boundary", () => {
  const parsed = parseStepSheetResults([header, definition, ["", "", "", "", "", "step 02", "Result ::"], ["", "", "", "", "", "step 03", "Screen recording ::"], ["Result"], ["", "API", "Response", "Log"], ["step 02", "Result ::", "proof"]], main, "TC01")!;
  assert.equal(parsed.results.length, 1);
  assert.ok(!parsed.results[0].sheetSections![0].rows.some(row => row.fields.some(field => field.value === "Screen recording ::")));
});
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
