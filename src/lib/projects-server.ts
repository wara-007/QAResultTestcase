import "server-only";

import { hasValidSupabasePublicConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { projectCapabilitiesFromRow, type ProjectAccessRow } from "@/lib/project-capabilities";
import type { CurrentUser, Project } from "@/lib/types";

type ProjectAccessRpcRow = ProjectAccessRow & { project_id: string };
type ProjectCatalogRow = { id: string; name: string; description: string; sprint_no: string; sprint_id?: string; environment: string; google_sheet_id: string | null; google_sheet_url: string | null; owner_id: string; created_at: string; updated_at: string; sprints?: { workspace_years: { year: number } } | null };

export async function loadProjects(groupId: string): Promise<{
  configured: boolean;
  projects: Project[];
  error: string;
  currentUser: CurrentUser | null;
}> {
  if (!hasValidSupabasePublicConfig()) {
    return { configured: false, projects: [], error: "", currentUser: null };
  }

  const supabase = await createClient();
  await supabase.rpc("claim_group_invitations");
  const [catalogResult, { data: authData }, { data: isSystemOwner }, accessResult] = await Promise.all([
    supabase.from("projects").select("id, name, description, sprint_no, sprint_id, environment, google_sheet_id, google_sheet_url, owner_id, created_at, updated_at, sprints(workspace_years(year))").eq("group_id", groupId).order("created_at", { ascending: false }),
    supabase.auth.getUser(),
    supabase.rpc("is_system_owner"),
    supabase.rpc("list_project_access", { requested_group_id: groupId }),
  ]);
  let rows = (catalogResult.data ?? []) as unknown as ProjectCatalogRow[];
  let catalogError = catalogResult.error;
  // Keep existing Project deep links readable during the database rollout.
  if (catalogError && ["42703", "PGRST200", "PGRST204"].includes(catalogError.code)) {
    const legacy = await supabase.from("projects").select("id,name,description,sprint_no,environment,google_sheet_id,google_sheet_url,owner_id,created_at,updated_at").eq("group_id", groupId).order("created_at", { ascending: false });
    rows = (legacy.data ?? []) as ProjectCatalogRow[];
    catalogError = legacy.error;
  }

  const user = authData.user;
  const currentUser = user ? {
    id: user.id,
    email: user.email ?? "",
    name: String(user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email?.split("@")[0] ?? "QA"),
    isSystemOwner: isSystemOwner === true,
  } : null;

  if (catalogError || accessResult.error) return { configured: true, projects: [], error: catalogError?.message ?? accessResult.error?.message ?? "โหลดสิทธิ์ Project ไม่สำเร็จ", currentUser };

  const accessByProject = new Map(((accessResult.data ?? []) as ProjectAccessRpcRow[])
    .map((access) => [access.project_id, projectCapabilitiesFromRow(access)]));

  return {
    configured: true,
    error: "",
    currentUser,
    projects: rows.map((project) => ({
      id: project.id,
      name: project.name,
      description: project.description,
      sprintNo: project.sprint_no,
      sprintId: project.sprint_id,
      year: project.sprints?.workspace_years?.year,
      updatedAt: project.updated_at,
      environment: project.environment,
      googleSheetId: project.google_sheet_id ?? "",
      googleSheetUrl: project.google_sheet_url ?? "",
      createdAt: project.created_at,
      ...(accessByProject.get(project.id) ?? {
        canView: true,
        canEdit: false,
        canManage: false,
        canDelete: project.owner_id === user?.id || isSystemOwner === true,
      }),
    })),
  };
}
