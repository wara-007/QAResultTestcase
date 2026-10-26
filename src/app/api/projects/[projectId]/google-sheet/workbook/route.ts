import { ProjectAccessError, requireProjectCapability } from "@/lib/project-access-server";
import { revisionCheckedWorkbook, WorkbookRevisionError } from "@/lib/revision-checked-workbook";
import { workbookContentRevision } from "@/lib/workbook-revision";
import { readSheetImportState } from "@/lib/sheet-import-state";
import { exportGoogleSheetWorkbook, readGoogleSheetRevision } from "@/lib/google-sheets";
import { getGoogleUserAuth } from "@/lib/google-user-oauth";
import { needsGoogleAuthorization } from "@/lib/google-authorization";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const access = await requireProjectCapability(projectId,"view");
    const data=access.project;
    if (!data.google_sheet_id) throw new Error("Project นี้ยังไม่ได้เชื่อม Google Sheet");
    const auth=await getGoogleUserAuth();
    const download=()=>exportGoogleSheetWorkbook(data.google_sheet_id!,auth);
    const query = new URL(request.url).searchParams;
    const sourceId=query.get("sourceId");
    const expectedRevision=query.get("expectedRevision");
    if (expectedRevision !== null && (!expectedRevision || expectedRevision.length > 512 || sourceId)) throw new WorkbookRevisionError("ไม่พบเวอร์ชัน Sheets ที่ถูกต้อง");
    let workbook:ArrayBuffer;
    if (sourceId) {
      const source=await access.supabase.from("source_files").select("column_mapping").eq("project_id",projectId).eq("id",sourceId).single();
      if (source.error) throw new Error(source.error.message);
      const snapshot=readSheetImportState(source.data.column_mapping?.sheetImport,data.google_sheet_id);
      workbook=await revisionCheckedWorkbook(snapshot?.sourceRevision ?? "",()=>readGoogleSheetRevision(data.google_sheet_id!,auth),download,bytes=>workbookContentRevision(new Uint8Array(bytes)));
    } else if (expectedRevision) {
      workbook=await revisionCheckedWorkbook(expectedRevision,()=>readGoogleSheetRevision(data.google_sheet_id!,auth),download,bytes=>workbookContentRevision(new Uint8Array(bytes)));
    } else workbook=await download();
    const safeName = String(data.name ?? "google-sheet").replace(/[\\/:*?"<>|]+/g, "_");
    return new Response(workbook, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${safeName}.xlsx"`,
      },
    });
  } catch (reason) {
    if (needsGoogleAuthorization(reason)) {
      return Response.json({ error: "กรุณาอนุญาตสิทธิ์ Google Drive และ Sheets ใหม่", authUrl: `/api/google/auth/start?returnTo=${encodeURIComponent(new URL(request.url).pathname.replace(/\/api\/projects\/[^/]+\/google-sheet\/workbook$/, "/groups"))}` }, { status: 401 });
    }
    return Response.json({ error: reason instanceof Error ? reason.message : "โหลด workbook จาก Google Sheets ไม่สำเร็จ" }, { status: reason instanceof ProjectAccessError ? reason.status : reason instanceof WorkbookRevisionError ? 409 : 400 });
  }
}
