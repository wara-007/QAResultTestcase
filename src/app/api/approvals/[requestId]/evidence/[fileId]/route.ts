import { getApprovalUser } from "@/lib/approvals-server";
import { serveSharedDriveEvidence } from "@/lib/shared-drive-evidence";
import { loadCentralDriveEvidence } from "@/lib/shared-drive-evidence-server";
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
    // Recipient and exact evidence membership were checked above, before central access.
    return await serveSharedDriveEvidence(fileId, async () => {}, loadCentralDriveEvidence);
  } catch (reason) {
    return Response.json({ error: reason instanceof Error ? reason.message : "โหลดรูปไม่สำเร็จ" }, { status: 404 });
  }
}
