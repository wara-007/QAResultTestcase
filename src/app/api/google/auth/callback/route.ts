import { NextResponse } from "next/server";
import { appOrigin, googleOAuthClient, GOOGLE_OAUTH_STATE_COOKIE, GOOGLE_USER_COOKIE, loadSavedGoogleCredentials, openGoogleToken, safeReturnTo, saveGoogleCredentials, sealGoogleToken } from "@/lib/google-user-oauth";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = appOrigin(url);
  try {
    const stateCookie = request.headers.get("cookie")?.match(new RegExp(`(?:^|; )${GOOGLE_OAUTH_STATE_COOKIE}=([^;]+)`))?.[1];
    if (!stateCookie) throw new Error("Google OAuth session หมดอายุ");
    const stateData = openGoogleToken(decodeURIComponent(stateCookie)) as { state?: string; returnTo?: string; userId?: string };
    if (!url.searchParams.get("state") || url.searchParams.get("state") !== stateData.state) throw new Error("Google OAuth state ไม่ถูกต้อง");
    const supabase = await createClient();
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : "";
    if (claimsError || !userId || userId !== stateData.userId) throw new Error("บัญชีที่เชื่อม Google ไม่ตรงกับบัญชีที่เข้าสู่ระบบ");
    const code = url.searchParams.get("code");
    if (!code) throw new Error(url.searchParams.get("error") || "Google ไม่ส่ง authorization code กลับมา");
    const oauth = googleOAuthClient(`${origin}/api/google/auth/callback`);
    const { tokens } = await oauth.getToken(code);
    const existing = await loadSavedGoogleCredentials();
    const persistentTokens = { ...existing, ...tokens, refresh_token: tokens.refresh_token ?? existing?.refresh_token };
    if (!persistentTokens.refresh_token) throw new Error("Google ไม่ส่ง refresh token กรุณาถอนสิทธิ์แอปจาก Google Account แล้วเชื่อมใหม่อีกครั้ง");
    await saveGoogleCredentials(persistentTokens);
    const response = NextResponse.redirect(new URL(safeReturnTo(stateData.returnTo ?? null), origin));
    response.cookies.set(GOOGLE_USER_COOKIE, sealGoogleToken(persistentTokens), {
      httpOnly: true, sameSite: "lax", secure: url.protocol === "https:", maxAge: 60 * 60 * 24 * 400, path: "/",
    });
    response.cookies.delete(GOOGLE_OAUTH_STATE_COOKIE);
    return response;
  } catch (reason) {
    return NextResponse.redirect(new URL(`/?googleAuthError=${encodeURIComponent(reason instanceof Error ? reason.message : "Google OAuth ไม่สำเร็จ")}`, origin));
  }
}
