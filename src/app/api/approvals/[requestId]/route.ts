import { createAdminClient } from "@/lib/supabase/admin";
import { getApprovalUser } from "@/lib/approvals-server";
import { loadRecipientProjectReview } from "@/lib/project-review";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const noStoreHeaders = { "Cache-Control": "private, no-store, max-age=0" };

export async function GET(_request: Request, { params }: { params: Promise<{ requestId: string }> }) {
  try {
    const user = await getApprovalUser();
    if (!user) return Response.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401, headers: noStoreHeaders });
    const { requestId } = await params;
    const review = await loadRecipientProjectReview(requestId, user.email);
    if (!review) return Response.json({ error: "ไม่พบคำขอ หรือคำขอนี้ไม่ได้ส่งถึงอีเมลของคุณ" }, { status: 404, headers: noStoreHeaders });
    return Response.json({ review }, { headers: noStoreHeaders });
  } catch (reason) {
    return Response.json({ error: reason instanceof Error ? reason.message : "โหลดข้อมูลรีวิวไม่สำเร็จ" }, { status: 500, headers: noStoreHeaders });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ requestId: string }> }) {
  try {
    const user = await getApprovalUser();
    if (!user) return Response.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401, headers: noStoreHeaders });
    const { requestId } = await params;
    const body = await request.json() as { decision?: unknown; comment?: unknown };
    const decision = body.decision;
    const comment = typeof body.comment === "string" ? body.comment.trim() : "";
    if (decision !== "approved" && decision !== "changes_requested") return Response.json({ error: "สถานะรีวิวไม่ถูกต้อง" }, { status: 400, headers: noStoreHeaders });
    if (decision === "changes_requested" && !comment) return Response.json({ error: "กรุณาระบุสิ่งที่ต้องการให้แก้ไข" }, { status: 400, headers: noStoreHeaders });
    if (comment.length > 5000) return Response.json({ error: "ความคิดเห็นต้องไม่เกิน 5,000 ตัวอักษร" }, { status: 400, headers: noStoreHeaders });

    const admin = createAdminClient();
    const reviewedAt = new Date().toISOString();
    const updated = await admin.from("project_approval_requests").update({
      status: decision, reviewed_at: reviewedAt, reviewer_name: user.name, reviewer_comment: comment,
    }).eq("id", requestId).eq("recipient_email", user.email).eq("status", "pending").select("id").maybeSingle();
    if (updated.error) throw new Error(updated.error.message);
    if (!updated.data) return Response.json({ error: "คำขอนี้ได้รับการตอบกลับแล้ว หรือไม่ได้ส่งถึงอีเมลของคุณ" }, { status: 409, headers: noStoreHeaders });
    return Response.json({ approval: { status: decision, reviewedAt, reviewerName: user.name, reviewerComment: comment } }, { headers: noStoreHeaders });
  } catch (reason) {
    return Response.json({ error: reason instanceof Error ? reason.message : "บันทึกผลรีวิวไม่สำเร็จ" }, { status: 500, headers: noStoreHeaders });
  }
}
