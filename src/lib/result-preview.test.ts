import test from "node:test";
import assert from "node:assert/strict";
import { sheetTextHighlights, splitHighlightedText, isImportedEvidenceDisplayed, loadRows, sheetRowState, completeResultTabLoad } from "./result-preview";
import { canReuseSheetDetails } from "./result-preview";
import { caseDetailLoadKeys } from "./result-preview";

test("a case without result tabs records its own completed lookup without completing another case", () => {
  const keys = caseDetailLoadKeys([], "TC-01");
  const states = Object.fromEntries(keys.map(key => [key, "loaded" as const]));
  assert.equal(sheetRowState(caseDetailLoadKeys([], "TC-01"), states), "loaded");
  assert.equal(sheetRowState(caseDetailLoadKeys([], "TC-02"), states), "idle");
  assert.equal(sheetRowState(caseDetailLoadKeys(["RC TC-01"], "TC-01"), states), "idle");
});
import { batchRowLoader } from "./result-preview";

test("full refresh reads groups of tabs once while retaining per-row results", async () => {
  const reads: string[][] = [];
  const loader = batchRowLoader(["a", "b", "c", "d"], 3, async names => { reads.push(names); return names; });
  const results = await loadRows(["a", "b", "c", "d"], loader, () => {});
  assert.deepEqual(reads, [["a", "b", "c"], ["d"]]);
  assert.equal(results.length, 4);
  assert.ok(results.every(result => result.status === "fulfilled"));
});

test("returning to complete details reuses them only while workbook evidence remains available", () => {
  assert.equal(canReuseSheetDetails(["True_01"], { True_01: "loaded" }, true), true);
  assert.equal(canReuseSheetDetails(["True_01"], { True_01: "loaded" }, false), false);
  assert.equal(canReuseSheetDetails(["True_01", "True_02"], { True_01: "loaded" }, true), false);
  assert.equal(canReuseSheetDetails(["True_01"], { True_01: "error" }, true), false);
});

test("opening a case waits for evidence before marking its result tabs loaded", async () => {
  const states: Record<string, "loading" | "loaded" | "error"> = {};
  let finishImages!: () => void;
  const images = new Promise<void>(resolve => { finishImages = resolve; });
  const pending = completeResultTabLoad(["True_01"], () => images, (name, state) => { states[name] = state; });
  assert.equal(sheetRowState("True_01", states), "loading");
  finishImages();
  await pending;
  assert.equal(sheetRowState("True_01", states), "loaded");
});

test("failed evidence does not leave a case marked loaded", async () => {
  const states: Record<string, "loading" | "loaded" | "error"> = { True_01: "loaded" };
  await assert.rejects(completeResultTabLoad(["True_01"], async () => { throw new Error("images unavailable"); }, (name, state) => { states[name] = state; }), /images unavailable/);
  assert.equal(sheetRowState("True_01", states), "error");
});

test("a loaded summary does not mean testcase results have loaded", () => {
  assert.equal(sheetRowState("", { Testcase: "loaded" }), "idle");
  assert.equal(sheetRowState("RC TC-01", { Testcase: "loaded" }), "idle");
});

test("empty detail tabs retain successful load state and refresh errors override old results", () => {
  assert.equal(sheetRowState("RC TC-01", { "RC TC-01": "loaded" }), "loaded");
  assert.equal(sheetRowState("RC TC-01", { "RC TC-01": "error" }), "error");
  assert.equal(sheetRowState("RC TC-01", {}), "idle");
});

test("a testcase is loaded only after all its result tabs finish", () => {
  assert.equal(sheetRowState(["TC_01", "RC TC_01"], { TC_01: "loaded" }), "idle");
  assert.equal(sheetRowState(["TC_01", "RC TC_01"], { TC_01: "loaded", "RC TC_01": "loading" }), "loading");
  assert.equal(sheetRowState(["TC_01", "RC TC_01"], { TC_01: "loaded", "RC TC_01": "loaded" }), "loaded");
  assert.equal(sheetRowState(["TC_01", "RC TC_01"], { TC_01: "loaded", "RC TC_01": "error" }), "error");
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
