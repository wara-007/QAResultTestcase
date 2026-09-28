import assert from "node:assert/strict";
import test from "node:test";
import type { CanonicalProjectSnapshot, CanonicalTestCase } from "./types";
import { compareSnapshots } from "./compare";

const makeCase = (overrides: Partial<CanonicalTestCase> = {}): CanonicalTestCase => ({
  id: "TC-1", platform: "App", condition: "", scenario: "S", name: "N", steps: "Step", expected: "Expected",
  status: "Not Start", device: "", testData: "", appVersion: "", environment: "UAT", executedBy: "",
  executedDate: "", executedTime: "", remark: "", customFields: {}, results: {}, defects: {}, ...overrides,
});
const snapshot = (value?: CanonicalTestCase): CanonicalProjectSnapshot => ({ cases: value ? { "TC-1": value } : {} });

test("ignores semantic casing, surrounding whitespace, and empty-value differences", () => {
  const baseline = snapshot(makeCase());
  const local = snapshot(makeCase({ platform: " app ", device: "" }));
  const remote = snapshot(makeCase({ platform: "APP", device: "   " }));
  const preview = compareSnapshots(baseline, local, remote);
  assert.equal(preview.conflicts.length, 0);
  assert.equal(preview.state, "synced");
});

test("automatically accepts a change made on only one side", () => {
  const baseline = snapshot(makeCase());
  const local = snapshot(makeCase({ name: "Changed locally" }));
  const remote = snapshot(makeCase());
  const preview = compareSnapshots(baseline, local, remote);
  assert.equal(preview.conflicts.length, 0);
  assert.equal(preview.state, "local_ahead");
  assert.equal(preview.merged.cases["TC-1"].name, "Changed locally");
});

test("reports only a field changed differently on both sides", () => {
  const baseline = snapshot(makeCase({ name: "Before" }));
  const local = snapshot(makeCase({ name: "Local" }));
  const remote = snapshot(makeCase({ name: "Google" }));
  const preview = compareSnapshots(baseline, local, remote);
  assert.equal(preview.state, "conflict");
  assert.deepEqual(preview.conflicts.map((item) => item.path), ["cases.TC-1.name"]);
});

test("merges identical cases independently created on both sides", () => {
  const value = makeCase();
  const preview = compareSnapshots(snapshot(), snapshot(value), snapshot({ ...value, platform: "app" }));
  assert.equal(preview.conflicts.length, 0);
  assert.equal(Object.keys(preview.merged.cases).length, 1);
});

test("unions results with different stable ids without conflict", () => {
  const baseline = snapshot(makeCase());
  const local = snapshot(makeCase({ results: { "web:r-1": { id: "R-1", status: "Pass", actualResult: "ok", apiResponse: "", log: "", createdAt: "", customFields: {} } } }));
  const remote = snapshot(makeCase({ results: { "web:r-2": { id: "R-2", status: "Pass", actualResult: "ok", apiResponse: "", log: "", createdAt: "", customFields: {} } } }));
  const preview = compareSnapshots(baseline, local, remote);
  assert.equal(preview.conflicts.length, 0);
  assert.deepEqual(Object.keys(preview.merged.cases["TC-1"].results), ["web:r-1", "web:r-2"]);
});
