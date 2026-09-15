import { redirect } from "next/navigation";
import { ReviewWorkspace } from "@/components/review-workspace";
import { getApprovalUser } from "@/lib/approvals-server";

export const dynamic = "force-dynamic";

export default async function ApprovalReviewPage({ params }: { params: Promise<{ requestId: string }> }) {
  const user = await getApprovalUser();
  if (!user) {
    const { requestId } = await params;
    redirect(`/auth/login?next=${encodeURIComponent(`/approvals/${requestId}`)}`);
  }
  const { requestId } = await params;
  return <ReviewWorkspace requestId={requestId} currentUserName={user.name} />;
}
