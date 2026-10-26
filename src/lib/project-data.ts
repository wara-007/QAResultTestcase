import {buildProjectDashboardCounts,readProjectDashboardSummary,type ProjectDashboardSummary} from "./project-dashboard-summary";
import { writeProjectRowBatches } from "./project-row-batches";
import { storeSourceWorkbook, loadSourceWorkbookBytes } from "./source-workbook-storage";
import { uploadSourceChunks } from "./source-chunk-upload";
import { createClient } from "@/lib/supabase/client";
import { readSheetImportState } from "./sheet-import-state";
import type { SheetImportState } from "./sheet-import-state";
import type { RowLoadState } from "./result-preview";
import type { TestCase, TestStatus, WorkbookSheet, WorkbookSource } from "@/lib/types";
import { readAllRows } from "./paged-rows";
import { retryTimedOutProjectWrite, enqueueProjectDetailWrite } from "./project-detail-lock";

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

export { parseStoredResults, serializeStoredResults } from "./stored-results";
import { parseStoredResults, serializeStoredResults } from "./stored-results";

export type ProjectWorkspace = {
  cases: TestCase[];
  source: WorkbookSource | null;
};

export async function assembleWorkbookBytes({ chunkCount, storageKey, download, includeWorkbook }: {
  chunkCount: number;
  storageKey: string;
  download: (path: string) => Promise<Uint8Array>;
  includeWorkbook: boolean;
}) {
  if (!includeWorkbook) return new ArrayBuffer(0);
  const parts = chunkCount > 0
    ? await Promise.all(Array.from({ length: chunkCount }, (_, index) => download(`${storageKey}/part-${String(index).padStart(3, "0")}`)))
    : [await download(storageKey)];
  const length = parts.reduce((total, part) => total + part.byteLength, 0);
  const combined = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    combined.set(part, offset);
    offset += part.byteLength;
  }
  return combined.buffer;
}

async function downloadSourceWorkbook(projectId: string, sourceRow: SourceRow, includeWorkbook: boolean) {
  const supabase = createClient();
  const mapping = sourceRow.column_mapping ?? {};
  if (includeWorkbook && mapping.storageCleanup && !sourceRow.storage_key) throw new Error("ไฟล์รุ่นเก่าถูกนำออกจาก Storage แล้ว กรุณารีเฟรชหน้าเพื่อใช้ข้อมูลล่าสุด");
  const chunkCount = typeof mapping.chunkCount === "number" ? mapping.chunkCount : 0;
  return loadSourceWorkbookBytes({mapping,includeWorkbook,
    readSheets: async () => {
      const response = await fetch(`/api/projects/${projectId}/google-sheet/workbook?sourceId=${encodeURIComponent(sourceRow.id)}`, {cache:"no-store"});
      if (!response.ok) {
        const data=await response.json().catch(()=>null);
        throw new Error(data?.error ?? "โหลดไฟล์จาก Sheets ไม่สำเร็จ");
      }
      return response.arrayBuffer();
    },
    readStored: () => assembleWorkbookBytes({
    chunkCount,
    storageKey: sourceRow.storage_key,
    includeWorkbook,
    download: async (path) => {
      const result = await supabase.storage.from(SOURCE_BUCKET).download(path);
      if (result.error) throw new Error(`โหลดไฟล์ต้นฉบับไม่สำเร็จ: ${result.error.message}`);
      return new Uint8Array(await result.data.arrayBuffer());
    },
  })});
}

export async function loadProjectWorkbook(projectId: string, sourceId?: string) {
  const supabase = createClient();
  let query = supabase
    .from("source_files")
    .select("id, original_name, storage_key, sheet_name, column_mapping")
    .eq("project_id", projectId);
  if (sourceId) query = query.eq("id",sourceId);
  const result = await query.order("version_no", { ascending: false }).limit(1).maybeSingle();
  if (result.error) throw new Error(result.error.message);
  if (!result.data) throw new Error("ไม่พบไฟล์ต้นฉบับของ Project");
  return downloadSourceWorkbook(projectId, result.data as SourceRow, true);
}

