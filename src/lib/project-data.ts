import { createClient } from "@/lib/supabase/client";
import type { TestCase, TestResult, TestStatus, WorkbookSheet, WorkbookSource } from "@/lib/types";

const SOURCE_BUCKET = "testcase-source-files";
const SOURCE_CHUNK_SIZE = 8 * 1024 * 1024;

type SourceRow = {
  id: string;
  original_name: string;
  storage_key: string;
  sheet_name: string;
  column_mapping: Record<string, unknown> | null;
};

type ExecutionRow = {
  id: string;
  status: TestStatus;
  device: string;
  app_version: string;
  environment: string;
  remark: string;
  result_reference: string;
  executed_by_name: string;
  executed_date: string;
  executed_time: string;
  attempt_no: number;
};

type CaseRow = {
  id: string;
  testcase_key: string;
  source_row: number | null;
  sort_order: number;
  platform: string;
  condition_text: string;
  scenario: string;
  case_name: string;
  steps: string;
  expected_result: string;
  test_data: string;
  test_executions: ExecutionRow[] | null;
};

type StoredResultPayload = {
  version: 1;
  resultReference: string;
  results: TestResult[];
};

function parseStoredResults(value: string | undefined) {
  if (!value?.startsWith("qa-results:")) return { resultReference: value ?? "", results: [] as TestResult[], persistedLocally: false };
  try {
    const payload = JSON.parse(value.slice("qa-results:".length)) as StoredResultPayload;
    return {
      resultReference: typeof payload.resultReference === "string" ? payload.resultReference : "",
      results: Array.isArray(payload.results) ? payload.results : [],
      persistedLocally: true,
    };
  } catch {
    return { resultReference: "", results: [] as TestResult[], persistedLocally: false };
  }
}

function serializeStoredResults(testCase: TestCase) {
  const payload: StoredResultPayload = { version: 1, resultReference: testCase.resultReference, results: testCase.results ?? [] };
  return `qa-results:${JSON.stringify(payload)}`;
}

export type ProjectWorkspace = {
  cases: TestCase[];
  source: WorkbookSource | null;
};

