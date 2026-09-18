import "server-only";

import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { readGoogleSheet } from "@/lib/google-sheets";
import type { TestCase, TestCaseCustomField, TestDefect, TestResult, TestStatus } from "@/lib/types";

export type ApprovalStatus = "pending" | "approved" | "changes_requested" | "revoked";

export type ProjectReview = {
  request: {
    id: string;
    recipientEmail: string;
    status: ApprovalStatus;
    requestedByName: string;
    requestedAt: string;
    expiresAt: string;
    reviewedAt: string;
    reviewerName: string;
    reviewerComment: string;
  };
  project: {
    id: string;
    name: string;
    description: string;
    sprintNo: string;
    environment: string;
    googleSheetUrl: string;
  };
  cases: TestCase[];
};

type StoredPayload = { resultReference?: string; results?: TestResult[]; defects?: TestDefect[]; customFields?: TestCaseCustomField[]; resultFieldDefinitions?: TestCase["resultFieldDefinitions"] };
type ReviewCaseRow = { id: string; testcase_key: string; source_row: number | null; sort_order: number; platform: string; condition_text: string; scenario: string; case_name: string; steps: string; expected_result: string; test_data: string };
type ReviewExecutionRow = { id: string; test_case_id: string; status: string; device: string; app_version: string; environment: string; remark: string; result_reference: string; executed_by_name: string; executed_date: string; executed_time: string; attempt_no: number };
type ApprovalRow = { id: string; project_id: string; recipient_email: string; status: string; requested_by_name: string; requested_at: string; expires_at: string; reviewed_at: string | null; reviewer_name: string; reviewer_comment: string };
const approvalColumns = "id, project_id, recipient_email, status, requested_by_name, requested_at, expires_at, reviewed_at, reviewer_name, reviewer_comment";

export function hashReviewToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function resolveReviewRequestId(rawToken: string) {
  if (!/^[A-Za-z0-9_-]{40,100}$/.test(rawToken)) return null;
  const result = await createAdminClient().from("project_approval_requests").select("id")
    .eq("token_hash", hashReviewToken(rawToken)).neq("status", "revoked").maybeSingle();
  if (result.error) throw new Error(result.error.message);
  return result.data?.id ?? null;
}

function parseStoredResults(value: string | null) {
  if (!value?.startsWith("qa-results:")) return { resultReference: value ?? "", results: [] as TestResult[], defects: [] as TestDefect[], customFields: [] as TestCaseCustomField[], resultFieldDefinitions: [] };
  try {
    const payload = JSON.parse(value.slice("qa-results:".length)) as StoredPayload;
    const results = Array.isArray(payload.results) ? payload.results.map((result) => ({ ...result, defects: undefined })) : [];
    const oldDefects = Array.isArray(payload.results) ? payload.results.flatMap((result) => result.defects ?? []) : [];
    return {
      resultReference: typeof payload.resultReference === "string" ? payload.resultReference : "",
      results,
      defects: Array.isArray(payload.defects) ? payload.defects : oldDefects,
      customFields: Array.isArray(payload.customFields) ? payload.customFields : [],
      resultFieldDefinitions: Array.isArray(payload.resultFieldDefinitions) ? payload.resultFieldDefinitions : [],
    };
  } catch {
    return { resultReference: "", results: [] as TestResult[], defects: [] as TestDefect[], customFields: [] as TestCaseCustomField[], resultFieldDefinitions: [] };
  }
}

export async function loadProjectReview(rawToken: string): Promise<ProjectReview | null> {
  if (!/^[A-Za-z0-9_-]{40,100}$/.test(rawToken)) return null;
  const admin = createAdminClient();
  const requestResult = await admin
    .from("project_approval_requests")
    .select(approvalColumns)
    .eq("token_hash", hashReviewToken(rawToken))
    .maybeSingle();
  if (requestResult.error) throw new Error(requestResult.error.message);
  const approval = requestResult.data as ApprovalRow | null;
  if (!approval || approval.status === "revoked") return null;
  return buildProjectReview(approval);
}

