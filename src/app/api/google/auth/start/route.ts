import { NextResponse } from "next/server";
import { appOrigin, googleOAuthClient, GOOGLE_OAUTH_STATE_COOKIE, GOOGLE_USER_SCOPES, safeReturnTo, sealGoogleToken } from "@/lib/google-user-oauth";
import { createClient } from "@/lib/supabase/server";
import { googleConsentOptions } from "@/lib/google-mail";
import { approvalSenderEmail, mailProvider } from "@/lib/mail-provider";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const origin = appOrigin(request.url);
    const returnTo = safeReturnTo(new URL(request.url).searchParams.get("returnTo"));
    const purpose = new URL(request.url).searchParams.get("purpose") === "mail" ? "mail" : "drive";
    const supabase = await createClient();
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : "";
    if (claimsError || !userId) throw new Error("กรุณาเข้าสู่ระบบก่อนเชื่อม Google Drive และ Sheets");
    const state = crypto.randomUUID();
    const oauth = googleOAuthClient(`${origin}/api/google/auth/callback`);
    const accountEmail = typeof claimsData?.claims?.email === "string" ? claimsData.claims.email : "";
    const email = purpose === "mail" ? approvalSenderEmail(new URL(request.url).searchParams.get("senderEmail") ?? undefined, accountEmail) : accountEmail;
    if (purpose === "mail" && mailProvider(email) !== "gmail") throw new Error("กรุณาใช้อีเมล Gmail สำหรับเชื่อมบัญชีนี้");
    const response = NextResponse.redirect(oauth.generateAuthUrl(googleConsentOptions(purpose, state, email, GOOGLE_USER_SCOPES)));
    response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, sealGoogleToken({ state, returnTo, userId, purpose, senderEmail: purpose === "mail" ? email : undefined }), {
      httpOnly: true, sameSite: "lax", secure: origin.startsWith("https://"), maxAge: 600, path: "/",
    });
    return response;
  } catch (reason) {
    return NextResponse.json({ error: reason instanceof Error ? reason.message : "เริ่ม Google OAuth ไม่สำเร็จ" }, { status: 400 });
  }
}
