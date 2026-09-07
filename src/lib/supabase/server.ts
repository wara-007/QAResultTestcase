import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { hasValidSupabasePublicConfig } from "@/lib/supabase/config";

export async function createClient() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || !hasValidSupabasePublicConfig()) throw new Error("Supabase Project URL หรือ Publishable key ไม่ถูกต้อง");

  return createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot write cookies. Proxy refreshes the session.
        }
      },
    },
  });
}
