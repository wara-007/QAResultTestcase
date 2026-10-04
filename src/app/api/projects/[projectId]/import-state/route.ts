import { createAdminClient } from "@/lib/supabase/admin";
import { ProjectAccessError, requireProjectCapability } from "@/lib/project-access-server";
import { checkpointSheetImport, readSheetImportState } from "@/lib/sheet-import-state";
import type { RowLoadState } from "@/lib/result-preview";

export const runtime = "nodejs";

export async function PATCH(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const access = await requireProjectCapability(projectId, "edit");
    const body = await request.json() as { sourceId?: string; spreadsheetId?: string; states?: Record<string, RowLoadState>; complete?: boolean; invalidate?: boolean };
    if (!body.sourceId || body.spreadsheetId !== access.project.google_sheet_id || !body.states || typeof body.states !== "object"
      || Object.keys(body.states).length > 4000 || Object.values(body.states).some(state => !["loaded", "loading", "queued", "error"].includes(state))) {
      return Response.json({ error: "ข้อมูลสถานะนำเข้าไม่ถูกต้อง" }, { status: 400 });
    }
    const db = createAdminClient();
    // Compare-and-swap prevents concurrent case loads from losing each other's
    // checkpoints or overwriting unrelated column mappings / Defected metadata.
    for (let attempt = 0; attempt < 3; attempt++) {
      const source = await db.from("source_files").select("column_mapping").eq("id", body.sourceId).eq("project_id", projectId).single();
      if (source.error) throw new Error(source.error.message);
      const mapping = source.data.column_mapping ?? {};
      const snapshot = checkpointSheetImport(readSheetImportState(mapping.sheetImport, body.spreadsheetId), body.spreadsheetId!, body.states, new Date().toISOString(), body.complete === true);
      if (body.invalidate) snapshot.refreshRequired = true;
      let update = db.from("source_files").update({ column_mapping: { ...mapping, sheetImport: snapshot } }).eq("id", body.sourceId).eq("project_id", projectId);
      update = source.data.column_mapping === null ? update.is("column_mapping", null) : update.eq("column_mapping", JSON.stringify(source.data.column_mapping));
      const saved = await update.select("id").maybeSingle();
      if (saved.error) throw new Error(saved.error.message);
      if (saved.data) return Response.json({ snapshot });
    }
    throw new Error("ข้อมูลนำเข้าถูกอัปเดตพร้อมกัน กรุณาลองใหม่");
  } catch (reason) {
    return Response.json({ error: reason instanceof Error ? reason.message : "บันทึกสถานะนำเข้าไม่สำเร็จ" }, { status: reason instanceof ProjectAccessError ? reason.status : 400 });
  }
}
