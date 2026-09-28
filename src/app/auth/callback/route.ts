import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { resolveAppRole } from "@/lib/app-session";
import { authorizedDestination, pendingAccessDestination } from "@/lib/access-flow";
import { appOrigin, AUTH_RETURN_TO_COOKIE, GOOGLE_USER_COOKIE, safeReturnTo } from "@/lib/google-user-oauth";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = appOrigin(requestUrl);
  const code = requestUrl.searchParams.get("code");
  const next = safeReturnTo((await cookies()).get(AUTH_RETURN_TO_COOKIE)?.value ?? requestUrl.searchParams.get("next"));

  if (!code) {
    const message = requestUrl.searchParams.get("error_description") ?? "ระบบยืนยันตัวตนไม่ส่ง authorization code กลับมา";
    const response = NextResponse.redirect(new URL(`/auth/login?error=${encodeURIComponent(message)}`, origin));
    response.cookies.delete(AUTH_RETURN_TO_COOKIE);
    return response;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    const response = NextResponse.redirect(new URL(`/auth/login?error=${encodeURIComponent(error.message)}`, origin));
    response.cookies.delete(AUTH_RETURN_TO_COOKIE);
    return response;
  }

  const email = data.user.email?.toLowerCase() ?? "";
  const role = email ? await resolveAppRole(supabase, email) : null;
  if (!role) {
    const denied = NextResponse.redirect(new URL(pendingAccessDestination(email, next), origin));
    denied.cookies.delete(GOOGLE_USER_COOKIE);
    denied.cookies.delete(AUTH_RETURN_TO_COOKIE);
    return denied;
  }

  const metadata = data.user.user_metadata as Record<string, unknown> | undefined;
  const destination = authorizedDestination(role, next, metadata?.password_configured === true);
  const response = NextResponse.redirect(new URL(destination, origin));
  response.cookies.delete(AUTH_RETURN_TO_COOKIE);
  return response;
}