export async function loadProjectWorkspace(projectId: string): Promise<ProjectWorkspace> {
  const supabase = createClient();
  const [sourceResult, casesResult] = await Promise.all([
    supabase
      .from("source_files")
      .select("id, original_name, storage_key, sheet_name, column_mapping")
      .eq("project_id", projectId)
      .order("version_no", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("test_cases")
      .select("id, testcase_key, source_row, sort_order, platform, condition_text, scenario, case_name, steps, expected_result, test_data, test_executions(id, status, device, app_version, environment, remark, result_reference, executed_by_name, executed_date, executed_time, attempt_no)")
      .eq("project_id", projectId)
      .order("sort_order", { ascending: true }),
  ]);

  if (sourceResult.error) throw new Error(sourceResult.error.message);
  if (casesResult.error) throw new Error(casesResult.error.message);

  let source: WorkbookSource | null = null;
  const sourceRow = sourceResult.data as SourceRow | null;
  if (sourceRow) {
    const mapping = sourceRow.column_mapping ?? {};
    const chunkCount = typeof mapping.chunkCount === "number" ? mapping.chunkCount : 0;
    let buffer: ArrayBuffer;
    if (chunkCount > 0) {
      const downloads = await Promise.all(Array.from({ length: chunkCount }, (_, index) =>
        supabase.storage.from(SOURCE_BUCKET).download(`${sourceRow.storage_key}/part-${String(index).padStart(3, "0")}`),
      ));
      const failed = downloads.find((download) => download.error);
      if (failed?.error) throw new Error(`โหลดไฟล์ต้นฉบับไม่สำเร็จ: ${failed.error.message}`);
      buffer = await new Blob(downloads.map((download) => download.data as Blob)).arrayBuffer();
    } else {
      const download = await supabase.storage.from(SOURCE_BUCKET).download(sourceRow.storage_key);
      if (download.error) throw new Error(`โหลดไฟล์ต้นฉบับไม่สำเร็จ: ${download.error.message}`);
      buffer = await download.data.arrayBuffer();
    }
    const sheetPath = typeof mapping.sheetPath === "string" ? mapping.sheetPath : "";
    const sheets = Array.isArray(mapping.sheets) ? mapping.sheets as WorkbookSheet[] : [];
    const columns = Object.fromEntries(Object.entries(mapping).filter(([key, value]) =>
      key !== "sheetPath" && key !== "chunkCount" && key !== "sheets" && typeof value === "string",
    )) as Record<string, string>;
    source = {
      id: sourceRow.id,
      fileName: sourceRow.original_name,
      buffer,
      sheetName: sourceRow.sheet_name,
      sheetPath,
      columns,
      sheets,
    };
  }

  const cases = ((casesResult.data ?? []) as CaseRow[]).map((row) => {
    const execution = [...(row.test_executions ?? [])].sort((a, b) => b.attempt_no - a.attempt_no)[0];
    const stored = parseStoredResults(execution?.result_reference);
    return {
      id: row.testcase_key,
      recordId: row.id,
      executionId: execution?.id,
      persistedLocally: stored.persistedLocally,
      sourceRow: row.source_row ?? 0,
      platform: row.platform,
      condition: row.condition_text,
      scenario: row.scenario,
      name: row.case_name,
      steps: row.steps,
      expected: row.expected_result,
      status: execution?.status ?? "Not Start",
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
      results: stored.results,
    };
  });

  return { cases, source };
}

export async function persistImportedWorkbook(projectId: string, cases: TestCase[], source: WorkbookSource, persistCases = true) {
  const supabase = createClient();
  const sourceId = crypto.randomUUID();
  const safeName = source.fileName.replace(/[^a-zA-Z0-9._-]+/g, "_");
  const storageKey = `${projectId}/${sourceId}/${safeName}`;
  const contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const file = new Blob([source.buffer], { type: contentType });
  const chunkCount = Math.ceil(file.size / SOURCE_CHUNK_SIZE);
  for (let index = 0; index < chunkCount; index += 1) {
    const chunk = file.slice(index * SOURCE_CHUNK_SIZE, Math.min((index + 1) * SOURCE_CHUNK_SIZE, file.size));
    const upload = await supabase.storage
      .from(SOURCE_BUCKET)
      .upload(`${storageKey}/part-${String(index).padStart(3, "0")}`, chunk, {
        contentType: "application/octet-stream",
        upsert: false,
      });
    if (upload.error) throw new Error(`อัปโหลดไฟล์ต้นฉบับส่วนที่ ${index + 1}/${chunkCount} ไม่สำเร็จ: ${upload.error.message}`);
  }

  const versionResult = await supabase
    .from("source_files")
    .select("version_no")
    .eq("project_id", projectId)
    .order("version_no", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (versionResult.error) throw new Error(versionResult.error.message);

  const sourceInsert = await supabase.from("source_files").insert({
    id: sourceId,
    project_id: projectId,
    original_name: source.fileName,
    storage_provider: "supabase",
    storage_key: storageKey,
    byte_size: source.buffer.byteLength,
    sheet_name: source.sheetName,
    column_mapping: { ...source.columns, sheetPath: source.sheetPath, chunkCount, sheets: source.sheets },
    version_no: (versionResult.data?.version_no ?? 0) + 1,
    uploaded_by: null,
  });
  if (sourceInsert.error) throw new Error(sourceInsert.error.message);

  if (!persistCases) return { cases, source: { ...source, id: sourceId } };

  const caseResult = await supabase
    .from("test_cases")
    .upsert(cases.map((testCase, index) => ({
      project_id: projectId,
      source_file_id: sourceId,
      testcase_key: testCase.id,
      source_row: testCase.sourceRow,
      sort_order: index,
      platform: testCase.platform,
      condition_text: testCase.condition,
      scenario: testCase.scenario,
      case_name: testCase.name,
      steps: testCase.steps,
      expected_result: testCase.expected,
      test_data: testCase.testData,
    })), { onConflict: "project_id,testcase_key" })
    .select("id, testcase_key");
  if (caseResult.error) throw new Error(caseResult.error.message);

  const caseIds = new Map((caseResult.data ?? []).map((row) => [row.testcase_key, row.id]));
  const executionResult = await supabase
    .from("test_executions")
    .upsert(cases.map((testCase) => ({
      project_id: projectId,
      test_case_id: caseIds.get(testCase.id),
      attempt_no: 1,
      status: testCase.status,
      device: testCase.device,
      app_version: testCase.appVersion,
      environment: testCase.environment,
      remark: testCase.remark,
      result_reference: testCase.resultReference,
      executed_by_name: testCase.executedBy,
      executed_date: testCase.executedDate,
      executed_time: testCase.executedTime,
      executed_by: null,
    })), { onConflict: "test_case_id,attempt_no" });
  if (executionResult.error) throw new Error(executionResult.error.message);

  return loadProjectWorkspace(projectId);
}

export async function persistTestCaseResult(projectId: string, testCase: TestCase) {
  const supabase = createClient();
  let recordId = testCase.recordId;
  if (!recordId) {
    const inserted = await supabase.from("test_cases").upsert({
      project_id: projectId,
      testcase_key: testCase.id,
      source_row: testCase.sourceRow || null,
      platform: testCase.platform,
      condition_text: testCase.condition,
      scenario: testCase.scenario,
      case_name: testCase.name,
      steps: testCase.steps,
      expected_result: testCase.expected,
      test_data: testCase.testData,
    }, { onConflict: "project_id,testcase_key" }).select("id").single();
    if (inserted.error) throw new Error(inserted.error.message);
    recordId = inserted.data.id;
  }
  const caseUpdate = await supabase
    .from("test_cases")
    .update({
      platform: testCase.platform,
      test_data: testCase.testData,
    })
    .eq("id", recordId)
    .eq("project_id", projectId);
  if (caseUpdate.error) throw new Error(caseUpdate.error.message);

  const execution = {
    project_id: projectId,
    test_case_id: recordId,
    attempt_no: 1,
    status: testCase.status,
    device: testCase.device,
    app_version: testCase.appVersion,
    environment: testCase.environment,
    remark: testCase.remark,
    result_reference: serializeStoredResults(testCase),
    executed_by_name: testCase.executedBy,
    executed_date: testCase.executedDate,
    executed_time: testCase.executedTime,
    executed_by: null,
    executed_at: new Date().toISOString(),
  };
  const result = await supabase
    .from("test_executions")
    .upsert(execution, { onConflict: "test_case_id,attempt_no" })
    .select("id")
    .single();
  if (result.error) throw new Error(result.error.message);
  return { ...testCase, recordId, executionId: result.data.id, persistedLocally: true };
}
