import { createClient } from "@/lib/supabase/server";
import { readGoogleSheet, writeGoogleSheetResults } from "@/lib/google-sheets";
import type { TestCase } from "@/lib/types";
import { getGoogleUserAuth } from "@/lib/google-user-oauth";

export const runtime = "nodejs";

async function spreadsheetIdForProject(projectId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("projects").select("google_sheet_id").eq("id", projectId).single();
  if (error) throw new Error(error.message);
  if (!data.google_sheet_id) throw new Error("Project นี้ยังไม่ได้เชื่อม Google Sheet");
  return data.google_sheet_id as string;
}

export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const result = await readGoogleSheet(await spreadsheetIdForProject(projectId), await getGoogleUserAuth());
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (reason) {
    return Response.json({ error: reason instanceof Error ? reason.message : "โหลด Google Sheet ไม่สำเร็จ" }, { status: 400 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const supabase = await createClient();
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    if (claimsError || !claimsData?.claims?.sub) {
      return Response.json({ error: "กรุณาเข้าสู่ระบบอีกครั้ง" }, { status: 401 });
    }
    const body = await request.json() as { cases?: TestCase[] };
    if (!Array.isArray(body.cases) || body.cases.length > 2_000) throw new Error("ข้อมูล Testcase ไม่ถูกต้อง");
    const result = await writeGoogleSheetResults(await spreadsheetIdForProject(projectId), body.cases, await getGoogleUserAuth());
    return Response.json(result);
  } catch (reason) {
    return Response.json({ error: reason instanceof Error ? reason.message : "ซิงค์ Google Sheet ไม่สำเร็จ" }, { status: 400 });
  }
}
