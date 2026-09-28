import assert from "node:assert/strict";
import test from "node:test";
import type { TestCase } from "../types";
import { canonicalCaseId, canonicalChildId, canonicalizeCases, hashSnapshot } from "./canonical";

const makeCase = (overrides: Partial<TestCase> = {}): TestCase => ({
  id: "TC-01", sourceRow: 2, platform: "Web", condition: "", scenario: "S", name: "N", steps: "Step", expected: "Expected",
  status: "Not Start", device: "", testData: "", appVersion: "", environment: "SIT", resultReference: "", executedBy: "",
  executedDate: "", executedTime: "", remark: "", evidence: [], results: [], defects: [], ...overrides,
});

test("normalizes identifiers without rewriting user values", () => {
  const snapshot = canonicalizeCases([makeCase({ id: "tc05", remark: "  Keep spacing  " })]);
  assert.equal(snapshot.cases["TC-5"].remark, "  Keep spacing  ");
  assert.equal(canonicalCaseId("TC-05"), "TC-5");
});

test("uses source sheet with child id", () => {
  assert.notEqual(canonicalChildId("Run 1", "R-1"), canonicalChildId("Run 2", "R-1"));
});

test("produces stable hash regardless of input order", () => {
  const first = canonicalizeCases([makeCase({ id: "TC-02" }), makeCase({ id: "TC-01" })]);
  const second = canonicalizeCases([makeCase({ id: "TC-01" }), makeCase({ id: "TC-02" })]);
  assert.equal(hashSnapshot(first), hashSnapshot(second));
});
