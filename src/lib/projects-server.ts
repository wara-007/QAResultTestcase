import "server-only";

import { hasValidSupabasePublicConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { CurrentUser, Project } from "@/lib/types";

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
  const [{ data, error }, { data: authData }] = await Promise.all([
    supabase.from("projects").select("id, name, description, sprint_no, environment, google_sheet_id, google_sheet_url, created_at").eq("group_id", groupId).order("created_at", { ascending: false }),
    supabase.auth.getUser(),
  ]);

  const user = authData.user;
  const currentUser = user ? {
    id: user.id,
    email: user.email ?? "",
    name: String(user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email?.split("@")[0] ?? "QA"),
  } : null;

  if (error) return { configured: true, projects: [], error: error.message, currentUser };

  return {
    configured: true,
    error: "",
    currentUser,
    projects: (data ?? []).map((project) => ({
      id: project.id,
      name: project.name,
      description: project.description,
      sprintNo: project.sprint_no,
      environment: project.environment,
      googleSheetId: project.google_sheet_id ?? "",
      googleSheetUrl: project.google_sheet_url ?? "",
      createdAt: project.created_at,
    })),
  };
}
