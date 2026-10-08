import type { PersonalCase } from "./personal-test-performance";
import { summarizeSprint } from "./sprint-summary";
import { isUnnamedSheetSkip } from "./sheet-skip-tester";
export type RegisterPerformanceRow = { id: string; project_id: string; testcase_key: string; case_name: string; source_row: number | null; steps: string; expected_result: string; test_executions: { attempt_no: number; status: string; executed_by_name: string; result_reference?: string }[] | null };
export function personalRegisterCases(rows: RegisterPerformanceRow[], projects: { id: string; name: string }[], groupId: string, sprintId: string, previous: PersonalCase[]): PersonalCase[] {
  const historical = previous.filter(item => item.currentSprintId !== sprintId);
  const current = rows.filter(row => summarizeSprint([{ id: row.project_id, approvals: [], cases: [{ testcaseKey: row.testcase_key, sourceRow: row.source_row ?? 0, steps: row.steps, expected: row.expected_result, executions: [] }] }]).totalCases > 0).map(row => {
    const latest = [...(row.test_executions ?? [])].sort((a, b) => b.attempt_no - a.attempt_no)[0];
    let testerName = latest?.executed_by_name ?? "";
    if (latest?.status === "Skip" && latest.result_reference?.startsWith("qa-results:")) {
      try {
        const payload = JSON.parse(latest.result_reference.slice(11));
        if (Array.isArray(payload.stepDefinitions) && isUnnamedSheetSkip(payload.stepDefinitions, Array.isArray(payload.results) ? payload.results : [])) testerName = "";
      } catch { /* Legacy references preserve their recorded tester. */ }
    }
    const assigned = previous.filter(item => item.projectId === row.project_id && item.caseId === row.testcase_key).flatMap(item => item.assignedUserIds);
    return {
      projectId: row.project_id, projectName: projects.find(project => project.id === row.project_id)?.name ?? "", currentSprintId: sprintId,
      caseId: row.testcase_key, caseName: row.case_name, sourceRowKey: "", detailPath: `/groups/${encodeURIComponent(groupId)}/projects/${row.project_id}/test-cases/${encodeURIComponent(row.testcase_key)}`,
      assignedUserIds: [...new Set(assigned)],
      results: latest ? [{ id: `register:${row.id}`, testerName, status: latest.status, source: (row.source_row ?? 0) > 0 ? "sheets" as const : "web" as const, sourceSheet: "", recordedAt: "", order: latest.attempt_no, inferred: true }] : [],
    };
  });
  return [...current, ...historical];
}
