import assert from "node:assert/strict";
import test from "node:test";
import { summarizeSprint } from "./sprint-summary";

test("counts the latest attempt once per case and open defects from saved Results", () => {
  const result = summarizeSprint([
    { id: "p1", cases: [
      { executions: [{ attempt_no: 1, status: "Failed", result_reference: "" }, { attempt_no: 2, status: "Pass", result_reference: 'qa-results:{"defects":[{"id":"d1","status":"Closed"},{"id":"d2","status":"Open"}]}' }] },
      { executions: [] },
    ], approvals: [{ status: "approved" }] },
    { id: "p2", cases: [{ executions: [{ attempt_no: 1, status: "In Progress", result_reference: "" }] }], approvals: [{ status: "pending" }, { status: "approved" }] },
  ]);
  assert.equal(result.projects, 2);
  assert.equal(result.totalCases, 3);
  assert.equal(result.pass, 1);
  assert.equal(result.notStart, 1);
  assert.equal(result.inProgress, 1);
  assert.equal(result.openDefects, 1);
  assert.equal(result.totalDefects, 2);
  assert.equal(result.closedDefects, 1);
  assert.equal(result.approvedProjects, 1);
  assert.equal(result.pendingApprovalProjects, 1);
});
test("an empty sprint has no fabricated progress", () => {
  assert.equal(summarizeSprint([]).progress, 0);
});
