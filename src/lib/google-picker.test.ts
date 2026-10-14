import assert from "node:assert/strict";
import test from "node:test";
import { pickerConfiguration, pickedWorkbook } from "./google-picker";

test("Picker requires configuration but returns only browser-safe config", () => {
  assert.throws(() => pickerConfiguration({}), /GOOGLE_PICKER_API_KEY/);
  assert.throws(() => pickerConfiguration({ GOOGLE_PICKER_API_KEY: "key" }), /GOOGLE_CLOUD_PROJECT_NUMBER/);
  assert.deepEqual(pickerConfiguration({ GOOGLE_PICKER_API_KEY: "key", GOOGLE_CLOUD_PROJECT_NUMBER: "499875358182", GOOGLE_OAUTH_CLIENT_SECRET: "never return" }), { developerKey: "key", appId: "499875358182" });
});
test("Picker normalizes the selected workbook, ignores cancellation and rejects other files or wrong project sources", () => {
  assert.equal(pickedWorkbook({ action: "cancel" }), null);
  assert.deepEqual(pickedWorkbook({ action: "picked", docs: [{ id: "file-123", name: "QA.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", url: "javascript:bad()" }] }), { id: "file-123", name: "QA.xlsx", url: "https://docs.google.com/spreadsheets/d/file-123/edit" });
  assert.throws(() => pickedWorkbook({ action: "picked", docs: [{ id: "file-123", mimeType: "application/pdf" }] }), /รองรับ/);
  assert.throws(() => pickedWorkbook({ action: "picked", docs: [{ id: "different", mimeType: "application/vnd.google-apps.spreadsheet" }] }, "expected"), /ไฟล์ที่เชื่อม/);
});
