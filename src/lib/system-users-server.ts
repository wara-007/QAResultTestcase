import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { SystemUser } from "@/lib/types";

type SystemUserRow = {
  user_id: string;
  email: string;
  display_name: string;
  is_system_owner: boolean;
  last_sign_in_at: string | null;
};

export async function loadSystemUsers(): Promise<{ users: SystemUser[]; error: string; authorized: boolean }> {
  const supabase = await createClient();
  const { data: ownerData, error: ownerError } = await supabase.rpc("is_system_owner");
  if (ownerError || ownerData !== true) {
    return { users: [], error: ownerError?.message ?? "คุณไม่มีสิทธิ์เข้าถึงหน้านี้", authorized: false };
  }

  const { data, error } = await supabase.rpc("list_system_users");
  return {
    authorized: true,
    error: error?.message ?? "",
    users: ((data ?? []) as SystemUserRow[]).map((user) => ({
      id: user.user_id,
      email: user.email,
      displayName: user.display_name,
      isSystemOwner: user.is_system_owner,
      lastSignInAt: user.last_sign_in_at,
    })),
  };
}
