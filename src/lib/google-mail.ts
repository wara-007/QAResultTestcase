import type { Auth } from "googleapis";

export const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";
export const GOOGLE_MAIL_SCOPES = [GMAIL_SEND_SCOPE, "https://www.googleapis.com/auth/userinfo.email"];
export function googleConsentOptions(purpose: "mail" | "drive", state: string, email: string, driveScopes: string[]) {
  return {access_type: "offline" as const, prompt: "consent", include_granted_scopes: false,
    scope: purpose === "mail" ? GOOGLE_MAIL_SCOPES : driveScopes, state,
    login_hint: purpose === "mail" ? email : undefined};
}
export type GoogleMailCredentials = Auth.Credentials & { mail_email: string };
export class GoogleMailConnectionRequiredError extends Error {
  constructor() { super("กรุณาเชื่อม Gmail ของบัญชี QA ที่เข้าสู่ระบบ และอนุญาตส่งอีเมล"); this.name = "GoogleMailConnectionRequiredError"; }
}

export function canSendGoogleMail(credentials: (Auth.Credentials & {mail_email?: string}) | null, expectedEmail: string) {
  return !!credentials?.refresh_token && !!expectedEmail && credentials.mail_email?.toLowerCase() === expectedEmail.trim().toLowerCase()
    && (credentials.scope ?? "").split(/\s+/).includes(GMAIL_SEND_SCOPE);
}

export function mailCredentials(tokens: Auth.Credentials, profile: {email?: string | null; verified_email?: boolean | null}, expectedEmail: string, existing: GoogleMailCredentials | null): GoogleMailCredentials {
  const email = profile.email?.trim().toLowerCase();
  if (!expectedEmail || !profile.verified_email || email !== expectedEmail.trim().toLowerCase()) throw new Error("กรุณาเลือกบัญชี Google อีเมลเดียวกับ QA ที่เข้าสู่ระบบ");
  const refresh = tokens.refresh_token || (existing?.mail_email === email ? existing.refresh_token : undefined);
  const saved = {...tokens, refresh_token: refresh, mail_email: email};
  if (!canSendGoogleMail(saved, expectedEmail)) throw new GoogleMailConnectionRequiredError();
  return saved;
}

export function gmailFailure(reason: unknown): {message: string; reauthorize: boolean; uncertain: boolean} {
  const error = reason as { name?: string; code?: number | string; response?: {status?: number; data?: {error?: string | {message?: string; status?: string; errors?: {reason?: string}[]; details?: {reason?: string}[]}}} } | null;
  const api = error?.response?.data?.error;
  const reasons = typeof api === "object" ? [...(api.errors ?? []), ...(api.details ?? [])].map(value => value.reason ?? "").join(" ") : "";
  const description = typeof api === "string" ? api : typeof api === "object" ? api.message ?? "" : "";
  if (/accessNotConfigured|SERVICE_DISABLED/i.test(reasons) || /API has not been used|it is disabled/i.test(description)) return {message: "ยังไม่ได้เปิด Gmail API ใน Google Cloud ของแอป กรุณาให้ผู้ดูแลเปิด API ก่อนส่ง", reauthorize: false, uncertain: false};
  if (error?.name === "GoogleMailConnectionRequiredError" || error?.response?.status === 401 || error?.code === 401 || /invalid_grant|insufficient.*scope/i.test(description) || /ACCESS_TOKEN_SCOPE_INSUFFICIENT|insufficientPermissions|authError/i.test(reasons)) return {message: "สิทธิ์ส่ง Gmail ยังไม่พร้อมหรือถูกถอน กรุณาเชื่อม Gmail ใหม่", reauthorize: true, uncertain: false};
  if (error?.response?.status === 429 || /rateLimitExceeded|dailyLimitExceeded|userRateLimitExceeded/i.test(reasons)) return {message: "Gmail จำกัดจำนวนการส่ง กรุณารอและตรวจ Sent ก่อนส่งซ้ำ", reauthorize: false, uncertain: false};
  const status = error?.response?.status ?? (typeof error?.code === "number" ? error.code : undefined);
  return {message: "ยังยืนยันการส่งอีเมลไม่ได้ กรุณาตรวจ Sent ของบัญชี QA ก่อนส่งซ้ำ หากถูกนโยบายบริษัทบล็อกให้ติดต่อ IT", reauthorize: false, uncertain: !(status && status >= 400 && status < 500)};
}

export function gmailReturnTo(returnTo: string, error?: string) {
  const safe = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/groups";
  const url = new URL(safe, "http://local");
  url.searchParams.delete("gmailAuth"); url.searchParams.delete("gmailAuthError");
  url.searchParams.set(error ? "gmailAuthError" : "gmailAuth", error ?? "connected");
  return `${url.pathname}${url.search}${url.hash}`;
}

export function gmailConnectUrl(returnTo: string) {
  const safe = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/groups";
  const current = new URL(safe, "http://local");
  current.searchParams.delete("gmailAuth"); current.searchParams.delete("gmailAuthError");
  return `/api/google/auth/start?purpose=mail&returnTo=${encodeURIComponent(`${current.pathname}${current.search}${current.hash}`)}`;
}
