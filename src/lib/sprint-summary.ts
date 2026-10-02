export type SprintProjectStatsInput = {
  id: string;
  cases: { executions: { attempt_no: number; status: string; result_reference: string }[] }[];
  approvals: { status: string }[];
};
export function summarizeSprint(projects: SprintProjectStatsInput[]) {
  const summary = { projects: projects.length, totalCases: 0, pass: 0, failed: 0, inProgress: 0, notStart: 0, skip: 0, openDefects: 0, totalDefects: 0, closedDefects: 0, approvedProjects: 0, pendingApprovalProjects: 0, progress: 0 };
  for (const project of projects) {
    if (project.approvals.some((item) => item.status === "pending")) summary.pendingApprovalProjects++;
    else if (project.approvals.some((item) => item.status === "approved")) summary.approvedProjects++;
    for (const testCase of project.cases) {
      summary.totalCases++;
      const latest = [...testCase.executions].sort((a, b) => b.attempt_no - a.attempt_no)[0];
      const fields: Record<string, "pass" | "failed" | "inProgress" | "skip"> = { Pass: "pass", Failed: "failed", "In Progress": "inProgress", Skip: "skip" };
      const field = fields[latest?.status ?? ""] ?? "notStart";
      summary[field]++;
      if (latest?.result_reference.startsWith("qa-results:")) {
        try {
          const payload = JSON.parse(latest.result_reference.slice(11));
          summary.totalDefects += Array.isArray(payload.defects) ? payload.defects.length : 0;
          summary.openDefects += (payload.defects ?? []).filter((defect: { status?: string }) => !["closed", "resolved", "pass", "passed"].includes((defect.status ?? "open").toLowerCase())).length;
        } catch { /* Legacy non-JSON references do not contain Defect data. */ }
      }
    }
  }
  summary.progress = summary.totalCases ? Math.round((summary.pass + summary.failed + summary.skip) / summary.totalCases * 100) : 0;
  summary.closedDefects = summary.totalDefects - summary.openDefects;
  return summary;
}
