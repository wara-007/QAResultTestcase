import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { resolveReviewRequestId } from "@/lib/project-review";

export const metadata: Metadata = {
  title: "PO Review | QA Result Workspace",
  description: "ตรวจสอบและอนุมัติผลการทดสอบ",
  robots: { index: false, follow: false, nocache: true },
};

export default async function ReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const requestId = await resolveReviewRequestId(token);
  if (!requestId) notFound();
  redirect(`/approvals/${requestId}`);
}
