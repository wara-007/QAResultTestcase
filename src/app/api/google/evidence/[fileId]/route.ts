import { google } from "googleapis";
import { getGoogleUserAuth } from "@/lib/google-user-oauth";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ fileId: string }> }) {
  try {
    const { fileId } = await params;
    if (!/^[A-Za-z0-9_-]{10,}$/.test(fileId)) throw new Error("Google Drive file ID ไม่ถูกต้อง");
    const drive = google.drive({ version: "v3", auth: await getGoogleUserAuth() });
    const [metadata, content] = await Promise.all([
      drive.files.get({ fileId, fields: "mimeType" }),
      drive.files.get({ fileId, alt: "media" }, { responseType: "arraybuffer" }),
    ]);
    const mimeType = metadata.data.mimeType?.startsWith("image/") ? metadata.data.mimeType : "application/octet-stream";
    return new Response(content.data as ArrayBuffer, { headers: { "Content-Type": mimeType, "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" } });
  } catch (reason) {
    return Response.json({ error: reason instanceof Error ? reason.message : "โหลดรูปไม่สำเร็จ" }, { status: 404 });
  }
}
