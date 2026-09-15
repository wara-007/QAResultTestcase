import { google } from "googleapis";
import { getApprovalUser } from "@/lib/approvals-server";
import { getGoogleServiceAuth } from "@/lib/google-sheets";
import { loadRecipientProjectReview } from "@/lib/project-review";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ requestId: string; fileId: string }> }) {
  try {
    const user = await getApprovalUser();
    if (!user) return Response.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    const { requestId, fileId } = await params;
    if (!/^[A-Za-z0-9_-]{10,}$/.test(fileId)) return Response.json({ error: "Google Drive file ID ไม่ถูกต้อง" }, { status: 400 });
    const review = await loadRecipientProjectReview(requestId, user.email);
    if (!review) return Response.json({ error: "ไม่พบคำขอ หรือคำขอนี้ไม่ได้ส่งถึงอีเมลของคุณ" }, { status: 404 });
    const allowed = new Set(review.cases.flatMap((testCase) => [
      ...(testCase.results ?? []).flatMap((result) => result.evidence ?? []),
      ...(testCase.defects ?? []).flatMap((defect) => defect.evidence ?? []),
    ]).map((evidence) => evidence.fileId));
    if (!allowed.has(fileId)) return Response.json({ error: "ไม่พบรูปนี้ในคำขอรีวิว" }, { status: 404 });
    const drive = google.drive({ version: "v3", auth: getGoogleServiceAuth() });
    const [metadata, content] = await Promise.all([
      drive.files.get({ fileId, fields: "mimeType" }),
      drive.files.get({ fileId, alt: "media" }, { responseType: "arraybuffer" }),
    ]);
    const mimeType = metadata.data.mimeType?.startsWith("image/") ? metadata.data.mimeType : "application/octet-stream";
    return new Response(content.data as ArrayBuffer, { headers: { "Content-Type": mimeType, "Cache-Control": "private, max-age=900", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox" } });
  } catch (reason) {
    return Response.json({ error: reason instanceof Error ? reason.message : "โหลดรูปไม่สำเร็จ" }, { status: 404 });
  }
}
