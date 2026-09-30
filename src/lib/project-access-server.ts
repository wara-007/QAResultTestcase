import "server-only";

import { projectCapabilitiesFromRow, type ProjectAccessCapabilities } from "@/lib/project-capabilities";
import { createClient } from "@/lib/supabase/server";

export type ProjectCapability = "view" | "edit" | "manage" | "delete";

export class ProjectAccessError extends Error {
  constructor(message: string, readonly status: 401 | 403 | 404) {
    super(message);
  }
}

const capabilityField: Record<ProjectCapability, keyof ProjectAccessCapabilities> = {
  view: "canView",
  edit: "canEdit",
  manage: "canManage",
  delete: "canDelete",
};

export async function requireProjectCapability(projectId: string, capability: ProjectCapability) {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  const userId = claims?.sub;
  if (claimsError || !claims || typeof userId !== "string") throw new ProjectAccessError("กรุณาเข้าสู่ระบบอีกครั้ง", 401);

  const projectResult = await supabase.from("projects")
    .select("id,group_id,name,google_sheet_id,google_sheet_url,owner_id")
    .eq("id", projectId)
    .maybeSingle();
  if (projectResult.error || !projectResult.data) throw new ProjectAccessError("ไม่พบ Project หรือคุณไม่มีสิทธิ์เข้าถึง", 403);

  const accessResult = await supabase.rpc("list_project_access", { requested_group_id: projectResult.data.group_id });
  if (accessResult.error) throw new Error(accessResult.error.message);
  const row = (accessResult.data ?? []).find((item: { project_id?: string }) => item.project_id === projectId);
  const capabilities = projectCapabilitiesFromRow(row ?? {});
  if (!capabilities[capabilityField[capability]]) {
    throw new ProjectAccessError(capability === "view" ? "คุณไม่มีสิทธิ์ดู Project นี้" : "Project นี้เปิดให้คุณดูอย่างเดียว", 403);
  }

  return { supabase, userId, claims, project: projectResult.data, capabilities };
}
