import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { google, type Auth } from "googleapis";
import { cookies } from "next/headers";

export const GOOGLE_USER_COOKIE = "qa_google_oauth";
export const GOOGLE_OAUTH_STATE_COOKIE = "qa_google_oauth_state";
export const GOOGLE_USER_SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/userinfo.email",
];

export function appOrigin(requestUrl: string | URL) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (configured) return configured.startsWith("http") ? configured : `https://${configured}`;
  return new URL(requestUrl).origin;
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

export async function getGoogleUserAuth() {
  const tokenCookie = (await cookies()).get(GOOGLE_USER_COOKIE)?.value;
  if (!tokenCookie) throw new Error("กรุณาออกจากระบบแล้ว Login Google ใหม่เพื่ออนุญาต Google Sheets");
  const oauth = googleOAuthClient();
  oauth.setCredentials(openGoogleToken(tokenCookie));
  return oauth;
}

export function safeReturnTo(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/groups";
}
