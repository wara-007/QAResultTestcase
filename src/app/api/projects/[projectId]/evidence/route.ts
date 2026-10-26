import { Readable } from "node:stream";
import { randomUUID } from "node:crypto";
import { google, type drive_v3 } from "googleapis";
import { GoogleConnectionRequiredError, googleOAuthClient, openGoogleToken } from "@/lib/google-user-oauth";
import { needsGoogleAuthorization } from "@/lib/google-authorization";
import { ProjectAccessError, requireProjectCapability } from "@/lib/project-access-server";
import type { TestEvidence } from "@/lib/types";
import { getR2Config, uploadR2Object } from "@/lib/r2";
import { evidenceExtension, validateEvidenceFile } from "@/lib/evidence-media";
import { DriveEvidenceFolders } from "@/lib/drive-evidence-folders";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const safeName = (value: string) => value.replace(/[\r\n]+/g, " ").replace(/[\\/:*?"<>|]+/g, "_").trim().slice(0, 120) || "Untitled";
const evidenceFolders = new DriveEvidenceFolders();

async function findOrCreateFolder(drive: drive_v3.Drive, name: string, parentId?: string) {
  const escaped = name.replace(/'/g, "\\'");
  const parent = parentId ? ` and '${parentId}' in parents` : "";
  const existing = await drive.files.list({ q: `name='${escaped}' and mimeType='application/vnd.google-apps.folder' and trashed=false${parent}`, fields: "files(id)", spaces: "drive" });
  if (existing.data.files?.[0]?.id) return existing.data.files[0].id;
  const created = await drive.files.create({ requestBody: { name, mimeType: "application/vnd.google-apps.folder", parents: parentId ? [parentId] : undefined }, fields: "id" });
  if (!created.data.id) throw new Error("สร้างโฟลเดอร์ Google Drive ไม่สำเร็จ");
  return created.data.id;
}

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  let driveUserId: string | undefined;
  let actorUserId: string | undefined;
  try {
    const { projectId } = await params;
    const access = await requireProjectCapability(projectId, "edit");
    actorUserId = access.userId;
    const form = await request.formData();
    const file = form.get("file");
    const testCaseId = String(form.get("testCaseId") ?? "").trim();
    if (!(file instanceof File)) throw new Error("กรุณาเลือกไฟล์หลักฐาน");
    const invalid = validateEvidenceFile(file);
    if (invalid) throw new Error(invalid);
    // Result tabs are not always named TC-xx (for example RC DEF-04).
    // Keep validation focused on safe storage input; safeName() handles the
    // folder/object-key representation below.
    if (!testCaseId || testCaseId.length > 160 || /[\u0000-\u0009\u000b\u000c\u000e-\u001f\u007f]/.test(testCaseId)) {
      throw new Error("Testcase ID ไม่ถูกต้อง");
    }

    const project = access.project;

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    if (file.type.startsWith("video/") && getR2Config()) {
      const extension = evidenceExtension(file.type);
      const objectId = randomUUID();
      const objectKey = `projects/${projectId}/${safeName(testCaseId)}/${objectId}.${extension}`;
      const publicUrl = await uploadR2Object(objectKey, fileBuffer, file.type);
      if (!publicUrl) throw new Error("อัปโหลดรูปไป Cloudflare R2 ไม่สำเร็จ");
      const evidence: TestEvidence = { fileId: objectId, objectKey, provider: "cloudflare-r2", url: publicUrl, name: file.name, mimeType: file.type };
      return Response.json({ evidence, storage: "cloudflare-r2" });
    }

    // Derive the destination only from the authorized project, never from the
    // request or the editor's Google session. Credentials remain server-side.
    const ownerId = typeof project.owner_id === "string" ? project.owner_id : "";
    if (!ownerId) return Response.json({ error: "Project นี้ไม่มีข้อมูลผู้สร้าง จึงยังอัปโหลดรูปเข้า Google Drive ไม่ได้", code: "PROJECT_OWNER_REQUIRED" }, { status: 409 });
    driveUserId = ownerId;
    const connection = await createAdminClient().from("google_oauth_connections")
      .select("token_ciphertext").eq("user_id", ownerId).maybeSingle();
    if (connection.error) throw new Error("โหลดบัญชี Google ของผู้สร้างโปรเจคไม่สำเร็จ กรุณาลองอีกครั้ง");
    if (!connection.data?.token_ciphertext) throw new GoogleConnectionRequiredError();
    const oauth = googleOAuthClient();
    try { oauth.setCredentials(openGoogleToken(connection.data.token_ciphertext)); }
    catch { throw new GoogleConnectionRequiredError(); }
    const drive = google.drive({ version: "v3", auth: oauth });
    const caseFolderId = await evidenceFolders.resolve({ userId: ownerId, projectId, projectName: safeName(project.name), testCaseId: safeName(testCaseId) },
      (name, parentId) => findOrCreateFolder(drive, name, parentId));
    const uploaded = await drive.files.create({
      requestBody: { name: `${Date.now()}-${safeName(file.name)}`, parents: [caseFolderId], appProperties: {qaProjectId:projectId,qaUploadedBy:access.userId,qaDriveOwner:ownerId} },
      media: { mimeType: file.type, body: Readable.from(fileBuffer) }, fields: "id,name,mimeType",
    });
    if (!uploaded.data.id) throw new Error("อัปโหลดรูปไป Google Drive ไม่สำเร็จ");
    await drive.permissions.create({ fileId: uploaded.data.id, requestBody: { type: "anyone", role: "reader" } });
    if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) {
      await drive.permissions.create({ fileId: uploaded.data.id, requestBody: { type: "user", role: "reader", emailAddress: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL }, sendNotificationEmail: false });
    }
    const evidence: TestEvidence = { fileId: uploaded.data.id, provider: "google-drive", uploadedBy:access.userId, name: uploaded.data.name ?? file.name, mimeType: uploaded.data.mimeType ?? file.type };
    return Response.json({ evidence, storage: "google-drive" });
  } catch (reason) {
    if (driveUserId) evidenceFolders.invalidate(driveUserId);
    const googleError = reason as { message?: string; response?: { status?: number; data?: { error?: string } } };
    const connectionExpired = googleError?.response?.status === 401
      || /invalid_grant|invalid_token|invalid credentials/i.test(`${googleError?.message ?? ""} ${googleError?.response?.data?.error ?? ""}`);
    if (driveUserId && (needsGoogleAuthorization(reason) || connectionExpired)) {
      const isCreator = actorUserId === driveUserId;
      return Response.json({
        error: isCreator ? "กรุณาเชื่อม Google Drive ของคุณอีกครั้ง เพื่อเก็บรูปในบัญชีผู้สร้างโปรเจค" : "ผู้สร้างโปรเจคต้องเชื่อม Google Drive อีกครั้ง จึงจะอัปโหลดรูปได้ กรุณาแจ้งผู้สร้างโปรเจค",
        code: "PROJECT_OWNER_GOOGLE_CONNECTION_REQUIRED",
        ...(isCreator ? { authUrl: "/api/google/auth/start" } : {}),
      }, { status: isCreator ? 401 : 409 });
    }
    return Response.json({ error: reason instanceof Error ? reason.message : "อัปโหลดรูปไม่สำเร็จ" }, { status: reason instanceof ProjectAccessError ? reason.status : 400 });
  }
}
