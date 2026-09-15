import { redirect } from "next/navigation";
import { ApprovalInbox } from "@/components/approval-inbox";
import { getApprovalUser, loadApprovalInbox } from "@/lib/approvals-server";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const user = await getApprovalUser();
  if (!user) redirect("/auth/login?next=/approvals");
  const approvals = await loadApprovalInbox(user.email);
  return <ApprovalInbox approvals={approvals} user={user} />;
}
