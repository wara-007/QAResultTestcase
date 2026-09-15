import { Readable } from "node:stream";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { google, type drive_v3 } from "googleapis";
import { createClient } from "@/lib/supabase/server";
import { googleOAuthClient, GOOGLE_USER_COOKIE, openGoogleToken } from "@/lib/google-user-oauth";
import type { TestEvidence } from "@/lib/types";
import { getR2Config, uploadR2Object } from "@/lib/r2";

export const runtime = "nodejs";

const safeName = (value: string) => value.replace(/[\\/:*?"<>|]+/g, "_").trim().slice(0, 120) || "Untitled";

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
  try {
    const form = await request.formData();
    const file = form.get("file");
    const testCaseId = String(form.get("testCaseId") ?? "").trim();
    if (!(file instanceof File) || !file.type.startsWith("image/")) throw new Error("กรุณาเลือกไฟล์รูปภาพ");
    if (file.size > 10 * 1024 * 1024) throw new Error("รูปต้องมีขนาดไม่เกิน 10 MB");
    if (!/^[A-Za-z]+[-_ ]?\d+$/.test(testCaseId)) throw new Error("Testcase ID ไม่ถูกต้อง");

    const { projectId } = await params;
    const supabase = await createClient();
    const { data: project, error } = await supabase.from("projects").select("name, google_sheet_id").eq("id", projectId).single();
    if (error) throw new Error(error.message);

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    if (getR2Config()) {
      const extension = file.type === "image/webp" ? "webp" : file.type === "image/png" ? "png" : file.type === "image/jpeg" ? "jpg" : "image";
      const objectId = randomUUID();
      const objectKey = `projects/${projectId}/${safeName(testCaseId)}/${objectId}.${extension}`;
      const publicUrl = await uploadR2Object(objectKey, fileBuffer, file.type);
      if (!publicUrl) throw new Error("อัปโหลดรูปไป Cloudflare R2 ไม่สำเร็จ");
      const evidence: TestEvidence = { fileId: objectId, objectKey, provider: "cloudflare-r2", url: publicUrl, name: file.name, mimeType: file.type };
      return Response.json({ evidence, storage: "cloudflare-r2" });
    }

    const tokenCookie = (await cookies()).get(GOOGLE_USER_COOKIE)?.value;
    if (!tokenCookie) return Response.json({ error: "ยังไม่ได้ตั้งค่า Cloudflare R2 และยังไม่ได้เชื่อม Google Drive", authUrl: "/api/google/auth/start?returnTo=/#projects" }, { status: 401 });
    if (!project.google_sheet_id) throw new Error("Project นี้ยังไม่ได้เชื่อม Google Sheet");

    const oauth = googleOAuthClient();
    oauth.setCredentials(openGoogleToken(tokenCookie));
    const drive = google.drive({ version: "v3", auth: oauth });
    const rootId = await findOrCreateFolder(drive, "QA Result Evidence");
    const projectFolderId = await findOrCreateFolder(drive, safeName(project.name), rootId);
    const caseFolderId = await findOrCreateFolder(drive, safeName(testCaseId), projectFolderId);
    const uploaded = await drive.files.create({
      requestBody: { name: `${Date.now()}-${safeName(file.name)}`, parents: [caseFolderId] },
      media: { mimeType: file.type, body: Readable.from(fileBuffer) }, fields: "id,name,mimeType",
    });
    if (!uploaded.data.id) throw new Error("อัปโหลดรูปไป Google Drive ไม่สำเร็จ");
    await drive.permissions.create({ fileId: uploaded.data.id, requestBody: { type: "anyone", role: "reader" } });
    if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) {
      await drive.permissions.create({ fileId: uploaded.data.id, requestBody: { type: "user", role: "reader", emailAddress: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL }, sendNotificationEmail: false });
    }
    const evidence: TestEvidence = { fileId: uploaded.data.id, provider: "google-drive", name: uploaded.data.name ?? file.name, mimeType: uploaded.data.mimeType ?? file.type };
    return Response.json({ evidence, storage: "google-drive" });
  } catch (reason) {
    return Response.json({ error: reason instanceof Error ? reason.message : "อัปโหลดรูปไม่สำเร็จ" }, { status: 400 });
  }
}
