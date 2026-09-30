"use server";

import { randomBytes, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { extractGoogleSheetId } from "@/lib/google-sheets";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Project } from "@/lib/types";
import { hashReviewToken, type ApprovalStatus } from "@/lib/project-review";
import { deleteR2ObjectsByPrefix } from "@/lib/r2";
import { headers } from "next/headers";
import { requireProjectCapability, type ProjectCapability } from "@/lib/project-access-server";

export type ProjectApprovalSummary = {
  id: string;
  recipientEmail: string;
  status: ApprovalStatus;
  requestedAt: string;
  expiresAt: string;
  reviewedAt: string;
  reviewerName: string;
  reviewerComment: string;
  emailSentAt: string;
};

async function getSignedInProject(projectId: string, capability: ProjectCapability = "view"): Promise<{ userId: string; name: string } | { error: string }> {
  try {
    const access = await requireProjectCapability(projectId, capability);
    const metadata = access.claims.user_metadata as Record<string, unknown> | undefined;
    const name = [metadata?.full_name, metadata?.name, access.claims.email].find((value) => typeof value === "string" && value.trim()) as string | undefined;
    return { userId: access.userId, name: name ?? "QA Team" };
  } catch (reason) {
    return { error: reason instanceof Error ? reason.message : "ตรวจสอบสิทธิ์ Project ไม่สำเร็จ" };
  }
}

export async function getLatestProjectApproval(projectId: string): Promise<{ approval: ProjectApprovalSummary | null } | { error: string }> {
  try {
    const access = await getSignedInProject(projectId);
    if ("error" in access) return access;
    const result = await createAdminClient().from("project_approval_requests")
      .select("id, recipient_email, status, requested_at, expires_at, reviewed_at, reviewer_name, reviewer_comment, email_sent_at")
      .eq("project_id", projectId).order("requested_at", { ascending: false }).limit(1).maybeSingle();
    if (result.error) return { error: result.error.message };
    if (!result.data) return { approval: null };
    return { approval: {
      id: result.data.id, recipientEmail: result.data.recipient_email, status: result.data.status as ApprovalStatus,
      requestedAt: result.data.requested_at, expiresAt: result.data.expires_at,
      reviewedAt: result.data.reviewed_at ?? "", reviewerName: result.data.reviewer_name,
      reviewerComment: result.data.reviewer_comment, emailSentAt: result.data.email_sent_at ?? "",
    } };
  } catch (reason) {
    return { error: reason instanceof Error ? reason.message : "โหลดสถานะ Approval ไม่สำเร็จ" };
  }
}

type CreateApprovalInput = {
  projectId: string;
  senderEmail: string;
  recipientEmail: string;
  cc: string;
  subject: string;
  body: string;
  note: string;
  environment: string;
  counts: { total: number; pass: number; failed: number; skip: number; notStart: number; inProgress: number };
};

type CreateApprovalResult = { request: { id: string; recipientEmail: string; status: "pending"; requestedAt: string; expiresAt: string; emailSentAt: string }; mailtoUrl: string } | { error: string };

