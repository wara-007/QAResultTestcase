import assert from "node:assert/strict";
import test from "node:test";
import { selectDetailSheets, freeformTextFromCells } from "./sheet-detail";

test("batch selection reads only the explicitly requested tabs and rejects missing names", () => {
  const sheets = ["Testcase", "True_01", "True_02", "Other"].map((name, order) => ({ name, order, path: name, kind: "other" as const, testCaseIds: [], hidden: false, imageCount: 0 }));
  assert.deepEqual(selectDetailSheets(sheets, { sheetNames: ["True_01", "True_02"] }).map(sheet => sheet.name), ["True_01", "True_02"]);
  assert.throws(() => selectDetailSheets(sheets, { sheetNames: ["missing"] }), /ไม่พบ/);
});
import { workbookSheetFromGoogleProperties } from "./sheet-mapping-model";

test("an explicit tab request never loads another tab referencing the same testcase", () => {
  const sheets = ["Testcase", "RC  TC-27", "RC TC-18", "RC TC-18 - พังที่แพ็กหลัก"].map((title, sheetId) => workbookSheetFromGoogleProperties({ title, sheetId }));
  assert.deepEqual(selectDetailSheets(sheets, { sheetName: "RC  TC-27" }).map(s => s.name), ["RC  TC-27"]);
  assert.throws(() => selectDetailSheets(sheets, { sheetName: "missing" }), /ไม่พบ/);
  assert.deepEqual(selectDetailSheets(sheets, { testcaseId: "TC-27" }).map(s => s.name), ["RC  TC-27"]);
});

test("freeform details keep filename JSON logs and every unrecognized long cell without duplication", () => {
  const long = "unknown ".repeat(10000).trim();
  const parsed = freeformTextFromCells([{ ref: "A34", value: 'CommonBE_trueapp_Endpoint.log:188:{"level":"INFO","data":{}}' }, { ref: "ZZ300", value: long }, { ref: "B301", value: long }]);
  assert.ok(parsed.log.includes("CommonBE_trueapp_Endpoint.log:188:"));
  assert.ok(!parsed.apiResponse.includes("CommonBE"));
  assert.ok(parsed.actualResult.includes(`ZZ300: ${long}`));
  assert.ok(parsed.actualResult.includes(`B301: ${long}`));
});

test("keeps arbitrary headers and cells beside testcase metadata and excludes represented results only", () => {
  const parsed = freeformTextFromCells([
    { ref: "A1", value: "Test Case Id" }, { ref: "A2", value: "TC-01" },
    { ref: "Z1", value: "QA custom title" }, { ref: "Z2", value: "custom test data" },
    { ref: "A4", value: "log1" }, { ref: "B4", value: "log2" },
    { ref: "A5", value: "first log" }, { ref: "B5", value: "second log" },
    { ref: "X20", value: "already shown" },
  ], ["already shown", "TC-01"]);
  assert.ok(parsed.actualResult.includes("Z1: QA custom title"));
  assert.ok(parsed.actualResult.includes("Z2: custom test data"));
  assert.ok(parsed.log.includes("first log"));
  assert.ok(parsed.log.includes("second log"));
  assert.ok(!parsed.actualResult.includes("already shown"));
});

test("repeated values in different cells are not all removed by one mapped value", () => {
  const parsed = freeformTextFromCells([{ ref: "A10", value: "same data" }, { ref: "Z20", value: "same data" }], ["same data"]);
  assert.ok(parsed.actualResult.includes("Z20: same data"));
});

test("mapped source coordinates remove the field label and value without hiding the same text elsewhere", () => {
  const parsed = freeformTextFromCells([
    { ref: "C1", value: "Environment" }, { ref: "C2", value: "UAT" },
    { ref: "Z30", value: "UAT" },
  ], [], ["C1", "C2"]);
  assert.ok(!parsed.actualResult.includes("C1:"));
  assert.ok(!parsed.actualResult.includes("C2:"));
  assert.ok(parsed.actualResult.includes("Z30: UAT"));
});
