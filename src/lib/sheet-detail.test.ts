import assert from "node:assert/strict";
import test from "node:test";
import { selectDetailSheets, freeformTextFromCells } from "./sheet-detail";
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
