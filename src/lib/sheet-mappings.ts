import "server-only";

import { createClient } from "@/lib/supabase/server";
import { ProjectAccessError, requireProjectCapability } from "@/lib/project-access-server";
import { getGoogleUserAuth } from "@/lib/google-user-oauth";
import { readGoogleSheet } from "@/lib/google-sheets";
import { mappingUpsertPayload, projectSheetMappingFromRow, validateGoogleSheetId, type ProjectSheetMappingRow, type SaveSheetMappingInput } from "@/lib/sheet-mapping-model";
import type { ProjectSheetMapping } from "@/lib/types";

export class SheetMappingError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function authenticatedProject(projectId: string, requireEdit: boolean) {
  try {
    const access = await requireProjectCapability(projectId, requireEdit ? "edit" : "view");
    return { supabase: access.supabase, userId: access.userId, project: access.project };
  } catch (reason) {
    if (reason instanceof ProjectAccessError) throw new SheetMappingError(reason.message, reason.status);
    throw reason;
  }
}

export async function loadSheetMappings(projectId: string): Promise<ProjectSheetMapping[]> {
  const { supabase } = await authenticatedProject(projectId, false);
  const result = await supabase.from("project_sheet_mappings").select("project_id,spreadsheet_id,sheet_id,sheet_name,testcase_key,mapped_by,created_at,updated_at").eq("project_id", projectId).order("sheet_id");
  if (result.error) throw new Error(result.error.message);
  return (result.data as ProjectSheetMappingRow[]).map(projectSheetMappingFromRow);
}

async function testcaseExists(projectId: string, testcaseKey: string, spreadsheetId: string, supabase: Awaited<ReturnType<typeof createClient>>) {
  const local = await supabase.from("test_cases").select("id").eq("project_id", projectId).ilike("testcase_key", testcaseKey).limit(1).maybeSingle();
  if (local.error) throw new Error(local.error.message);
  if (local.data) return true;
  const google = await readGoogleSheet(spreadsheetId, await getGoogleUserAuth(), { summary: true });
  return google.cases.some((testCase) => testCase.id.trim().toLocaleUpperCase() === testcaseKey.trim().toLocaleUpperCase());
}

export async function saveSheetMapping(projectId: string, input: Pick<SaveSheetMappingInput, "sheetId" | "sheetName" | "testcaseKey">): Promise<ProjectSheetMapping> {
  const { supabase, userId, project } = await authenticatedProject(projectId, true);
  const sheetId = validateGoogleSheetId(input.sheetId);
  if (!project.google_sheet_id) throw new SheetMappingError("Project นี้ยังไม่ได้เชื่อม Google Sheets", 400);
  if (!input.sheetName.trim() || !input.testcaseKey.trim()) throw new SheetMappingError("กรุณาเลือก Google tab และ Test case", 400);
  if (!await testcaseExists(projectId, input.testcaseKey, project.google_sheet_id, supabase)) throw new SheetMappingError("ไม่พบ Test case ที่เลือกใน Project นี้", 400);
  const payload = mappingUpsertPayload({ ...input, projectId, spreadsheetId: project.google_sheet_id, sheetId }, userId);
  const result = await supabase.from("project_sheet_mappings").upsert(payload, { onConflict: "project_id,spreadsheet_id,sheet_id" })
    .select("project_id,spreadsheet_id,sheet_id,sheet_name,testcase_key,mapped_by,created_at,updated_at").single();
  if (result.error) throw new Error(result.error.message);
  return projectSheetMappingFromRow(result.data as ProjectSheetMappingRow);
}

export async function deleteSheetMapping(projectId: string, sheetIdValue: unknown) {
  const { supabase, project } = await authenticatedProject(projectId, true);
  const sheetId = validateGoogleSheetId(sheetIdValue);
  if (!project.google_sheet_id) throw new SheetMappingError("Project นี้ยังไม่ได้เชื่อม Google Sheets", 400);
  const result = await supabase.from("project_sheet_mappings").delete().eq("project_id", projectId).eq("spreadsheet_id", project.google_sheet_id).eq("sheet_id", sheetId);
  if (result.error) throw new Error(result.error.message);
  return true;
}
