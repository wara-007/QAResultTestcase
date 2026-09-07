import { NextResponse } from "next/server";
import { appOrigin, GOOGLE_USER_COOKIE, safeReturnTo, sealGoogleToken } from "@/lib/google-user-oauth";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = appOrigin(requestUrl);
  const code = requestUrl.searchParams.get("code");
  const next = safeReturnTo(requestUrl.searchParams.get("next"));

  if (!code) {
    const message = requestUrl.searchParams.get("error_description") ?? "Google ไม่ส่ง authorization code กลับมา";
    return NextResponse.redirect(new URL(`/auth/login?error=${encodeURIComponent(message)}`, origin));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL(`/auth/login?error=${encodeURIComponent(error.message)}`, origin));
  }

  const response = NextResponse.redirect(new URL(next, origin));
  if (data.session?.provider_token) {
    response.cookies.set(GOOGLE_USER_COOKIE, sealGoogleToken({
      access_token: data.session.provider_token,
      refresh_token: data.session.provider_refresh_token,
    }), {
      httpOnly: true,
      sameSite: "lax",
      secure: requestUrl.protocol === "https:",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
  }
  return response;
}
