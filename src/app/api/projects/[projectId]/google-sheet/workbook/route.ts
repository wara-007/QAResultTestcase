import { createClient } from "@/lib/supabase/server";
import { exportGoogleSheetWorkbook } from "@/lib/google-sheets";
import { getGoogleUserAuth } from "@/lib/google-user-oauth";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("projects")
      .select("name, google_sheet_id")
      .eq("id", projectId)
      .single();
    if (error) throw new Error(error.message);
    if (!data.google_sheet_id) throw new Error("Project นี้ยังไม่ได้เชื่อม Google Sheet");

    const workbook = await exportGoogleSheetWorkbook(data.google_sheet_id, await getGoogleUserAuth());
    const safeName = String(data.name ?? "google-sheet").replace(/[\\/:*?"<>|]+/g, "_");
    return new Response(workbook, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${safeName}.xlsx"`,
      },
    });
  } catch (reason) {
    return Response.json({ error: reason instanceof Error ? reason.message : "โหลด workbook จาก Google Sheets ไม่สำเร็จ" }, { status: 400 });
  }
}
