import { ACCESS_CHECK_UNAVAILABLE, isMissingRoleFunction, isTemporaryAuthFailure } from "./auth-check";
import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/access-flow";

export { destinationForRole } from "@/lib/access-flow";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export async function resolveAppRole(supabase: SupabaseServerClient, email: string): Promise<AppRole | null> {
  const roleResult = await supabase.rpc("get_my_app_role").abortSignal(AbortSignal.timeout(12_000));
  if (!roleResult.error) {
    if (roleResult.data === 'qa' || roleResult.data === 'po') return roleResult.data;
    if (roleResult.data === null) return null;
    throw new Error(ACCESS_CHECK_UNAVAILABLE);
  }
  if (!isMissingRoleFunction(roleResult.error)) throw new Error(ACCESS_CHECK_UNAVAILABLE);

  // Compatibility while the role migration is being installed.
  const legacyAccess = await supabase.rpc("is_app_authorized").abortSignal(AbortSignal.timeout(12_000));
  if (legacyAccess.error) throw new Error(ACCESS_CHECK_UNAVAILABLE);
  if (!legacyAccess.error && legacyAccess.data === true) return "qa";

  const poRequest = await createAdminClient().from("project_approval_requests")
    .select("id").eq("recipient_email", email.toLowerCase()).neq("status", "revoked").limit(1).maybeSingle();
  if (poRequest.error) throw new Error(ACCESS_CHECK_UNAVAILABLE);
  return poRequest.data ? "po" : null;
}

export async function getCurrentAppSession() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const email = typeof data?.claims?.email === "string" ? data.claims.email.toLowerCase() : "";
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : "";
  if (isTemporaryAuthFailure(error)) throw new Error(ACCESS_CHECK_UNAVAILABLE);
  if (error || !email || !userId) return null;
  const metadata = data?.claims?.user_metadata;
  const passwordConfigured = Boolean(metadata && typeof metadata === "object" && "password_configured" in metadata && metadata.password_configured === true);
  return { userId, email, passwordConfigured, role: await resolveAppRole(supabase, email) };
}
