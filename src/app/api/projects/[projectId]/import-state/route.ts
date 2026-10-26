import { isRegisterBaseline, type RegisterBaseline } from "@/lib/sheet-refresh";
import { createAdminClient } from "@/lib/supabase/admin";
import { ProjectAccessError, requireProjectCapability } from "@/lib/project-access-server";
import { checkpointSheetImport, readSheetImportState } from "@/lib/sheet-import-state";
import type { RowLoadState } from "@/lib/result-preview";
import { isEvidenceManifest, type ApprovalEvidenceTarget } from "@/lib/approval-evidence";
import { updateSourceMapping } from "@/lib/source-mapping-checkpoint";

export const runtime = "nodejs";

export async function PATCH(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const access = await requireProjectCapability(projectId, "edit");
    const body = await request.json() as { sourceRevision?: string; registerBaseline?: RegisterBaseline; sourceId?: string; spreadsheetId?: string; states?: Record<string, RowLoadState>; complete?: boolean; invalidate?: boolean; evidenceManifest?: ApprovalEvidenceTarget[] };
    if (!body.sourceId || body.spreadsheetId !== access.project.google_sheet_id || !body.states || typeof body.states !== "object"
      || Object.keys(body.states).length > 4000 || Object.values(body.states).some(state => !["loaded", "loading", "queued", "error"].includes(state))
      || (body.sourceRevision !== undefined && (typeof body.sourceRevision !== "string" || !body.sourceRevision || body.sourceRevision.length > 512))
      || (body.registerBaseline !== undefined && !isRegisterBaseline(body.registerBaseline))
      || (body.evidenceManifest !== undefined && !isEvidenceManifest(body.evidenceManifest))) {
      return Response.json({ error: "ข้อมูลสถานะนำเข้าไม่ถูกต้อง" }, { status: 400 });
    }
    const db = createAdminClient();
    const updates = body.states;
    const savedMapping = await updateSourceMapping(db, projectId, body.sourceId, mapping => {
      const snapshot = checkpointSheetImport(readSheetImportState(mapping.sheetImport, body.spreadsheetId), body.spreadsheetId!, updates, new Date().toISOString(), body.complete === true);
      if (body.sourceRevision !== undefined) snapshot.sourceRevision = body.sourceRevision;
      if (body.registerBaseline !== undefined) snapshot.registerBaseline = body.registerBaseline;
      if (body.invalidate) snapshot.refreshRequired = true;
      if (body.evidenceManifest !== undefined) snapshot.evidenceManifest = body.evidenceManifest;
      return { ...mapping, sheetImport: snapshot };
    });
    return Response.json({ snapshot: savedMapping.sheetImport });
  } catch (reason) {
    return Response.json({ error: reason instanceof Error ? reason.message : "บันทึกสถานะนำเข้าไม่สำเร็จ" }, { status: reason instanceof ProjectAccessError ? reason.status : 400 });
  }
}
