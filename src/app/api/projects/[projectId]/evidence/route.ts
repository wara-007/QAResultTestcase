import { Readable } from "node:stream";
import { cookies } from "next/headers";
import { google, type drive_v3 } from "googleapis";
import { createClient } from "@/lib/supabase/server";
import { appendGoogleSheetEvidence } from "@/lib/google-sheets";
import { googleOAuthClient, GOOGLE_USER_COOKIE, openGoogleToken } from "@/lib/google-user-oauth";
import type { TestEvidence } from "@/lib/types";

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
    const tokenCookie = (await cookies()).get(GOOGLE_USER_COOKIE)?.value;
    if (!tokenCookie) return Response.json({ error: "กรุณาเชื่อม Google Drive", authUrl: "/api/google/auth/start?returnTo=/#projects" }, { status: 401 });
    const form = await request.formData();
    const file = form.get("file");
    const testCaseId = String(form.get("testCaseId") ?? "").trim();
    const sourceRow = Number(form.get("sourceRow"));
    const parsedEvidence = JSON.parse(String(form.get("evidence") ?? "[]"));
    const currentEvidence = Array.isArray(parsedEvidence) ? parsedEvidence as TestEvidence[] : [];
    if (!(file instanceof File) || !file.type.startsWith("image/")) throw new Error("กรุณาเลือกไฟล์รูปภาพ");
    if (file.size > 10 * 1024 * 1024) throw new Error("รูปต้องมีขนาดไม่เกิน 10 MB");
    if (!/^[A-Za-z]+[-_ ]?\d+$/.test(testCaseId)) throw new Error("Testcase ID ไม่ถูกต้อง");

    const { projectId } = await params;
    const supabase = await createClient();
    const { data: project, error } = await supabase.from("projects").select("name, google_sheet_id").eq("id", projectId).single();
    if (error) throw new Error(error.message);
    if (!project.google_sheet_id) throw new Error("Project นี้ยังไม่ได้เชื่อม Google Sheet");

    const oauth = googleOAuthClient();
    oauth.setCredentials(openGoogleToken(tokenCookie));
    const drive = google.drive({ version: "v3", auth: oauth });
    const rootId = await findOrCreateFolder(drive, "QA Result Evidence");
    const projectFolderId = await findOrCreateFolder(drive, safeName(project.name), rootId);
    const caseFolderId = await findOrCreateFolder(drive, safeName(testCaseId), projectFolderId);
    const uploaded = await drive.files.create({
      requestBody: { name: `${Date.now()}-${safeName(file.name)}`, parents: [caseFolderId] },
      media: { mimeType: file.type, body: Readable.from(Buffer.from(await file.arrayBuffer())) }, fields: "id,name,mimeType",
    });
    if (!uploaded.data.id) throw new Error("อัปโหลดรูปไป Google Drive ไม่สำเร็จ");
    await drive.permissions.create({ fileId: uploaded.data.id, requestBody: { type: "anyone", role: "reader" } });
    if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) {
      await drive.permissions.create({ fileId: uploaded.data.id, requestBody: { type: "user", role: "reader", emailAddress: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL }, sendNotificationEmail: false });
    }
    const evidence: TestEvidence = { fileId: uploaded.data.id, name: uploaded.data.name ?? file.name, mimeType: uploaded.data.mimeType ?? file.type };
    await appendGoogleSheetEvidence(project.google_sheet_id, sourceRow, [...currentEvidence, evidence], oauth);
    return Response.json({ evidence });
  } catch (reason) {
    return Response.json({ error: reason instanceof Error ? reason.message : "อัปโหลดรูปไม่สำเร็จ" }, { status: 400 });
  }
}
