import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { google, type Auth } from "googleapis";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export const GOOGLE_USER_COOKIE = "qa_google_oauth";
export const GOOGLE_OAUTH_STATE_COOKIE = "qa_google_oauth_state";
export const AUTH_RETURN_TO_COOKIE = "qa_auth_return_to";
export const GOOGLE_USER_SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/userinfo.email",
];

export class GoogleConnectionRequiredError extends Error {
  constructor() {
    super("กรุณาเชื่อม Google Drive และ Google Sheets");
    this.name = "GoogleConnectionRequiredError";
  }
}

export function appOrigin(requestUrl: string | URL) {
  const requestOrigin = new URL(requestUrl);
  const isLocalhost = ["localhost", "127.0.0.1", "::1"].includes(requestOrigin.hostname);

  // Local development must return to the same host and port that started OAuth.
  // NEXT_PUBLIC_SITE_URL is the production fallback and must not override localhost.
  if (isLocalhost) return requestOrigin.origin;

  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (configured) return configured.startsWith("http") ? configured : `https://${configured}`;
  return requestOrigin.origin;
}

function cookieKey() {
  const secret = process.env.GOOGLE_OAUTH_COOKIE_SECRET || process.env.PROJECT_ADMIN_SECRET;
  if (!secret) throw new Error("ยังไม่ได้ตั้งค่า GOOGLE_OAUTH_COOKIE_SECRET");
  return createHash("sha256").update(secret).digest();
}

export function googleOAuthClient(redirectUri?: string) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("ยังไม่ได้ตั้งค่า GOOGLE_OAUTH_CLIENT_ID และ GOOGLE_OAUTH_CLIENT_SECRET");
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function sealGoogleToken(value: Auth.Credentials | Record<string, unknown>) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", cookieKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
}

export function openGoogleToken(value: string) {
  const payload = Buffer.from(value, "base64url");
  if (payload.length < 29) throw new Error("Google OAuth session ไม่ถูกต้อง");
  const decipher = createDecipheriv("aes-256-gcm", cookieKey(), payload.subarray(0, 12));
  decipher.setAuthTag(payload.subarray(12, 28));
  return JSON.parse(Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]).toString("utf8")) as Auth.Credentials;
}

export async function loadSavedGoogleCredentials() {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : "";
  if (claimsError || !userId) return null;
  const { data, error } = await supabase
    .from("google_oauth_connections")
    .select("token_ciphertext")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`โหลดสิทธิ์ Google ที่บันทึกไว้ไม่สำเร็จ: ${error.message}`);
  return data?.token_ciphertext ? openGoogleToken(data.token_ciphertext) : null;
}

export async function saveGoogleCredentials(credentials: Auth.Credentials) {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : "";
  if (claimsError || !userId) throw new Error("กรุณาเข้าสู่ระบบก่อนเชื่อม Google Drive และ Sheets");
  const { error } = await supabase.from("google_oauth_connections").upsert({
    user_id: userId,
    token_ciphertext: sealGoogleToken(credentials),
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (error) throw new Error(`บันทึกสิทธิ์ Google ไม่สำเร็จ: ${error.message}`);
}

export async function getGoogleUserAuth() {
  const tokenCookie = (await cookies()).get(GOOGLE_USER_COOKIE)?.value;
  const credentials = await loadSavedGoogleCredentials() ?? (tokenCookie ? openGoogleToken(tokenCookie) : null);
  if (!credentials) throw new GoogleConnectionRequiredError();
  const oauth = googleOAuthClient();
  oauth.setCredentials(credentials);
  return oauth;
}

export function safeReturnTo(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/groups";
}
