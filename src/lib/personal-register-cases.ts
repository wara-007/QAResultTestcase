import type { PersonalCase } from "./personal-test-performance";
import { summarizeSprint } from "./sprint-summary";
import { isUnnamedSheetSkip } from "./sheet-skip-tester";
import { parseFlexibleDate } from './date-format';
export type RegisterPerformanceRow = { id: string; project_id: string; testcase_key: string; case_name: string; source_row: number | null; steps: string; expected_result: string; test_executions: { attempt_no: number; status: string; executed_by_name: string; result_reference?: string; executed_date?:string; executed_time?:string }[] | null };
function executionDate(date='',time='') {
  const parsed=parseFlexibleDate(date);
  if(!parsed) return '';
  const dayFirst=date.trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  const iso=/^\d{4}-\d{2}-\d{2}$/.test(date.trim()) ? date.trim() : dayFirst ? `${Number(dayFirst[3])>2400 ? Number(dayFirst[3])-543 : dayFirst[3]}-${dayFirst[2].padStart(2,'0')}-${dayFirst[1].padStart(2,'0')}` : parsed.toISOString().slice(0,10);
  const clock=time.trim().match(/^([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/);
  return clock ? `${iso}T${clock[1].padStart(2,'0')}:${clock[2]}:${clock[3] ?? '00'}+07:00` : iso;
}
export function personalRegisterCases(rows: RegisterPerformanceRow[], projects: { id: string; name: string }[], groupId: string, sprintId: string, previous: PersonalCase[]): PersonalCase[] {
  const historical = previous.filter(item => item.currentSprintId !== sprintId);
  const current = rows.filter(row => summarizeSprint([{ id: row.project_id, approvals: [], cases: [{ testcaseKey: row.testcase_key, sourceRow: row.source_row ?? 0, steps: row.steps, expected: row.expected_result, executions: [] }] }]).totalCases > 0).flatMap<PersonalCase>(row => {
    const metadata = previous.filter(item => item.currentSprintId === sprintId && item.projectId === row.project_id && item.caseId === row.testcase_key);
    // Detailed Results contain the actual tester and source-specific history.
    // The register summary is only a fallback for cases without those Results.
    // In particular, a Not Start summary must never erase a real Pass/Fail.
    if (metadata.some(item => item.results.some(result => result.id !== "legacy"))) {
      const sources = new Map<string, PersonalCase>();
      for (const item of metadata) {
        const results = item.results.filter(result => result.id !== "legacy");
        if (!results.length && !item.assignedUserIds.length) continue;
        const existing = sources.get(item.sourceRowKey);
        sources.set(item.sourceRowKey, {
          ...item,
          results: [...new Map([...(existing?.results ?? []), ...results].map(result => [JSON.stringify([result.id, result.sourceSheet]), result])).values()],
          assignedUserIds: [...new Set([...(existing?.assignedUserIds ?? []), ...item.assignedUserIds])],
        });
      }
      return [...sources.values()];
    }
    const latest = [...(row.test_executions ?? [])].sort((a, b) => b.attempt_no - a.attempt_no)[0];
    let testerName = latest?.executed_by_name ?? "";
    if (latest?.status === "Skip" && latest.result_reference?.startsWith("qa-results:")) {
      try {
        const payload = JSON.parse(latest.result_reference.slice(11));
        if (Array.isArray(payload.stepDefinitions) && isUnnamedSheetSkip(payload.stepDefinitions, Array.isArray(payload.results) ? payload.results : [])) testerName = "";
      } catch { /* Legacy references preserve their recorded tester. */ }
    }
    const assigned = metadata.flatMap(item => item.assignedUserIds);
    return [{
      projectId: row.project_id, projectName: projects.find(project => project.id === row.project_id)?.name ?? "", currentSprintId: sprintId,
      caseId: row.testcase_key, caseName: row.case_name, sourceRowKey: "", detailPath: `/groups/${encodeURIComponent(groupId)}/projects/${row.project_id}/test-cases/${encodeURIComponent(row.testcase_key)}`,
      assignedUserIds: [...new Set(assigned)],
      results: latest ? [{ id: `register:${row.id}`, testerName, status: latest.status, source: (row.source_row ?? 0) > 0 ? "sheets" as const : "web" as const, sourceSheet: "", recordedAt: executionDate(latest.executed_date,latest.executed_time), order: latest.attempt_no, inferred: true }] : [],
    }];
  });
  return [...current, ...historical];
}
