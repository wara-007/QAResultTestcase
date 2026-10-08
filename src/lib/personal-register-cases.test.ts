import test from "node:test";
import assert from "node:assert/strict";
import { personalRegisterCases } from "./personal-register-cases";
import { buildPersonalPerformance } from "./personal-test-performance";
import type { PersonalCase } from "./personal-test-performance";
test("old importer names are ignored when stored Sheet Steps explicitly Skip without a tester", () => {
  const cases = personalRegisterCases([{ id: "r", project_id: "p", testcase_key: "TC13", case_name: "C", source_row: 32, steps: "Step01", expected_result: "Map", test_executions: [{ attempt_no: 1, status: "Skip", executed_by_name: "wara pp", result_reference: 'qa-results:{"stepDefinitions":[{"status":"Skip","executedBy":""}],"results":[]}' }] }], [{ id: "p", name: "P" }], "g", "s", []);
  const stats = buildPersonalPerformance({ sprintId: "s", members: [], cases });
  assert.equal(stats[0].name, "ไม่ระบุผู้ทดสอบ");
  assert.equal(stats[0].skip, 1);
});

test("register outcomes count cases without detail Results and replace duplicate source tabs", () => {
  const rows = Array.from({ length: 15 }, (_, i) => ({ id: `r${i}`, project_id: "p", testcase_key: `TC${i + 1}`, case_name: "Case", source_row: i + 2, steps: "Step01", expected_result: "Correct", test_executions: [{ attempt_no: 1, status: i >= 12 && i < 14 ? "Skip" : "Pass", executed_by_name: i < 8 || i === 14 ? "Jaii" : i < 12 ? "Bum" : "" }] }));
  const cases = personalRegisterCases(rows, [{ id: "p", name: "Project" }], "g", "s", []);
  const stats = buildPersonalPerformance({ sprintId: "s", members: [], cases });
  assert.equal(cases.length, 15);
  assert.equal(stats.find(person => person.name === "Jaii")?.pass, 9);
  assert.equal(stats.find(person => person.name === "Bum")?.pass, 4);
  assert.equal(stats.find(person => person.key === "unknown")?.skip, 2);
});
test("one current register case replaces multiple tabs, excludes Cover, and retains moved history", () => {
  const base: PersonalCase = { projectId: "p", projectName: "P", currentSprintId: "s", caseId: "TC01", caseName: "C", sourceRowKey: "tab", detailPath: "/case", assignedUserIds: ["qa"], results: [] };
  const previous = [base, { ...base, sourceRowKey: "tab2" }, { ...base, projectId: "moved", currentSprintId: "next" }];
  const row = { id: "r", project_id: "p", testcase_key: "TC01", case_name: "C", source_row: 2, steps: "", expected_result: "", test_executions: [{ attempt_no: 2, status: "Pass", executed_by_name: "Jaii" }, { attempt_no: 1, status: "Failed", executed_by_name: "Bum" }] };
  const actual = personalRegisterCases([row, { ...row, id: "cover", testcase_key: "Cover" }], [{ id: "p", name: "P" }], "g", "s", previous);
  assert.equal(actual.length, 2);
  assert.equal(actual[0].results[0].testerName, "Jaii");
  assert.equal(actual[0].results[0].status, "Pass");
  assert.deepEqual(actual[0].assignedUserIds, ["qa"]);
  assert.equal(actual[1].projectId, "moved");
});
