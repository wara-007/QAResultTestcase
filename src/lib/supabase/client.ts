import { createBrowserClient } from "@supabase/ssr";
import { hasValidSupabasePublicConfig } from "@/lib/supabase/config";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || !hasValidSupabasePublicConfig()) throw new Error("Supabase Project URL หรือ Publishable key ไม่ถูกต้อง");
  return createBrowserClient(url, key);
}

export const isSupabaseConfigured = hasValidSupabasePublicConfig;
