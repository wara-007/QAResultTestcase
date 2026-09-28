import assert from "node:assert/strict";
import test from "node:test";
import type { CanonicalProjectSnapshot, CanonicalTestCase } from "./types";
import { baselineRowsToSnapshot, baselineSnapshotFromMapping, isMissingBaselineTableError, mappingWithBaselineSnapshot, snapshotToBaselineRows } from "./store";

const value: CanonicalTestCase = {
  id: "TC-1", platform: "App", condition: "", scenario: "S", name: "N", steps: "", expected: "", status: "Not Start",
  device: "", testData: "", appVersion: "", environment: "UAT", executedBy: "", executedDate: "", executedTime: "",
  remark: "", customFields: {}, results: {}, defects: {},
};

test("converts a canonical snapshot to project-scoped baseline rows", () => {
  const rows = snapshotToBaselineRows("project-1", { cases: { "TC-1": value } }, "user-1");
  assert.equal(rows[0].project_id, "project-1");
  assert.equal(rows[0].testcase_key, "TC-1");
  assert.equal(rows[0].synced_by, "user-1");
  assert.ok(rows[0].snapshot_hash.length > 20);
});

test("rebuilds a snapshot from baseline rows", () => {
  const source: CanonicalProjectSnapshot = { cases: { "TC-1": value } };
  const rebuilt = baselineRowsToSnapshot(snapshotToBaselineRows("project-1", source, "user-1"));
  assert.deepEqual(rebuilt, source);
});

test("recognizes only the missing baseline table error as a rollout fallback", () => {
  assert.equal(isMissingBaselineTableError({ code: "42P01", message: "relation does not exist" }), true);
  assert.equal(isMissingBaselineTableError({ code: "42501", message: "permission denied" }), false);
});

test("round-trips a shared baseline through the existing source mapping fallback", () => {
  const source: CanonicalProjectSnapshot = { cases: { "TC-1": value } };
  const mapping = mappingWithBaselineSnapshot({ sheetPath: "xl/worksheets/sheet1.xml" }, source);
  assert.equal(mapping.sheetPath, "xl/worksheets/sheet1.xml");
  assert.deepEqual(baselineSnapshotFromMapping(mapping), source);
});
