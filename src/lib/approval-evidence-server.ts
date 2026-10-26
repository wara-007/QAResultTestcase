import "server-only";
import { createAdminClient } from "./supabase/admin";
import { readAllRows } from "./paged-rows";
import { parseStoredResults } from "./stored-results";
import { readSheetImportState } from "./sheet-import-state";
import { approvalEvidenceReadiness } from "./approval-evidence";

/** Called only after project edit authorization; never trust browser readiness. */
export async function requireApprovalEvidenceReady(projectId: string, spreadsheetId: string) {
  const db = createAdminClient();
  const [source, cases, executions] = await Promise.all([
    db.from("source_files").select("column_mapping").eq("project_id", projectId).order("version_no", { ascending: false }).limit(1).maybeSingle(),
    readAllRows<{ id: string; testcase_key: string }>((from, to) => db.from("test_cases").select("id,testcase_key").eq("project_id", projectId).order("id").range(from, to)),
    readAllRows<{ test_case_id: string; result_reference: string | null }>((from, to) => db.from("test_executions").select("id,test_case_id,attempt_no,result_reference")
      .eq("project_id", projectId).order("test_case_id").order("attempt_no", { ascending: false }).order("id").range(from, to)),
  ]);
  if (source.error) throw new Error(source.error.message);
  const latest = new Map<string, string | null>();
  for (const execution of executions) if (!latest.has(execution.test_case_id)) latest.set(execution.test_case_id, execution.result_reference);
  const mapping = source.data?.column_mapping ?? {};
  const tabs = Array.isArray(mapping.sheets) ? mapping.sheets.map((sheet: { name: string }) => sheet.name) : undefined;
  const readiness = approvalEvidenceReadiness(readSheetImportState(mapping.sheetImport, spreadsheetId), cases.map(item => ({
    id: item.testcase_key, results: parseStoredResults(latest.get(item.id) ?? undefined).results,
  })), tabs);
  if (!readiness.ready) throw new Error(`${readiness.reason} กรุณานำเข้าหลักฐานทั้งโปรเจคให้เสร็จก่อนส่งให้ PO`);
  return readiness;
}
