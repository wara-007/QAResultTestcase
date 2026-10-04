import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ApprovalStatus } from "@/lib/project-review";
import { approvalUpdateNotice } from "@/lib/approval-notification";

export type ApprovalInboxItem = {
  id: string;
  status: ApprovalStatus;
  requestedAt: string;
  reviewedAt: string;
  requestedByName: string;
  reviewerComment: string;
  projectName: string;
  environment: string;
  sprintNo: string;
  hasUpdates: boolean;
};

export async function getApprovalUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.email) return null;
  return {
    id: data.user.id,
    email: data.user.email.toLowerCase(),
    name: String(data.user.user_metadata?.full_name ?? data.user.user_metadata?.name ?? data.user.email.split("@")[0]),
  };
}

export async function loadApprovalInbox(email: string): Promise<ApprovalInboxItem[]> {
  const admin = createAdminClient();
  const requests = await admin.from("project_approval_requests")
    .select("id, project_id, status, requested_at, reviewed_at, requested_by_name, reviewer_comment, email_id")
    .eq("recipient_email", email.toLowerCase()).neq("status", "revoked").order("requested_at", { ascending: false });
  if (requests.error) throw new Error(requests.error.message);
  const projectIds = [...new Set((requests.data ?? []).map((request) => request.project_id))];
  const projects = projectIds.length
    ? await admin.from("projects").select("id, name, environment, sprint_no").in("id", projectIds)
    : { data: [], error: null };
  if (projects.error) throw new Error(projects.error.message);
  const projectById = new Map((projects.data ?? []).map((project) => [project.id, project]));
  const latestByProject = new Map<string, (typeof requests.data)[number]>();
  for (const request of requests.data ?? []) if (!latestByProject.has(request.project_id)) latestByProject.set(request.project_id, request);
  return [...latestByProject.values()].map((request) => {
    const project = projectById.get(request.project_id);
    return {
      id: request.id,
      hasUpdates: approvalUpdateNotice(request.email_id, request.requested_at, request.reviewed_at),
      status: request.status as ApprovalStatus,
      requestedAt: request.requested_at,
      reviewedAt: request.reviewed_at ?? "",
      requestedByName: request.requested_by_name,
      reviewerComment: request.reviewer_comment,
      projectName: project?.name ?? "Project ถูกลบแล้ว",
      environment: project?.environment ?? "",
      sprintNo: project?.sprint_no ?? "",
    };
  });
}
