import "server-only";
import { google } from "googleapis";
import { getGoogleServiceAuth } from "@/lib/google-sheets";
import { createClient } from "@/lib/supabase/server";
import { ProjectAccessError, requireProjectCapability } from "@/lib/project-access-server";
import { storedDriveEvidenceProjectIds } from "@/lib/shared-drive-evidence";

export async function authorizeProjectDriveEvidence(fileId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || typeof data?.claims?.sub !== "string") throw new ProjectAccessError("กรุณาเข้าสู่ระบบ", 401);
  // The user-scoped query retains RLS. Narrow by ID, then inspect the JSON exactly.
  const pattern = `%${fileId.replace(/_/g, "\\_")}%`;
  const projectIds = await storedDriveEvidenceProjectIds(fileId, (start, end) => supabase
    .from("test_executions").select("project_id,result_reference")
    .like("result_reference", pattern).order("id").range(start, end));
  for (const projectId of projectIds) {
    try { await requireProjectCapability(projectId, "view"); return; }
    catch (reason) { if (!(reason instanceof ProjectAccessError)) throw reason; }
  }
  throw new ProjectAccessError("ไม่พบรูปใน Project ที่คุณมีสิทธิ์ดู", 404);
}

export async function loadCentralDriveEvidence(fileId: string) {
  const drive = google.drive({ version: "v3", auth: getGoogleServiceAuth() });
  try {
    const [metadata, content] = await Promise.all([
      drive.files.get({ fileId, fields: "mimeType" }),
      drive.files.get({ fileId, alt: "media" }, { responseType: "arraybuffer" }),
    ]);
    return { bytes: new Uint8Array(content.data as ArrayBuffer), mimeType: metadata.data.mimeType ?? "application/octet-stream" };
  } catch (reason) {
    const status = (reason as { response?: { status?: number } }).response?.status;
    if (status === 403 || status === 404) throw new ProjectAccessError("บัญชีกลางอ่านรูปนี้ไม่ได้ ให้เจ้าของไฟล์แชร์รูปหรือโฟลเดอร์หลักฐานให้ Google Service Account ของระบบ", 404);
    throw reason;
  }
}