export async function loadProjectWorkspace(projectId: string, options: { includeWorkbook?: boolean; summaryConsistent?: boolean } = {}): Promise<ProjectWorkspace> {
  const supabase = createClient();
  const sourceRequest=Promise.resolve(supabase
      .from("source_files")
      .select("id, original_name, storage_key, sheet_name, column_mapping")
      .eq("project_id", projectId)
      .order("version_no", { ascending: false })
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle());
  const readCases=()=>readAllRows<CaseRow>((start, end) => supabase
      .from("test_cases")
      .select("id, testcase_key, source_row, sort_order, platform, condition_text, scenario, case_name, steps, expected_result, test_data, test_executions(id, status, device, app_version, environment, remark, result_reference, executed_by_name, executed_date, executed_time, attempt_no)")
      .eq("project_id", projectId)
      .order("sort_order", { ascending: true })
      .order("source_row", { ascending: true })
      .order("id", { ascending: true })
      .range(start, end), 10, { shrinkOnTimeout: true });
  // Snapshot token must precede case reads. A competing writer then causes a
  // CAS conflict instead of accepting stale rows with its newer token.
  const [sourceResult,casesResult]=await Promise.all([
    sourceRequest,
    options.summaryConsistent ? sourceRequest.then(result=>{if(result.error)throw new Error(result.error.message);return readCases();}) : readCases(),
  ]);

  if (sourceResult.error) throw new Error(sourceResult.error.message);

  let source: WorkbookSource | null = null;
  const sourceRow = sourceResult.data as SourceRow | null;
  if (sourceRow) {
    const mapping = sourceRow.column_mapping ?? {};
    const includeWorkbook = options.includeWorkbook ?? false;
    const buffer = await downloadSourceWorkbook(projectId, sourceRow, includeWorkbook);
    const sheetPath = typeof mapping.sheetPath === "string" ? mapping.sheetPath : "";
    const sheets = Array.isArray(mapping.sheets) ? mapping.sheets as WorkbookSheet[] : [];
    const columns = Object.fromEntries(Object.entries(mapping).filter(([key, value]) =>
      key !== "dashboardSummary" && key !== "sourceOrigin" && key !== "workbookStorage" && key !== "sheetPath" && key !== "chunkCount" && key !== "sheets" && key !== "documentType" && typeof value === "string",
    )) as Record<string, string>;
    source = {
      sourceOrigin: mapping.sourceOrigin === "upload" || mapping.sourceOrigin === "google-sheets" ? mapping.sourceOrigin : undefined,
      workbookStorage: mapping.workbookStorage === "google-sheets" ? "google-sheets" : "supabase",
      documentType: mapping.documentType === "xlsx" ? "xlsx" : mapping.documentType === "google-sheets" ? "google-sheets" : undefined,
      coverSnapshot: mapping.coverSnapshot as WorkbookSource["coverSnapshot"],
      dashboardSummary: readProjectDashboardSummary(mapping.dashboardSummary,sourceRow.id),
      sheetImport: readSheetImportState(mapping.sheetImport),
      id: sourceRow.id,
      fileName: sourceRow.original_name,
      buffer,
      bufferLoaded: includeWorkbook,
      sheetName: sourceRow.sheet_name,
      sheetPath,
      columns,
      sheets,
    };
  }

  let previousScenario = "";
  let previousSteps = "";
  const cases = casesResult.map((row) => {
    const execution = [...(row.test_executions ?? [])].sort((a, b) => b.attempt_no - a.attempt_no)[0];
    const stored = parseStoredResults(execution?.result_reference);
    const scenario = row.scenario || previousScenario;
    const steps = row.steps || previousSteps;
    if (scenario) previousScenario = scenario;
    if (steps) previousSteps = steps;
    return {
      id: row.testcase_key,
      recordId: row.id,
      executionId: execution?.id,
      persistedLocally: stored.persistedLocally,
      stepDefinitions: stored.stepDefinitions,
      importIssues: stored.importIssues,
      sourceRow: row.source_row ?? 0,
      platform: row.platform,
      condition: row.condition_text,
      scenario,
      name: row.case_name,
      steps,
      expected: row.expected_result,
      status: execution?.status ?? "Not Start",
      device: execution?.device ?? "",
      testData: row.test_data,
      appVersion: execution?.app_version ?? "",
      environment: execution?.environment ?? "",
      resultReference: stored.resultReference,
      resultReferenceTargets: stored.resultReferenceTargets,
      registerIdentity: stored.registerIdentity,
      executedBy: execution?.executed_by_name ?? "",
      executedDate: execution?.executed_date ?? "",
      executedTime: execution?.executed_time ?? "",
      remark: execution?.remark ?? "",
      evidence: [],
      customFields: stored.customFields,
      sourceFields: stored.sourceFields,
      sourceSheetName: stored.sourceSheetName,
      resultFieldDefinitions: stored.resultFieldDefinitions,
      results: stored.results,
      defects: stored.defects,
    };
  });

  return { cases, source };
}

