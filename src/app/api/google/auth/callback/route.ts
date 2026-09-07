import { NextResponse } from "next/server";
import { appOrigin, googleOAuthClient, GOOGLE_OAUTH_STATE_COOKIE, GOOGLE_USER_COOKIE, openGoogleToken, safeReturnTo, sealGoogleToken } from "@/lib/google-user-oauth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = appOrigin(url);
  try {
    const stateCookie = request.headers.get("cookie")?.match(new RegExp(`(?:^|; )${GOOGLE_OAUTH_STATE_COOKIE}=([^;]+)`))?.[1];
    if (!stateCookie) throw new Error("Google OAuth session หมดอายุ");
    const stateData = openGoogleToken(decodeURIComponent(stateCookie)) as { state?: string; returnTo?: string };
    if (!url.searchParams.get("state") || url.searchParams.get("state") !== stateData.state) throw new Error("Google OAuth state ไม่ถูกต้อง");
    const code = url.searchParams.get("code");
    if (!code) throw new Error(url.searchParams.get("error") || "Google ไม่ส่ง authorization code กลับมา");
    const oauth = googleOAuthClient(`${origin}/api/google/auth/callback`);
    const { tokens } = await oauth.getToken(code);
    const response = NextResponse.redirect(new URL(safeReturnTo(stateData.returnTo ?? null), origin));
    response.cookies.set(GOOGLE_USER_COOKIE, sealGoogleToken(tokens), {
      httpOnly: true, sameSite: "lax", secure: url.protocol === "https:", maxAge: 60 * 60 * 24 * 30, path: "/",
    });
    response.cookies.delete(GOOGLE_OAUTH_STATE_COOKIE);
    return response;
  } catch (reason) {
    return NextResponse.redirect(new URL(`/?googleAuthError=${encodeURIComponent(reason instanceof Error ? reason.message : "Google OAuth ไม่สำเร็จ")}`, origin));
  }
}
