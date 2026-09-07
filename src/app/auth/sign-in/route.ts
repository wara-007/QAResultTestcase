import { NextResponse } from "next/server";
import { appOrigin, GOOGLE_USER_SCOPES, safeReturnTo } from "@/lib/google-user-oauth";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = appOrigin(requestUrl);
  const next = safeReturnTo(requestUrl.searchParams.get("next"));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      scopes: GOOGLE_USER_SCOPES.join(" "),
      queryParams: { access_type: "offline", prompt: "consent" },
    },
  });

  if (error || !data.url) {
    const message = error?.message ?? "เริ่ม Google Login ไม่สำเร็จ";
    return NextResponse.redirect(new URL(`/auth/login?error=${encodeURIComponent(message)}`, origin));
  }

  return NextResponse.redirect(data.url);
}