export async function persistImportedWorkbook(projectId: string, cases: TestCase[], source: WorkbookSource, persistCases = true, origin: "upload" | "google-sheets" = "upload") {
  const supabase = createClient();
  const { data: userResult, error: userError } = await supabase.auth.getUser();
  if (userError || !userResult.user) throw new Error("กรุณาเข้าสู่ระบบอีกครั้งก่อนอัปโหลดไฟล์");
  const sourceId = crypto.randomUUID();
  const project = await supabase.from("projects").select("google_sheet_id").eq("id",projectId).single();
  if (project.error) throw new Error(project.error.message);
  const stored = await storeSourceWorkbook(source,projectId,sourceId,project.data.google_sheet_id ?? "",async (key,buffer)=>{
    const storage = supabase.storage.from(SOURCE_BUCKET);
    return uploadSourceChunks(new Blob([buffer]),SOURCE_CHUNK_SIZE,key,{
      upload: async (path,chunk)=>storage.upload(path,chunk,{contentType:"application/octet-stream",upsert:false}),
      download: async path=>storage.download(path),
    });
  },origin);

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
    storage_provider: stored.storageProvider,
    storage_key: stored.storageKey,
    byte_size: stored.byteSize,
    sheet_name: source.sheetName,
    column_mapping: { ...source.columns, sourceOrigin: stored.sourceOrigin, documentType: source.documentType, sheetPath: source.sheetPath, workbookStorage: stored.workbookStorage, chunkCount: stored.chunkCount, sheets: source.sheets, sheetImport: source.sheetImport, coverSnapshot: source.coverSnapshot },
    version_no: (versionResult.data?.version_no ?? 0) + 1,
    uploaded_by: userResult.user.id,
  });
  if (sourceInsert.error) throw new Error(sourceInsert.error.message);

  if (!persistCases) return { cases, source: { ...source, id: sourceId, sourceOrigin: stored.sourceOrigin, workbookStorage: stored.workbookStorage } };

  const caseRows = cases.map((testCase, index) => ({
      project_id: projectId,
      source_file_id: sourceId,
      testcase_key: testCase.id,
      source_row: testCase.sourceRow > 0 ? testCase.sourceRow : null,
      sort_order: index,
      platform: testCase.platform,
      condition_text: testCase.condition,
      scenario: testCase.scenario,
      case_name: testCase.name,
      steps: testCase.steps,
      expected_result: testCase.expected,
      test_data: testCase.testData,
    }));
  const savedCaseRows = await writeProjectRowBatches(caseRows, async batch => {
    const result = await supabase.from("test_cases").upsert(batch, { onConflict: "project_id,testcase_key" }).select("id,testcase_key");
    if (result.error) throw new Error(`บันทึก Testcases ไม่สำเร็จ: ${result.error.message}`);
    return result.data ?? [];
  });
  const caseIds = new Map(savedCaseRows.map(row => [row.testcase_key, row.id]));
  const executionRows = cases.map((testCase) => ({
      project_id: projectId,
      test_case_id: caseIds.get(testCase.id),
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
    }));
  await writeProjectRowBatches(executionRows, async batch => {
    const result = await supabase.from("test_executions").upsert(batch, { onConflict: "test_case_id,attempt_no" });
    if (result.error) throw new Error(`บันทึกผลทดสอบไม่สำเร็จ: ${result.error.message}`);
    return [];
  });
  const workspace = await loadProjectWorkspace(projectId, { includeWorkbook: false, summaryConsistent: true });
  // The caller already holds the uploaded workbook. Reuse those bytes instead
  // of downloading every part again while the import is still in memory.
  if (workspace.source?.id === sourceId) {
    workspace.source = { ...workspace.source, buffer: source.buffer, bufferLoaded: true };
  }
  try {
    if(workspace.source)workspace.source=(await persistProjectDashboardSummary(projectId,workspace.cases,workspace.source)).source;
  } catch { /* Import succeeded; the next editor visit retries the derived summary. */ }
  return workspace;
}

export async function persistSheetImportState(projectId: string, sourceId: string, spreadsheetId: string, states: Record<string, RowLoadState>, complete: boolean, invalidate = false, evidenceManifest?: SheetImportState["evidenceManifest"], sourceRevision?: string, registerBaseline?: SheetImportState["registerBaseline"]): Promise<SheetImportState> {
  const response = await fetch(`/api/projects/${projectId}/import-state`, {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sourceId, spreadsheetId, states, complete, invalidate, evidenceManifest, sourceRevision, registerBaseline }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "บันทึกสถานะนำเข้าไม่สำเร็จ");
  const snapshot = readSheetImportState(data.snapshot, spreadsheetId);
  if (!snapshot) throw new Error("สถานะนำเข้าที่บันทึกไม่ถูกต้อง");
  return snapshot;
}

export async function persistTestCaseResult(projectId: string, testCase: TestCase) {
  return enqueueProjectDetailWrite(projectId, () => saveTestCaseResult(projectId, testCase));
}

