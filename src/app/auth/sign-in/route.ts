import { NextResponse } from "next/server";
import { destinationForRole, resolveAppRole } from "@/lib/app-session";
import { appOrigin, AUTH_RETURN_TO_COOKIE, safeReturnTo } from "@/lib/google-user-oauth";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = appOrigin(requestUrl);
  const next = safeReturnTo(requestUrl.searchParams.get("next"));
  const supabase = await createClient();

  const { data: existingSession } = await supabase.auth.getClaims();
  const existingEmail = typeof existingSession?.claims?.email === "string" ? existingSession.claims.email.toLowerCase() : "";
  if (existingEmail) {
    const role = await resolveAppRole(supabase, existingEmail);
    if (role) return NextResponse.redirect(new URL(destinationForRole(role, next), origin));
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`,
      scopes: "email profile",
    },
  });

  if (error || !data.url) {
    const message = error?.message ?? "เริ่ม Google Login ไม่สำเร็จ";
    return NextResponse.redirect(new URL(`/auth/login?error=${encodeURIComponent(message)}`, origin));
  }

  const response = NextResponse.redirect(data.url);
  response.cookies.set(AUTH_RETURN_TO_COOKIE, next, {
    httpOnly: true,
    sameSite: "lax",
    secure: requestUrl.protocol === "https:",
    maxAge: 10 * 60,
    path: "/",
  });
  return response;
}