export async function createProjectApprovalRequest(input: CreateApprovalInput): Promise<CreateApprovalResult> {
  const email = input.recipientEmail.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "กรุณาใส่อีเมล PO ให้ถูกต้อง" };
  try {
    const access = await getSignedInProject(input.projectId, "edit");
    if ("error" in access) return access;
    const admin = createAdminClient();
    const projectResult = await admin.from("projects").select("id, name, environment, google_sheet_url, owner_id").eq("id", input.projectId).maybeSingle();
    if (projectResult.error) return { error: projectResult.error.message };
    if (!projectResult.data) return { error: "ไม่พบ Project" };
    if (!projectResult.data.google_sheet_url) return { error: "กรุณาเชื่อม Google Sheet ก่อนส่งขอ Approve" };

    const existingResult = await admin.from("project_approval_requests")
      .select("id, status, email_sent_at")
      .eq("project_id", input.projectId).eq("recipient_email", email)
      .maybeSingle();
    if (existingResult.error) return { error: existingResult.error.message };
    if (existingResult.data?.status === "approved") return { error: `Project นี้ได้รับการ Approve จาก ${email} แล้ว` };
    if (existingResult.data?.status === "pending" && existingResult.data.email_sent_at) return { error: `เคยส่ง Project นี้ให้ ${email} แล้ว และกำลังรอ Approve` };

    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const requestId = existingResult.data?.id ?? randomUUID();
    const requestData = {
      id: requestId,
      project_id: input.projectId,
      recipient_email: email,
      token_hash: hashReviewToken(token),
      status: "pending",
      requested_by: access.userId,
      requested_by_name: access.name,
      requested_at: new Date().toISOString(),
      expires_at: expiresAt,
      reviewed_at: null,
      reviewer_name: "",
      reviewer_comment: "",
      email_sent_at: null,
      email_id: "",
      email_error: "",
    };
    const result = existingResult.data
      ? await admin.from("project_approval_requests").update(requestData).eq("id", requestId).select("id, requested_at").single()
      : await admin.from("project_approval_requests").insert(requestData).select("id, requested_at").single();
    if (result.error) return { error: result.error.message };

    const headerStore = await headers();
    const requestOrigin = headerStore.get("origin")?.replace(/\/$/, "") ?? "";
    const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "") ?? "";
    const baseUrl = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(requestOrigin) ? requestOrigin : configuredOrigin;
    if (!baseUrl) {
      await admin.from("project_approval_requests").delete().eq("id", requestId);
      return { error: "ยังไม่ได้ตั้งค่า NEXT_PUBLIC_SITE_URL สำหรับสร้างลิงก์ Approval" };
    }

    const emailSentAt = new Date().toISOString();
    const marked = await admin.from("project_approval_requests").update({ email_sent_at: emailSentAt, email_id: "mailto", email_error: "" }).eq("id", requestId);
    if (marked.error) return { error: marked.error.message };
    const subject = input.subject.trim() || `[QA Approval] ${projectResult.data.name}`;
    const body = [input.body.trim(), "", `เปิดหน้า Review และ Approve: ${baseUrl}/approvals/${requestId}`, `Google Sheets: ${projectResult.data.google_sheet_url}`].filter(Boolean).join("\n");
    const mailtoUrl = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}${input.cc.trim() ? `&cc=${encodeURIComponent(input.cc.trim())}` : ""}&body=${encodeURIComponent(body)}`;
    revalidatePath("/approvals");
    return { request: { id: result.data.id, recipientEmail: email, status: "pending" as const, requestedAt: result.data.requested_at, expiresAt, emailSentAt }, mailtoUrl };
  } catch (reason) {
    return { error: reason instanceof Error ? reason.message : "สร้างลิงก์รีวิวไม่สำเร็จ" };
  }
}

type CreateProjectInput = {
  groupId: string;
  name: string;
  description: string;
  sprintNo: string;
  environment: string;
  googleSheetUrl: string;
};

type CreateProjectResult =
  | { project: Project; error?: never }
  | { project?: never; error: string };

export async function createProject(input: CreateProjectInput): Promise<CreateProjectResult> {
  const name = input.name.trim();
  const environment = input.environment.trim();
  const googleSheetUrl = input.googleSheetUrl.trim();
  const googleSheetId = googleSheetUrl ? extractGoogleSheetId(googleSheetUrl) : "";

  if (!name || name.length > 160) return { error: "ชื่อ Project ต้องมี 1-160 ตัวอักษร" };
  if (!environment) return { error: "กรุณาระบุ Environment" };
  if (googleSheetUrl && !googleSheetId) return { error: "Google Sheet URL ไม่ถูกต้อง" };

  try {
    const supabase = await createClient();
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    const ownerId = claimsData?.claims?.sub;
    if (claimsError || typeof ownerId !== "string") return { error: "กรุณาเข้าสู่ระบบอีกครั้ง" };
    const projectId = randomUUID();
    const { error: insertError } = await supabase
      .from("projects")
      .insert({
        id: projectId,
        group_id: input.groupId,
        name,
        description: input.description.trim(),
        sprint_no: input.sprintNo.trim(),
        environment,
        google_sheet_id: googleSheetId || null,
        google_sheet_url: googleSheetUrl || null,
        owner_id: ownerId,
      });

    if (insertError) return { error: insertError.message };
    const { data, error } = await supabase
      .from("projects")
      .select("id, name, description, sprint_no, environment, google_sheet_id, google_sheet_url, created_at")
      .eq("id", projectId)
      .single();

    if (error) return { error: error.message };

    revalidatePath("/");
    return {
      project: {
        id: data.id,
        name: data.name,
        description: data.description,
        sprintNo: data.sprint_no,
        environment: data.environment,
        googleSheetId: data.google_sheet_id ?? "",
        googleSheetUrl: data.google_sheet_url ?? "",
        createdAt: data.created_at,
        canView: true,
        canEdit: true,
        canManage: true,
        canDelete: true,
      },
    };
  } catch (reason) {
    return { error: reason instanceof Error ? reason.message : "เพิ่ม Project ไม่สำเร็จ" };
  }
}

export async function createGroup(input: { name: string; description: string }) {
  const name = input.name.trim();
  if (!name || name.length > 120) return { error: "ชื่อกลุ่มต้องมี 1-120 ตัวอักษร" };

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const ownerId = claimsData?.claims?.sub;
  if (claimsError || typeof ownerId !== "string") return { error: "กรุณาเข้าสู่ระบบอีกครั้ง" };

  const groupId = randomUUID();
  const { error: insertError } = await supabase
    .from("groups")
    .insert({ id: groupId, name, description: input.description.trim(), owner_id: ownerId });
  if (insertError) return { error: insertError.message };
  const { data, error } = await supabase
    .from("groups")
    .select("id, name, description, created_at")
    .eq("id", groupId)
    .single();
  if (error) return { error: error.message };
  revalidatePath("/groups");
  return { group: { id: data.id, name: data.name, description: data.description, projectCount: 0, createdAt: data.created_at, canAccess: true, canManage: true } };
}

export async function updateGroupName(input: { groupId: string; name: string }) {
  const name = input.name.trim();
  if (!name || name.length > 120) return { error: "ชื่อกลุ่มต้องมี 1-120 ตัวอักษร" };
  const supabase = await createClient();
  const { error } = await supabase.from("groups").update({ name }).eq("id", input.groupId);
  if (error) return { error: error.message };
  revalidatePath("/groups");
  revalidatePath(`/groups/${input.groupId}/members`);
  revalidatePath(`/groups/${input.groupId}/projects`);
  return { success: true, name };
}

export async function inviteGroupMember(input: { groupId: string; email: string; role: "admin" | "qa_lead" | "qa" | "viewer" }) {
  const email = input.email.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "กรุณาใส่อีเมลให้ถูกต้อง" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("invite_group_member", { requested_group_id: input.groupId, requested_email: email, requested_role: input.role });
  if (error) return { error: error.message };
  revalidatePath(`/groups/${input.groupId}/members`);
  return { success: true };
}

export async function removeGroupMember(input: { groupId: string; memberId: string; email: string }) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_group_member", { requested_group_id: input.groupId, requested_member_id: input.memberId || null, requested_email: input.email });
  if (error) return { error: error.message };
  revalidatePath(`/groups/${input.groupId}/members`);
  return { success: true };
}

export async function setSystemOwner(input: { userId: string; enabled: boolean }) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.userId)) {
    return { error: "User ID ไม่ถูกต้อง" };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_system_owner", {
    requested_user_id: input.userId,
    requested_enabled: input.enabled,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/users");
  revalidatePath("/groups");
  return { success: true };
}

export async function setAppUserAccess(input: { email: string; enabled: boolean; role: "qa" | "po" }) {
  const email = input.email.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "กรุณาใส่อีเมลให้ถูกต้อง" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_app_user_access", {
    requested_email: email,
    requested_enabled: input.enabled,
    requested_role: input.role,
  });
  if (error) return { error: error.message };
  let inviteSent = false;
  let inviteWarning = "";
  if (input.enabled) {
    try {
      const admin = createAdminClient();
      const existing = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const alreadyRegistered = existing.data.users.some((user) => user.email?.toLowerCase() === email);
      if (!alreadyRegistered) {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
        const invited = await admin.auth.admin.inviteUserByEmail(email, {
          redirectTo: siteUrl ? `${siteUrl}/auth/callback?next=${encodeURIComponent("/auth/update-password")}` : undefined,
          data: { app_role: input.role },
        });
        if (invited.error) inviteWarning = invited.error.message;
        else inviteSent = true;
      }
    } catch (reason) {
      inviteWarning = reason instanceof Error ? reason.message : "ส่งอีเมลเชิญไม่สำเร็จ";
    }
  }
  revalidatePath("/admin/users");
  return { success: true, inviteSent, inviteWarning };
}

export async function updateProjectGoogleSheet(projectId: string, googleSheetUrl: string) {
  const url = googleSheetUrl.trim();
  const googleSheetId = extractGoogleSheetId(url);
  if (!googleSheetId) return { error: "Google Sheet URL ไม่ถูกต้อง" };
  try {
    const access = await requireProjectCapability(projectId, "manage");
    const { error } = await access.supabase.from("projects").update({ google_sheet_id: googleSheetId, google_sheet_url: url }).eq("id", projectId);
    if (error) return { error: error.message };
    revalidatePath("/");
    return { googleSheetId, googleSheetUrl: url };
  } catch (reason) {
    return { error: reason instanceof Error ? reason.message : "ตรวจสอบสิทธิ์ Project ไม่สำเร็จ" };
  }
}

export async function deleteProject(projectId: string) {
  try {
    await requireProjectCapability(projectId, "delete");

    const admin = createAdminClient();
    const [project, sources, executions] = await Promise.all([
      admin.from("projects").select("id, group_id, owner_id").eq("id", projectId).maybeSingle(),
      admin.from("source_files").select("storage_key, column_mapping").eq("project_id", projectId),
      admin.from("test_executions").select("result_reference").eq("project_id", projectId),
    ]);
    if (project.error) return { error: project.error.message };
    if (!project.data) return { error: "ไม่พบ Project" };
    if (sources.error) return { error: sources.error.message };
    if (executions.error) return { error: executions.error.message };

    const hasR2Evidence = (executions.data ?? []).some(({ result_reference }) =>
      typeof result_reference === "string" && (result_reference.includes("cloudflare-r2") || result_reference.includes(`projects/${projectId}/`)),
    );
    const deletedR2Images = await deleteR2ObjectsByPrefix(`projects/${projectId}/`);
    if (deletedR2Images === null && hasR2Evidence) {
      return { error: "ยังไม่ได้ตั้งค่า Cloudflare R2 จึงไม่สามารถลบรูปหลักฐานของ Project ได้" };
    }

    // Approval requests and all project-owned database rows are removed by
    // their ON DELETE CASCADE constraints. Google Sheets are intentionally
    // external references and are never deleted here.
    const deleted = await admin.from("projects").delete().eq("id", projectId).select("id").maybeSingle();
    if (deleted.error) return { error: deleted.error.message };
    if (!deleted.data) return { error: "ลบ Project ไม่สำเร็จ" };

    const storagePaths = (sources.data ?? []).flatMap((source) => {
      const chunkCount = typeof source.column_mapping?.chunkCount === "number" ? source.column_mapping.chunkCount : 0;
      return chunkCount > 0
        ? Array.from({ length: chunkCount }, (_, index) => `${source.storage_key}/part-${String(index).padStart(3, "0")}`)
        : [source.storage_key];
    });
    if (storagePaths.length) await admin.storage.from("testcase-source-files").remove(storagePaths);
    revalidatePath("/");
    revalidatePath("/approvals");
    revalidatePath(`/groups/${project.data.group_id}/projects`);
    return { success: true, deletedR2Images: deletedR2Images ?? 0 };
  } catch (reason) {
    return { error: reason instanceof Error ? reason.message : "ลบ Project ไม่สำเร็จ" };
  }
}
