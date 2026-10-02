import { readGoogleSheet, writeGoogleSheetResults } from "@/lib/google-sheets";
import type { TestCase, WorkbookSheet } from "@/lib/types";
import { withCachedProjectDefects } from "@/lib/project-defect-cache";
import { getGoogleUserAuth, GoogleConnectionRequiredError } from "@/lib/google-user-oauth";
import { canonicalizeCases } from "@/lib/sync/canonical";
import { loadBaselines, replaceBaselines } from "@/lib/sync/store";
import { createAdminClient } from "@/lib/supabase/admin";
import { ProjectAccessError, requireProjectCapability } from "@/lib/project-access-server";

export const runtime = "nodejs";

// Store lightweight register data separately: importing images or resolving
// testcase conflicts must not prevent the Sprint counter from seeing defects.
export async function PATCH(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    await requireProjectCapability(projectId, "edit");
    const body = await request.json() as { sheets?: WorkbookSheet[] };
    if (!Array.isArray(body.sheets) || body.sheets.length > 2000 || body.sheets.some(sheet => !sheet || typeof sheet.name !== "string")) throw new Error("ข้อมูลแท็บไม่ถูกต้อง");
    const db = createAdminClient();
    const source = await db.from("source_files").select("id,column_mapping").eq("project_id", projectId).order("version_no", { ascending: false }).limit(1).maybeSingle();
    if (source.error) throw new Error(source.error.message);
    if (!source.data) throw new Error("ยังไม่มีไฟล์ต้นฉบับสำหรับเก็บ Defects — กรุณาโหลดจาก Sheets ให้เสร็จก่อน");
    const mapping = withCachedProjectDefects(source.data.column_mapping ?? {}, body.sheets);
    const saved = await db.from("source_files").update({ column_mapping: mapping }).eq("id", source.data.id).eq("project_id", projectId).select("id").single();
    if (saved.error) throw new Error(saved.error.message);
    return Response.json({ saved: true });
  } catch (reason) {
    return Response.json({ error: reason instanceof Error ? reason.message : "บันทึก Defects สำหรับ Sprint ไม่สำเร็จ" }, { status: reason instanceof ProjectAccessError ? reason.status : 400 });
  }
}

async function spreadsheetIdForProject(projectId: string) {
  const access = await requireProjectCapability(projectId, "view");
  if (!access.project.google_sheet_id) throw new Error("Project นี้ยังไม่ได้เชื่อม Google Sheet");
  return access.project.google_sheet_id as string;
}

function googleAuthError(reason: unknown, request: Request) {
  if (!(reason instanceof GoogleConnectionRequiredError)) return null;
  const current = new URL(request.url);
  return Response.json({ error: reason.message, authUrl: `/api/google/auth/start?returnTo=${encodeURIComponent(current.pathname.replace(/\/api\/projects\/[^/]+\/google-sheet$/, "/groups"))}` }, { status: 401 });
}

export async function GET(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const query = new URL(request.url).searchParams;
    const summary = query.get("summary") === "1";
    const result = await readGoogleSheet(await spreadsheetIdForProject(projectId), await getGoogleUserAuth(), { summary, sheetName: query.get("sheet") ?? undefined, testcaseId: query.get("testcase") ?? undefined });
    const baseline = await loadBaselines(createAdminClient(), projectId);
    return Response.json({ ...result, baseline }, { headers: { "Cache-Control": "no-store" } });
  } catch (reason) {
    const authError = googleAuthError(reason, request);
    if (authError) return authError;
    return Response.json({ error: reason instanceof Error ? reason.message : "โหลด Google Sheet ไม่สำเร็จ" }, { status: reason instanceof ProjectAccessError ? reason.status : 400 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const access = await requireProjectCapability(projectId, "edit");
    const body = await request.json() as { cases?: TestCase[] };
    if (!Array.isArray(body.cases) || body.cases.length > 2_000) throw new Error("ข้อมูล Testcase ไม่ถูกต้อง");
    if (!access.project.google_sheet_id) throw new Error("Project นี้ยังไม่ได้เชื่อม Google Sheet");
    const result = await writeGoogleSheetResults(access.project.google_sheet_id, body.cases, await getGoogleUserAuth());
    await replaceBaselines(createAdminClient(), projectId, canonicalizeCases(body.cases), access.userId);
    return Response.json(result);
  } catch (reason) {
    const authError = googleAuthError(reason, request);
    if (authError) return authError;
    return Response.json({ error: reason instanceof Error ? reason.message : "ซิงค์ Google Sheet ไม่สำเร็จ" }, { status: reason instanceof ProjectAccessError ? reason.status : 400 });
  }
}
