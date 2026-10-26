import "server-only";
import { google } from "googleapis";
import { encodeGmailMessage } from "./gmail-message";
import { createClient } from "./supabase/server";
import { googleOAuthClient, openGoogleToken, sealGoogleToken } from "./google-user-oauth";
import { canSendGoogleMail, GoogleMailConnectionRequiredError, type GoogleMailCredentials } from "./google-mail";
import type { buildApprovalEmail } from "./approval-email";

async function mailStore() {
  const supabase = await createClient();
  const {data, error} = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || typeof userId !== "string") throw new Error("กรุณาเข้าสู่ระบบก่อนเชื่อม Gmail");
  return {supabase, userId};
}

export async function loadGoogleMailCredentials(): Promise<GoogleMailCredentials | null> {
  const {supabase, userId} = await mailStore();
  const {data, error} = await supabase.from("google_mail_connections").select("token_ciphertext").eq("user_id", userId).maybeSingle();
  if (error) throw new Error("โหลดสิทธิ์ Gmail ไม่สำเร็จ กรุณาตรวจว่าได้รัน migration google_mail_connections แล้ว");
  return data?.token_ciphertext ? openGoogleToken(data.token_ciphertext) as GoogleMailCredentials : null;
}

export async function saveGoogleMailCredentials(credentials: GoogleMailCredentials) {
  const {supabase, userId} = await mailStore();
  const {error} = await supabase.from("google_mail_connections").upsert({ user_id: userId, token_ciphertext: sealGoogleToken(credentials), updated_at: new Date().toISOString() }, {onConflict: "user_id"});
  if (error) throw new Error("บันทึกสิทธิ์ Gmail ไม่สำเร็จ กรุณาตรวจ migration และสิทธิ์ฐานข้อมูล");
}

export async function getQaGmailSender(expectedEmail: string) {
  // Only the current user's encrypted mail connection; never a Drive cookie or a central account.
  const credentials = await loadGoogleMailCredentials();
  if (!canSendGoogleMail(credentials, expectedEmail)) throw new GoogleMailConnectionRequiredError();
  const oauth = googleOAuthClient();
  oauth.setCredentials(credentials!);
  // Refresh and verify mailbox before reserving a request. Fail closed if the token is revoked.
  const profile = await google.oauth2({version: "v2", auth: oauth}).userinfo.get({}, {timeout: 15_000, retry: false});
  if (!profile.data.verified_email || profile.data.email?.toLowerCase() !== expectedEmail.toLowerCase()) throw new GoogleMailConnectionRequiredError();
  const gmail = google.gmail({version: "v1", auth: oauth});
  return async (message: ReturnType<typeof buildApprovalEmail>) => {
    if (message.from.address !== expectedEmail.toLowerCase()) throw new GoogleMailConnectionRequiredError();
    const result = await gmail.users.messages.send({userId: "me", requestBody: {raw: await encodeGmailMessage(message)}}, {timeout: 20_000, retry: false});
    if (!result.data.id) throw new Error("Missing Gmail receipt");
    return {accepted: [message.to, ...message.cc], rejected: [], messageId: result.data.id};
  };
}
