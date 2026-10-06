"use server";

import { randomBytes, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { extractGoogleSheetId } from "@/lib/google-sheets";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Project } from "@/lib/types";
import { hashReviewToken, type ApprovalStatus } from "@/lib/project-review";
import { deleteR2ObjectsByPrefix } from "@/lib/r2";
import { canDeleteGroup, collectGoogleEvidence, cleanupGoogleWithWarning } from '@/lib/evidence-cleanup';
import { trashProjectGoogleEvidence } from '@/lib/google-evidence-cleanup';
import { readAllRows } from '@/lib/paged-rows';
import { headers } from "next/headers";
import { approvalNotificationPatch } from "@/lib/approval-notification";
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

type CreateApprovalResult = { request: ProjectApprovalSummary; mailtoUrl: string } | { error: string };

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
    if (existingResult.data?.status === "revoked") return { error: "คำขอนี้ถูกยกเลิกสิทธิ์แล้ว กรุณาจัดการสิทธิ์ก่อนส่งอีกครั้ง" };

    const headerStore = await headers();
    const requestOrigin = headerStore.get("origin")?.replace(/\/$/, "") ?? "";
    const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "") ?? "";
    const baseUrl = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(requestOrigin) ? requestOrigin : configuredOrigin;
    if (!baseUrl) return { error: "ยังไม่ได้ตั้งค่า NEXT_PUBLIC_SITE_URL สำหรับสร้างลิงก์ Approval" };

    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const requestId = existingResult.data?.id ?? randomUUID();
    const notification = approvalNotificationPatch(new Date().toISOString(), access.userId, access.name, Boolean(existingResult.data));
    const requestData = {
      id: requestId,
      project_id: input.projectId,
      recipient_email: email,
      token_hash: hashReviewToken(token),
      status: "pending",
      expires_at: expiresAt,
      reviewed_at: null,
      reviewer_name: "",
      reviewer_comment: "",
      ...notification,
    };
    const columns = "id, recipient_email, status, requested_at, expires_at, reviewed_at, reviewer_name, reviewer_comment, email_sent_at";
    const result = existingResult.data
      ? await admin.from("project_approval_requests").update(notification).eq("id", requestId).neq("status", "revoked").select(columns).single()
      : await admin.from("project_approval_requests").insert(requestData).select(columns).single();
    if (result.error) return { error: result.error.message };

    const subject = `${existingResult.data ? "[อัปเดต] " : ""}${input.subject.trim() || `[QA Approval] ${projectResult.data.name}`}`;
    const body = [existingResult.data ? "มีการอัปเดตผลการทดสอบ Project กรุณาตรวจสอบข้อมูลล่าสุด สถานะอนุมัติเดิมยังคงเดิม" : "", input.body.trim(), "", `เปิดหน้า Review และ Approve: ${baseUrl}/approvals/${requestId}`, `Google Sheets: ${projectResult.data.google_sheet_url}`].filter(Boolean).join("\n");
    const mailtoUrl = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}${input.cc.trim() ? `&cc=${encodeURIComponent(input.cc.trim())}` : ""}&body=${encodeURIComponent(body)}`;
    revalidatePath("/approvals");
    return { request: { id: result.data.id, recipientEmail: email, status: result.data.status as ApprovalStatus, requestedAt: result.data.requested_at, expiresAt: result.data.expires_at, emailSentAt: result.data.email_sent_at ?? "", reviewedAt: result.data.reviewed_at ?? "", reviewerName: result.data.reviewer_name, reviewerComment: result.data.reviewer_comment }, mailtoUrl };
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
  sprintId?: string;
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
  if (!input.sprintId) return { error: "กรุณาสร้าง Project จากหน้า Sprint" };
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
        sprint_id: input.sprintId,
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
        sprintId: input.sprintId,
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
  return { group: { id: data.id, name: data.name, description: data.description, projectCount: 0, createdAt: data.created_at, canAccess: true, canManage: true, canDelete: true } };
}

export async function setGroupPinned(input: { groupId: string; pinned: boolean }) {
  const groupId = input.groupId.trim();
  if (!groupId || groupId.length > 160) return { error: "Group ID ไม่ถูกต้อง" };

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || typeof claimsData?.claims?.sub !== "string") return { error: "กรุณาเข้าสู่ระบบอีกครั้ง" };

  if (input.pinned) {
    const { error } = await supabase.from("user_group_pins").insert({ group_id: groupId });
    if (error && error.code !== "23505") return { error: error.message };
  } else {
    const { error } = await supabase.from("user_group_pins").delete().eq("group_id", groupId);
    if (error) return { error: error.message };
  }

  revalidatePath("/groups");
  return { success: true, pinned: input.pinned };
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
    return await deleteProjectRecords(projectId);
  } catch (reason) {
    return { error: reason instanceof Error ? reason.message : "ลบ Project ไม่สำเร็จ" };
  }
}

// Not exported: only the permission-checked Project/Group actions may call it.
async function deleteProjectRecords(projectId: string) {
  try {

    const admin = createAdminClient();
    const [project, sources, executions] = await Promise.all([
      admin.from("projects").select("id, name, group_id, owner_id").eq("id", projectId).maybeSingle(),
      readAllRows((a,b)=>admin.from("source_files").select("id, storage_key, column_mapping").eq("project_id", projectId).order('id').range(a,b)).then(data=>({data,error:null})),
      readAllRows((a,b)=>admin.from("test_executions").select("id, result_reference").eq("project_id", projectId).order('id').range(a,b)).then(data=>({data,error:null})),
    ]);
    if (project.error) return { error: project.error.message };
    if (!project.data) return { error: "ไม่พบ Project" };
    const googleCleanup = await cleanupGoogleWithWarning(()=>trashProjectGoogleEvidence(project.data!,collectGoogleEvidence(executions.data.map(e=>e.result_reference))));

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
    revalidatePath(`/groups/${project.data.group_id}`,'layout');
    return { success: true, deletedR2Images: deletedR2Images ?? 0, ...googleCleanup };
  } catch (reason) {
    return { error: reason instanceof Error ? reason.message : "ลบ Project ไม่สำเร็จ" };
  }
}

export async function deleteGroup(groupId: string) {
  const warnings:string[]=[];
  try {
    const db=await createClient();
    const {data:auth,error:authError}=await db.auth.getUser();
    if(authError || !auth.user) throw new Error('กรุณาเข้าสู่ระบบอีกครั้ง');
    const [group,system,appAccess]=await Promise.all([db.from('groups').select('id,owner_id').eq('id',groupId).maybeSingle(),db.rpc('is_system_owner'),db.rpc('is_app_authorized')]);
    if(group.error || system.error || appAccess.error) throw new Error(group.error?.message || system.error?.message || appAccess.error?.message);
    if(!group.data || !appAccess.data || !canDeleteGroup(auth.user.id,group.data.owner_id,system.data===true)) throw new Error('เฉพาะ Group Owner หรือ System Owner เท่านั้นที่ลบกลุ่มได้');
    const admin=createAdminClient();
    const projects=await readAllRows((a,b)=>admin.from('projects').select('id,name').eq('group_id',groupId).order('id').range(a,b));
    let deletedProjects=0;
    for(const project of projects) {
      const result=await deleteProjectRecords(project.id);
      if(result.error) return {error:`ลบไปแล้ว ${deletedProjects} Projects แต่หยุดที่ ${project.name}: ${result.error} กรุณาแก้ไขแล้วลองใหม่`,deletedProjects,warnings};
      if('warnings' in result) warnings.push(...result.warnings.map(warning=>`${project.name}: ${warning}`));
      deletedProjects++;
    }
    // The existing RESTRICT FK prevents deletion if a new Project was added
    // during cleanup. Never blindly cascade newly added evidence.
    const deletion=admin.from('groups').delete().eq('id',groupId);
    const result=await (group.data.owner_id ? deletion.eq('owner_id',group.data.owner_id) : deletion.is('owner_id',null)).select('id').maybeSingle();
    if(result.error || !result.data) throw new Error(result.error?.message || 'กลุ่มเปลี่ยนแปลง กรุณาโหลดใหม่');
    revalidatePath('/groups');revalidatePath(`/groups/${groupId}`,'layout');revalidatePath('/approvals');
    return {success:true,deletedProjects,warnings};
  } catch(reason) {return {error:reason instanceof Error ? reason.message : 'ลบกลุ่มไม่สำเร็จ',warnings};}
}
