import { NextResponse } from "next/server";
import { appOrigin, googleOAuthClient, GOOGLE_OAUTH_STATE_COOKIE, GOOGLE_USER_COOKIE, loadSavedGoogleCredentials, openGoogleToken, safeReturnTo, saveGoogleCredentials } from "@/lib/google-user-oauth";
import { createClient } from "@/lib/supabase/server";
import { googleAuthorizationReturn } from "@/lib/google-authorization";
import { google } from "googleapis";
import { gmailReturnTo, mailCredentials } from "@/lib/google-mail";
import { loadGoogleMailCredentials, saveGoogleMailCredentials } from "@/lib/google-mail-server";
import { approvalSenderEmail } from "@/lib/mail-provider";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = appOrigin(url);
  let returnTo = "/groups";
  let mailPurpose = false;
  try {
    const stateCookie = request.headers.get("cookie")?.match(new RegExp(`(?:^|; )${GOOGLE_OAUTH_STATE_COOKIE}=([^;]+)`))?.[1];
    if (!stateCookie) throw new Error("Google OAuth session หมดอายุ");
    const stateData = openGoogleToken(decodeURIComponent(stateCookie)) as { state?: string; returnTo?: string; userId?: string; purpose?: string; senderEmail?: string };
    if (!url.searchParams.get("state") || url.searchParams.get("state") !== stateData.state) throw new Error("Google OAuth state ไม่ถูกต้อง");
    returnTo = safeReturnTo(stateData.returnTo ?? null);
    mailPurpose = stateData.purpose === "mail";
    const supabase = await createClient();
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : "";
    if (claimsError || !userId || userId !== stateData.userId) throw new Error("บัญชีที่เชื่อม Google ไม่ตรงกับบัญชีที่เข้าสู่ระบบ");
    const code = url.searchParams.get("code");
    if (!code) throw new Error(url.searchParams.get("error") || "Google ไม่ส่ง authorization code กลับมา");
    const oauth = googleOAuthClient(`${origin}/api/google/auth/callback`);
    const { tokens } = await oauth.getToken(code);
    if (mailPurpose) {
      oauth.setCredentials(tokens);
      const profile = await google.oauth2({version: "v2", auth: oauth}).userinfo.get({}, {timeout: 15_000, retry: false});
      // Verify actual granted scopes, including granular-consent users who did not select Send.
      if (!tokens.scope && tokens.access_token) tokens.scope = (await oauth.getTokenInfo(tokens.access_token)).scopes.join(" ");
      const expectedEmail = approvalSenderEmail(stateData.senderEmail, typeof claimsData?.claims?.email === "string" ? claimsData.claims.email : "");
      const persistent = mailCredentials(tokens, profile.data, expectedEmail, await loadGoogleMailCredentials());
      await saveGoogleMailCredentials(persistent);
      const response = NextResponse.redirect(new URL(gmailReturnTo(returnTo), origin));
      response.cookies.delete(GOOGLE_USER_COOKIE);
      response.cookies.delete(GOOGLE_OAUTH_STATE_COOKIE);
      return response;
    }
    const existing = await loadSavedGoogleCredentials();
    const persistentTokens = { ...existing, ...tokens, refresh_token: tokens.refresh_token ?? existing?.refresh_token };
    if (!persistentTokens.refresh_token) throw new Error("Google ไม่ส่ง refresh token กรุณาถอนสิทธิ์แอปจาก Google Account แล้วเชื่อมใหม่อีกครั้ง");
    await saveGoogleCredentials(persistentTokens);
    const response = NextResponse.redirect(new URL(googleAuthorizationReturn(returnTo), origin));
    // Credentials were persisted server-side above. Never serialize tokens into a browser cookie,
    // including combined Gmail scopes from older authorization flows.
    response.cookies.delete(GOOGLE_USER_COOKIE);
    response.cookies.delete(GOOGLE_OAUTH_STATE_COOKIE);
    return response;
  } catch (reason) {
    // Do not serialize upstream OAuth errors: they can contain credential-bearing request details.
    const message = mailPurpose ? (reason instanceof Error && /กรุณา|บันทึกสิทธิ์|migration|บัญชี|session|state/.test(reason.message) ? reason.message : "เชื่อม Gmail ไม่สำเร็จ กรุณาลองใหม่หรือติดต่อผู้ดูแล Google Workspace") : reason instanceof Error ? reason.message : "Google OAuth ไม่สำเร็จ";
    const response = NextResponse.redirect(new URL(mailPurpose ? gmailReturnTo(returnTo, message) : googleAuthorizationReturn(returnTo, message), origin));
    response.cookies.delete(GOOGLE_OAUTH_STATE_COOKIE);
    return response;
  }
}
