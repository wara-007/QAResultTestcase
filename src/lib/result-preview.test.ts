import test from "node:test";
import assert from "node:assert/strict";
import { sheetTextHighlights, splitHighlightedText, isImportedEvidenceDisplayed, loadRows, sheetRowState } from "./result-preview";

test("rows without a detail tab use the successfully loaded Testcase summary", () => {
  assert.equal(sheetRowState("", { Testcase: "loaded" }), "loaded");
  assert.equal(sheetRowState("RC TC-01", { Testcase: "loaded" }), "idle");
});

test("empty detail tabs retain successful load state and refresh errors override old results", () => {
  assert.equal(sheetRowState("RC TC-01", { "RC TC-01": "loaded" }), "loaded");
  assert.equal(sheetRowState("RC TC-01", { "RC TC-01": "error" }, true), "error");
  assert.equal(sheetRowState("RC TC-01", {}, true), "loaded");
});

test("each refresh invokes every tab again, including previously empty tabs", async () => {
  const reads: string[] = [];
  for (let refresh = 0; refresh < 2; refresh++) {
    await loadRows(["RC TC-01", "Empty tab"], async key => { reads.push(key); return []; }, () => {});
  }
  assert.deepEqual(reads, ["RC TC-01", "Empty tab", "RC TC-01", "Empty tab"]);
});

test("cell background and rich-text color retain exact offsets in the original log", () => {
  const marks = sheetTextHighlights("prefix\nabcERRORxyz", [{ value: "abcERRORxyz", background: "#ffff00", runs: [{ start: 3, color: "#ff0000", bold: true }, { start: 8 }] }]);
  const parts = splitHighlightedText("prefix\nabcERRORxyz", marks);
  assert.equal(parts.map(p => p.text).join(""), "prefix\nabcERRORxyz");
  const error = parts.find(p => p.text === "ERROR");
  assert.equal(error?.color, "#ff0000");
  assert.equal(error?.background, "#ffff00");
  assert.equal(error?.bold, true);
});

test("deduplication matches the stable imported sheet coordinates, not just a common filename", () => {
  assert.equal(isImportedEvidenceDisplayed("RC TC-01", 4, 2, [{ name: "2026-sheet-RC_TC-01-4-2-image1.png" }]), true);
  assert.equal(isImportedEvidenceDisplayed("RC TC-01", 5, 2, [{ name: "2026-sheet-RC_TC-01-4-2-image1.png" }]), false);
});

test("row loading reports each failure without abandoning remaining rows", async () => {
  const statuses: string[] = [];
  const results = await loadRows(["a", "b", "c"], async key => { if (key === "b") throw new Error("failed"); return key; }, (key, state) => statuses.push(`${key}:${state}`), 2);
  assert.deepEqual(results.filter(r => r.status === "fulfilled").map(r => r.value).sort(), ["a", "c"]);
  assert.ok(statuses.includes("b:error"));
  assert.ok(statuses.includes("a:loaded"));
  assert.ok(statuses.includes("c:loaded"));
});
