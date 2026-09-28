import { NextResponse } from "next/server";
import { resolveAppRole } from "@/lib/app-session";
import { authorizedDestination, pendingAccessDestination } from "@/lib/access-flow";
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
    const metadata = existingSession?.claims?.user_metadata;
    const passwordConfigured = Boolean(metadata && typeof metadata === "object" && "password_configured" in metadata && metadata.password_configured === true);
    if (role) return NextResponse.redirect(new URL(authorizedDestination(role, next, passwordConfigured), origin));
    return NextResponse.redirect(new URL(pendingAccessDestination(existingEmail, next), origin));
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
