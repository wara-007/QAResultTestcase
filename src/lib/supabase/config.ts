export function hasValidSupabasePublicConfig() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!rawUrl || !key) return false;

  try {
    const hostname = new URL(rawUrl).hostname;
    const validHost = hostname.endsWith(".supabase.co") || hostname === "localhost" || hostname === "127.0.0.1";
    const validKey = key.startsWith("sb_publishable_") || (key.startsWith("eyJ") && key.split(".").length === 3);
    return validHost && validKey;
  } catch {
    return false;
  }
}
