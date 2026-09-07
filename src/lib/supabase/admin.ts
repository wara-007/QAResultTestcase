import "server-only";

import { createClient } from "@supabase/supabase-js";
import { hasValidSupabasePublicConfig } from "@/lib/supabase/config";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret || !hasValidSupabasePublicConfig()) throw new Error("ยังไม่ได้ตั้งค่า SUPABASE_SECRET_KEY ฝั่ง server");
  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function verifyProjectAdminSecret(value: string) {
  const expected = process.env.PROJECT_ADMIN_SECRET;
  if (!expected) throw new Error("ยังไม่ได้ตั้งค่า PROJECT_ADMIN_SECRET");
  if (value !== expected) throw new Error("Admin code ไม่ถูกต้อง");
}
