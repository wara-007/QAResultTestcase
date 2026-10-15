import test from "node:test";
import assert from "node:assert/strict";
import { readSheetImportState, checkpointSheetImport, shouldStartSheetImport, pendingImportSheets, initialSheetImportStates } from "./sheet-import-state";

test("completed and empty-result lookups survive serialization but not a different spreadsheet", () => {
  const saved = checkpointSheetImport(undefined, "sheet-a", { "TC-01": "loaded", "testcase:TC-02": "loaded", "TC-03": "loading" }, "2026-10-04T01:00:00.000Z", false);
  const restored = readSheetImportState(JSON.parse(JSON.stringify(saved)), "sheet-a")!;
  assert.equal(restored.states["TC-01"], "loaded");
  assert.equal(restored.states["testcase:TC-02"], "loaded");
  assert.equal(restored.states["TC-03"], "queued");
  assert.equal(readSheetImportState(saved, "sheet-b"), undefined);
});

test("a failed update preserves previously completed rows and their original load time", () => {
  const initial = checkpointSheetImport(undefined, "sheet-a", { A: "loaded" }, "2026-10-04T01:00:00.000Z", true);
  const updated = checkpointSheetImport(initial, "sheet-a", { A: "error", B: "error" }, "2026-10-04T02:00:00.000Z", false);
  assert.deepEqual(updated.states, { A: "loaded", B: "error" });
  assert.equal(updated.loadedAt.A, "2026-10-04T01:00:00.000Z");
  assert.equal(updated.complete, false);
});

test("automatic import only starts for a new empty project without a saved snapshot", () => {
  assert.equal(shouldStartSheetImport("sheet-a", true, 0, undefined), true);
  assert.equal(shouldStartSheetImport("sheet-a", false, 0, undefined), false);
  assert.equal(shouldStartSheetImport("", true, 0, undefined), false);
  assert.equal(shouldStartSheetImport("sheet-a", true, 10, undefined), false);
  const partial = checkpointSheetImport(undefined, "sheet-a", { A: "loaded", B: "queued" }, "2026-10-04T01:00:00.000Z", false);
  assert.equal(shouldStartSheetImport("sheet-a", true, 10, partial), false);
  assert.equal(shouldStartSheetImport("sheet-a", true, 0, partial), false);
  assert.deepEqual(pendingImportSheets(["A", "B", "C"], partial), ["B", "C"]);
  assert.equal(shouldStartSheetImport("sheet-a", true, 10, { ...partial, complete: true }), false);
});

test("invalid snapshot data is not accepted as proof that rows are loaded", () => {
  assert.equal(readSheetImportState({ version: 1, spreadsheetId: "sheet-a", states: { A: "loaded" }, loadedAt: { A: "bad-date" } }, "sheet-a"), undefined);
});

test("sync invalidation retains last good data but requires a fresh import", () => {
  const saved = checkpointSheetImport(undefined, "sheet-a", { A: "loaded" }, "2026-10-04T01:00:00.000Z", true);
  const restored = readSheetImportState({ ...saved, refreshRequired: true }, "sheet-a")!;
  assert.equal(restored.refreshRequired, true);
  assert.equal(restored.states.A, "loaded");
  assert.equal(shouldStartSheetImport("sheet-a", true, 10, restored), false);
  assert.equal(checkpointSheetImport(restored, "sheet-a", { A: "loaded" }, "2026-10-04T02:00:00.000Z", true).refreshRequired, false);
});

test("explicit resume preserves loaded tabs while queueing only unfinished tabs", () => {
  const partial = checkpointSheetImport(undefined, "sheet-a", { Testcase: "loaded", A: "loaded", B: "error" }, "2026-10-04T01:00:00.000Z", false);
  assert.deepEqual(initialSheetImportStates(["A", "B", "C"], partial, true), { Testcase: "loaded", A: "loaded", B: "queued", C: "queued" });
  assert.deepEqual(initialSheetImportStates(["A", "B"], partial, false), { Testcase: "loading", A: "queued", B: "queued" });
});
