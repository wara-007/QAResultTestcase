import assert from "node:assert/strict";
import test from "node:test";
import type { TestCase } from "../types";
import { canonicalizeCases } from "./canonical";
import { detectBootstrapCaseConflicts, detectCaseConflicts, detectThreeWayCaseConflicts, mergeCaseChoices } from "./client-conflicts";

const makeCase = (id: string, name: string): TestCase => ({ id, name, sourceRow: 2, platform: "Web", condition: "", scenario: "", steps: "", expected: "", status: "Not Start", device: "", testData: "", appVersion: "", environment: "", resultReference: "", executedBy: "", executedDate: "", executedTime: "", remark: "", evidence: [], results: [], defects: [] });

test("detects same id with different content", () => {
  const conflicts = detectCaseConflicts([makeCase("TC-05", "Local")], [makeCase("tc05", "Google")]);
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].id, "TC-5");
});

test("does not flag identical cases", () => {
  assert.equal(detectCaseConflicts([makeCase("TC-05", "Same")], [makeCase("TC05", "Same")]).length, 0);
});

test("flags an identical same-id case when that id was created locally after the last sheet load", () => {
  const conflicts = detectCaseConflicts(
    [makeCase("TC-05", "Same")],
    [makeCase("TC05", "Same")],
    new Set(["TC-05"]),
  );
  assert.equal(conflicts.length, 1);
  assert.deepEqual(conflicts[0].changedFields, ["เพิ่มใหม่ทั้งสองฝั่ง"]);
});

test("detects differences in Results, Defects, and custom fields", () => {
  const local = makeCase("TC-05", "Same");
  const google = makeCase("TC05", "Same");
  google.results = [{ id: "R-1", status: "Failed", actualResult: "error", apiResponse: "", log: "", evidence: [], createdAt: "2026-09-25T00:00:00Z" }];
  const conflict = detectCaseConflicts([local], [google])[0];
  assert.ok(conflict.changedFields.includes("results"));
});

test("choice can keep Google case and preserve local-only cases", () => {
  const local = [makeCase("TC-05", "Local"), makeCase("TC-06", "Only local")];
  const remote = [makeCase("TC05", "Google")];
  const merged = mergeCaseChoices(local, remote, { "TC-5": { side: "google" } });
  assert.equal(merged.find((item) => item.id === "TC05")?.name, "Google");
  assert.equal(merged.some((item) => item.id === "TC-06"), true);
});

test("keep both requires and applies a unique id", () => {
  const local = [makeCase("TC-05", "Local")];
  const remote = [makeCase("TC05", "Google")];
  assert.throws(() => mergeCaseChoices(local, remote, { "TC-5": { side: "both", newId: "TC-05" } }), /ไม่ซ้ำ/);
  const merged = mergeCaseChoices(local, remote, { "TC-5": { side: "both", newId: "TC-05-GS" } });
  assert.deepEqual(merged.map((item) => item.id).sort(), ["TC-05", "TC-05-GS"]);
});

test("three-way detection ignores old differences already recorded in the baseline", () => {
  const baselineCase = makeCase("TC-35", "Google before");
  const local = makeCase("TC-35", "Local now");
  const google = makeCase("TC-35", "Google before");
  assert.equal(detectThreeWayCaseConflicts([local], [google], canonicalizeCases([baselineCase])).length, 0);
});

test("three-way detection reports a field changed differently on both sides", () => {
  const baselineCase = makeCase("TC-35", "Before");
  const conflicts = detectThreeWayCaseConflicts(
    [makeCase("TC-35", "Local")],
    [makeCase("TC-35", "Google")],
    canonicalizeCases([baselineCase]),
  );
  assert.equal(conflicts.length, 1);
  assert.deepEqual(conflicts[0].changedFields, ["name"]);
});

test("bootstrap ignores execution-only differences from legacy synchronized cases", () => {
  const local = makeCase("TC-01", "Same");
  local.platform = "App";
  local.executedBy = "Tester";
  local.results = [{ id: "R-1", status: "Pass", actualResult: "ok", apiResponse: "", log: "", evidence: [], createdAt: "2026-09-25" }];
  const google = makeCase("TC-01", "Same");
  assert.equal(detectBootstrapCaseConflicts([local], [google]).length, 0);
});

test("bootstrap reports different testcase definitions such as TC-35", () => {
  const local = makeCase("TC-35", "dddd");
  local.scenario = "local scenario";
  const google = makeCase("TC-35", "Google package");
  google.scenario = "google scenario";
  const conflicts = detectBootstrapCaseConflicts([local], [google]);
  assert.equal(conflicts.length, 1);
  assert.deepEqual(conflicts[0].changedFields, ["name", "scenario"]);
});

test("bootstrap ignores invisible unicode and whitespace-only formatting differences", () => {
  const local = makeCase("TC-02", "Validate IR Package");
  local.scenario = "Display Special price add-on deals\ncorrect - Display Maximum 5 packages";
  local.condition = "แพ็กเกจ：พร้อมใช้งาน";
  const google = makeCase("TC02", "Validate\u00a0IR\u200b Package");
  google.scenario = "  Display   Special price add-on deals  \r\n correct - Display Maximum 5 packages ";
  google.condition = "แพ็กเกจ:พร้อมใช้งาน";

  assert.equal(detectBootstrapCaseConflicts([local], [google]).length, 0);
});

test("three-way detection ignores invisible unicode and whitespace-only formatting differences", () => {
  const baselineCase = makeCase("TC-02", "Validate IR Package");
  baselineCase.scenario = "Display Special price add-on deals";
  const local = { ...baselineCase, scenario: "Display  Special price add-on deals" };
  const google = { ...baselineCase, scenario: "Display\u00a0Special\u200b price add-on deals" };

  assert.equal(detectThreeWayCaseConflicts([local], [google], canonicalizeCases([baselineCase])).length, 0);
});
