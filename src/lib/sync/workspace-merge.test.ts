import assert from "node:assert/strict";
import test from "node:test";
import type { TestCase } from "../types";
import { mergeWorkspaceAndGoogleCases } from "./workspace-merge";

const makeCase = (id: string, name: string, persistedLocally = false): TestCase => ({
  id, name, persistedLocally, sourceRow: 2, platform: "", condition: "", scenario: "", steps: "", expected: "",
  status: "Not Start", device: "", testData: "", appVersion: "", environment: "", resultReference: "", executedBy: "",
  executedDate: "", executedTime: "", remark: "", evidence: [], results: [], defects: [],
});

test("keeps locally persisted testcase definition instead of hiding it with Google values", () => {
  const local = makeCase("TC-35", "Local dddd", true);
  local.scenario = "Local scenario";
  const google = makeCase("TC-35", "Google package");
  google.scenario = "Google scenario";
  const merged = mergeWorkspaceAndGoogleCases([local], [google], "Tester");
  assert.equal(merged.cases[0].name, "Local dddd");
  assert.equal(merged.cases[0].scenario, "Local scenario");
});

test("uses Google definition when no local edit was persisted", () => {
  const merged = mergeWorkspaceAndGoogleCases([makeCase("TC-01", "Stored")], [makeCase("TC-01", "Google")], "Tester");
  assert.equal(merged.cases[0].name, "Google");
});