export async function loadRecipientProjectReview(requestId: string, recipientEmail: string): Promise<ProjectReview | null> {
  const admin = createAdminClient();
  const result = await admin.from("project_approval_requests").select(approvalColumns)
    .eq("id", requestId).eq("recipient_email", recipientEmail.trim().toLowerCase()).maybeSingle();
  if (result.error) throw new Error(result.error.message);
  const approval = result.data as ApprovalRow | null;
  if (!approval || approval.status === "revoked") return null;
  return buildProjectReview(approval);
}

async function buildProjectReview(approval: ApprovalRow): Promise<ProjectReview> {
  const admin = createAdminClient();
  const fetchAllCases = async () => {
    const rows: ReviewCaseRow[] = [];
    const batchSize = 500;
    for (let from = 0; ; from += batchSize) {
      const result = await admin.from("test_cases").select("id, testcase_key, source_row, sort_order, platform, condition_text, scenario, case_name, steps, expected_result, test_data").eq("project_id", approval.project_id).order("sort_order").order("source_row").range(from, from + batchSize - 1);
      if (result.error) throw new Error(result.error.message);
      const batch = (result.data ?? []) as ReviewCaseRow[];
      rows.push(...batch);
      if (batch.length < batchSize) return rows;
    }
  };
  const fetchAllExecutions = async () => {
    const rows: ReviewExecutionRow[] = [];
    const batchSize = 500;
    for (let from = 0; ; from += batchSize) {
      const result = await admin.from("test_executions").select("id, test_case_id, status, device, app_version, environment, remark, result_reference, executed_by_name, executed_date, executed_time, attempt_no").eq("project_id", approval.project_id).order("attempt_no", { ascending: false }).range(from, from + batchSize - 1);
      if (result.error) throw new Error(result.error.message);
      const batch = (result.data ?? []) as ReviewExecutionRow[];
      rows.push(...batch);
      if (batch.length < batchSize) return rows;
    }
  };

  const [projectResult, caseRows, executionRows] = await Promise.all([
    admin.from("projects").select("id, name, description, sprint_no, environment, google_sheet_id, google_sheet_url").eq("id", approval.project_id).single(),
    fetchAllCases(),
    fetchAllExecutions(),
  ]);
  if (projectResult.error) throw new Error(projectResult.error.message);

  const executions = new Map<string, ReviewExecutionRow>();
  for (const execution of executionRows) if (!executions.has(execution.test_case_id)) executions.set(execution.test_case_id, execution);
  let previousScenario = "";
  let previousSteps = "";
  const storedCases: TestCase[] = caseRows.map((row) => {
    const execution = executions.get(row.id);
    const stored = parseStoredResults(execution?.result_reference ?? null);
    const scenario = row.scenario || previousScenario;
    const steps = row.steps || previousSteps;
    if (scenario) previousScenario = scenario;
    if (steps) previousSteps = steps;
    return {
      id: row.testcase_key,
      recordId: row.id,
      executionId: execution?.id,
      sourceRow: row.source_row ?? 0,
      platform: row.platform,
      condition: row.condition_text,
      scenario,
      name: row.case_name,
      steps,
      expected: row.expected_result,
      status: (execution?.status ?? "Not Start") as TestStatus,
      device: execution?.device ?? "",
      testData: row.test_data,
      appVersion: execution?.app_version ?? "",
      environment: execution?.environment ?? "",
      resultReference: stored.resultReference,
      executedBy: execution?.executed_by_name ?? "",
      executedDate: execution?.executed_date ?? "",
      executedTime: execution?.executed_time ?? "",
      remark: execution?.remark ?? "",
      evidence: [],
      customFields: stored.customFields,
      resultFieldDefinitions: stored.resultFieldDefinitions,
      results: stored.results,
      defects: stored.defects,
    };
  });
  const project = projectResult.data;
  let cases = storedCases;
  if (project.google_sheet_id) {
    let googleWorkspace: Awaited<ReturnType<typeof readGoogleSheet>> | null = null;
    try {
      googleWorkspace = await readGoogleSheet(project.google_sheet_id);
    } catch (error) {
      // A PO review must remain available even when the Google Sheet was not
      // shared with the service account (or Google is temporarily unavailable).
      // The persisted Supabase snapshot above is the source of truth for review.
      console.warn(
        `[project-review] Skipping Google Sheets enrichment for project ${project.id}:`,
        error instanceof Error ? error.message : "Unknown Google Sheets error",
      );
    }
    if (googleWorkspace) {
    const storedById = new Map(storedCases.map((testCase) => [testCase.id.trim().toUpperCase(), testCase]));
    const googleCases = googleWorkspace.cases.map((testCase) => {
      const stored = storedById.get(testCase.id.trim().toUpperCase());
      if (!stored) return testCase;
      const hasStoredResults = Boolean(stored.results?.length);
      const hasStoredDefects = Boolean(stored.defects?.length);
      const hasStoredExecution = Boolean(stored.persistedLocally || stored.executionId || hasStoredResults || hasStoredDefects);
      return {
        ...testCase,
        recordId: stored.recordId,
        executionId: stored.executionId,
        persistedLocally: stored.persistedLocally,
        results: hasStoredResults ? stored.results : testCase.results,
        defects: hasStoredDefects ? stored.defects : testCase.defects,
        customFields: (() => {
          const identity = (field: TestCaseCustomField) => `${field.source}:${field.label.trim().toLowerCase()}`;
          const storedFields = new Map((stored.customFields ?? []).map((field) => [identity(field), field]));
          const sheetFields = testCase.customFields ?? [];
          const sheetKeys = new Set(sheetFields.map(identity));
          return [
            ...sheetFields.map((field) => ({ ...field, value: storedFields.get(identity(field))?.value ?? field.value })),
            ...(stored.customFields ?? []).filter((field) => !sheetKeys.has(identity(field))),
          ];
        })(),
        resultFieldDefinitions: testCase.resultFieldDefinitions?.length ? testCase.resultFieldDefinitions : stored.resultFieldDefinitions,
        platform: hasStoredExecution ? stored.platform : testCase.platform,
        status: hasStoredExecution ? stored.status : testCase.status,
        device: hasStoredExecution ? stored.device : testCase.device,
        appVersion: hasStoredExecution ? stored.appVersion : testCase.appVersion,
        environment: hasStoredExecution ? stored.environment : testCase.environment,
        remark: hasStoredExecution ? stored.remark : testCase.remark,
        executedBy: hasStoredExecution ? stored.executedBy : testCase.executedBy,
        executedDate: hasStoredExecution ? stored.executedDate : testCase.executedDate,
        executedTime: hasStoredExecution ? stored.executedTime : testCase.executedTime,
        testData: hasStoredExecution ? stored.testData : testCase.testData,
        resultReference: hasStoredExecution ? stored.resultReference : testCase.resultReference,
      };
    });
    const googleIds = new Set(googleCases.map((testCase) => testCase.id.trim().toUpperCase()));
    cases = [...googleCases, ...storedCases.filter((testCase) => !googleIds.has(testCase.id.trim().toUpperCase()))];
    }
  }
  return {
    request: {
      id: approval.id,
      recipientEmail: approval.recipient_email,
      status: approval.status as ApprovalStatus,
      requestedByName: approval.requested_by_name,
      requestedAt: approval.requested_at,
      expiresAt: approval.expires_at,
      reviewedAt: approval.reviewed_at ?? "",
      reviewerName: approval.reviewer_name,
      reviewerComment: approval.reviewer_comment,
    },
    project: {
      id: project.id,
      name: project.name,
      description: project.description,
      sprintNo: project.sprint_no,
      environment: project.environment,
      googleSheetUrl: project.google_sheet_url ?? "",
    },
    cases,
  };
}
