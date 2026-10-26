import { formatFlexibleDate } from "./date-format";

export type MailProvider = "gmail" | "microsoft";
export type MailConnection = { email: string; provider: MailProvider | null; connected: boolean; configured: boolean; error?: string };

export function mailProvider(email: string): MailProvider | null {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+$/.test(normalized)) return null;
  const domain = normalized.split("@")[1];
  return domain === "gmail.com" ? "gmail" : domain === "truecorp.co.th" ? "microsoft" : null;
}

export function safeMailReturnTo(value: string | null | undefined) {
  if (!value?.startsWith("/") || value.startsWith("//")) return "/groups";
  try {
    if (/[\\\x00-\x20]/.test(decodeURIComponent(value))) return "/groups";
    const url = new URL(value, "https://mail-return.invalid");
    if (url.origin !== "https://mail-return.invalid") return "/groups";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return "/groups"; }
}

function cleanReturnUrl(returnTo: string) {
  const url = new URL(safeMailReturnTo(returnTo), "https://mail-return.invalid");
  for (const key of ["gmailAuth", "gmailAuthError", "mailAuth", "mailAuthError"]) url.searchParams.delete(key);
  return url;
}

export function mailReturnTo(returnTo: string, error?: string) {
  const url = cleanReturnUrl(returnTo);
  url.searchParams.set(error ? "mailAuthError" : "mailAuth", error ?? "connected");
  return `${url.pathname}${url.search}${url.hash}`;
}

export function mailConnectUrl(provider: MailProvider, returnTo: string) {
  const url = cleanReturnUrl(returnTo);
  const path = `${url.pathname}${url.search}${url.hash}`;
  return provider === "gmail"
    ? `/api/google/auth/start?purpose=mail&returnTo=${encodeURIComponent(path)}`
    : `/api/microsoft/auth/start?returnTo=${encodeURIComponent(path)}`;
}

export function mailProviderLabel(provider: MailProvider | null) {
  return provider === "gmail" ? "Gmail" : provider === "microsoft" ? "Microsoft 365 / Outlook" : "อีเมล";
}

export function mailDeliveryLabel(emailId: string, sentAt: string) {
  if (/^(smtp|gmail|microsoft)-pending/.test(emailId)) return "กำลังส่งอีเมล / รอยืนยันผลการส่ง";
  if (/^(smtp|gmail|microsoft)-unknown/.test(emailId)) return "ยังยืนยันการส่งไม่ได้ กรุณาตรวจ Sent ก่อนส่งซ้ำ";
  if (/^(smtp|gmail|microsoft)(-update)?:/.test(emailId)) {
    const provider = emailId.startsWith("microsoft") ? "Microsoft 365" : "Gmail";
    return `${provider} รับคำขอส่งแล้ว${sentAt ? ` · ${formatFlexibleDate(sentAt)}` : ""}`;
  }
  if (/^(smtp|gmail|microsoft)-failed$/.test(emailId)) return "ส่งอีเมลไม่สำเร็จ";
  return "สร้างคำขอแล้ว · ยังยืนยันการส่งอีเมลไม่ได้";
}
