import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type AppRole = "qa" | "po";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export async function resolveAppRole(supabase: SupabaseServerClient, email: string): Promise<AppRole | null> {
  const roleResult = await supabase.rpc("get_my_app_role");
  if (!roleResult.error && (roleResult.data === "qa" || roleResult.data === "po")) return roleResult.data;

  // Compatibility while the role migration is being installed.
  const legacyAccess = await supabase.rpc("is_app_authorized");
  if (!legacyAccess.error && legacyAccess.data === true) return "qa";

  const poRequest = await createAdminClient().from("project_approval_requests")
    .select("id").eq("recipient_email", email.toLowerCase()).neq("status", "revoked").limit(1).maybeSingle();
  return poRequest.data ? "po" : null;
}

export function destinationForRole(role: AppRole, requestedPath: string) {
  if (requestedPath === "/auth/update-password") return requestedPath;
  if (role === "po") return requestedPath === "/approvals" || requestedPath.startsWith("/approvals/") ? requestedPath : "/approvals";
  return requestedPath === "/groups" || requestedPath.startsWith("/groups/") || requestedPath.startsWith("/admin/") ? requestedPath : "/groups";
}

export async function getCurrentAppSession() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const email = typeof data?.claims?.email === "string" ? data.claims.email.toLowerCase() : "";
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : "";
  if (error || !email || !userId) return null;
  return { userId, email, role: await resolveAppRole(supabase, email) };
}