async function saveTestCaseResult(projectId: string, testCase: TestCase) {
  const supabase=createClient();
  const saved=await retryTimedOutProjectWrite(async () => await supabase.rpc('save_test_case_result',{
    requested_project_id:projectId,
    requested_case:{recordId:testCase.recordId,id:testCase.id,sourceRow:testCase.sourceRow,platform:testCase.platform,condition:testCase.condition,scenario:testCase.scenario,name:testCase.name,steps:testCase.steps,expected:testCase.expected,testData:testCase.testData},
    requested_execution:{status:testCase.status,device:testCase.device,appVersion:testCase.appVersion,environment:testCase.environment,remark:testCase.remark,resultReference:serializeStoredResults(testCase),executedBy:testCase.executedBy,executedDate:testCase.executedDate,executedTime:testCase.executedTime},
  }));
  if(saved.error) {
    // Before schema installation continuation is gated off. Keep ordinary saves
    // compatible; never fall back on a real transaction/authorization failure.
    if(['PGRST202','42883'].includes(saved.error.code)) return persistTestCaseResultLegacy(projectId,testCase);
    throw new Error(`บันทึกผล ${testCase.id} ไม่สำเร็จ: ${saved.error.message}`);
  }
  if(!saved.data?.recordId || !saved.data?.executionId) throw new Error('บันทึก Result ไม่สำเร็จ');
  return {...testCase,results:parseStoredResults(saved.data.resultReference).results,recordId:saved.data.recordId,executionId:saved.data.executionId,persistedLocally:true};
}

async function persistTestCaseResultLegacy(projectId: string, testCase: TestCase) {
  const supabase = createClient();
  let recordId = testCase.recordId;
  if (!recordId) {
    const inserted = await supabase.from("test_cases").upsert({
      project_id: projectId,
      testcase_key: testCase.id,
      source_row: testCase.sourceRow || null,
      sort_order: testCase.sourceRow || 0,
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
      testcase_key: testCase.id,
      source_row: testCase.sourceRow || null,
      sort_order: testCase.sourceRow || 0,
      platform: testCase.platform,
      condition_text: testCase.condition,
      scenario: testCase.scenario,
      case_name: testCase.name,
      steps: testCase.steps,
      expected_result: testCase.expected,
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
    .select("id,result_reference")
    .single();
  if (result.error) throw new Error(result.error.message);
  return { ...testCase, results:parseStoredResults(result.data.result_reference).results, recordId, executionId: result.data.id, persistedLocally: true };
}


/** Persist a compact snapshot; a CAS conflict re-reads canonical stored cases. */
export async function persistProjectDashboardSummary(projectId:string,cases:TestCase[],source:WorkbookSource,retry=true):Promise<{cases:TestCase[];source:WorkbookSource;summary:ProjectDashboardSummary}> {
  if(!source.id)throw new Error('ยังไม่มีไฟล์นำเข้าที่บันทึกไว้');
  const response=await fetch(`/api/projects/${projectId}/dashboard-summary`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sourceId:source.id,expectedToken:source.dashboardSummary?.token ?? null,counts:buildProjectDashboardCounts(cases,source.sheets)})});
  const data=await response.json();
  if(response.status===409 && retry) {
    const current=await loadProjectWorkspace(projectId,{includeWorkbook:false,summaryConsistent:true});
    if(!current.source)throw new Error('ไม่พบข้อมูลนำเข้าล่าสุด');
    return persistProjectDashboardSummary(projectId,current.cases,current.source,false);
  }
  if(!response.ok)throw new Error(data.error ?? 'บันทึกยอดสรุปไม่สำเร็จ');
  const summary=readProjectDashboardSummary(data.summary,source.id);
  if(!summary)throw new Error('ยอดสรุปที่บันทึกไม่ถูกต้อง');
  return {cases,source:{...source,dashboardSummary:summary},summary};
}

/** Read canonical persisted rows; never derive Sprint totals from a filtered UI list. */
const summaryWrites=new Map<string,Promise<WorkbookSource|null>>();
export function refreshProjectDashboardSummary(projectId:string):Promise<WorkbookSource|null> {
  const previous=summaryWrites.get(projectId) ?? Promise.resolve(null);
  const pending=previous.catch(()=>null).then(async()=>{
    const workspace=await loadProjectWorkspace(projectId,{includeWorkbook:false,summaryConsistent:true});
    if(!workspace.source)return null;
    return (await persistProjectDashboardSummary(projectId,workspace.cases,workspace.source)).source;
  });
  summaryWrites.set(projectId,pending);
  void pending.finally(()=>{if(summaryWrites.get(projectId)===pending)summaryWrites.delete(projectId);}).catch(()=>{});
  return pending;
}
