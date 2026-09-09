"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { extractGoogleSheetId } from "@/lib/google-sheets";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Project } from "@/lib/types";

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

export async function updateProjectGoogleSheet(projectId: string, googleSheetUrl: string) {
  const url = googleSheetUrl.trim();
  const googleSheetId = extractGoogleSheetId(url);
  if (!googleSheetId) return { error: "Google Sheet URL ไม่ถูกต้อง" };
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claimsData?.claims?.sub) return { error: "กรุณาเข้าสู่ระบบอีกครั้ง" };
  const { error } = await supabase.from("projects").update({ google_sheet_id: googleSheetId, google_sheet_url: url }).eq("id", projectId);
  if (error) return { error: error.message };
  revalidatePath("/");
  return { googleSheetId, googleSheetUrl: url };
}

export async function deleteProject(projectId: string) {
  try {
    const supabase = await createClient();
    const sources = await supabase.from("source_files").select("storage_key, column_mapping").eq("project_id", projectId);
    if (sources.error) return { error: sources.error.message };
    const { error } = await supabase.from("projects").delete().eq("id", projectId);
    if (error) return { error: error.message };

    const storagePaths = (sources.data ?? []).flatMap((source) => {
      const chunkCount = typeof source.column_mapping?.chunkCount === "number" ? source.column_mapping.chunkCount : 0;
      return chunkCount > 0
        ? Array.from({ length: chunkCount }, (_, index) => `${source.storage_key}/part-${String(index).padStart(3, "0")}`)
        : [source.storage_key];
    });
    if (storagePaths.length) await createAdminClient().storage.from("testcase-source-files").remove(storagePaths);
    revalidatePath("/");
    return { success: true };
  } catch (reason) {
    return { error: reason instanceof Error ? reason.message : "ลบ Project ไม่สำเร็จ" };
  }
}
