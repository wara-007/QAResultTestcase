import { gmailFailure } from "./google-mail";
import { microsoftFailure } from "./microsoft-mail";
import type { MailProvider } from "./mail-provider";
export const APPROVAL_SENDER = "qatrueapp@gmail.com"; // Legacy SMTP only; active approval delivery uses the QA's Gmail OAuth.

function address(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (/[\r\n]/.test(value) || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i.test(normalized) || normalized.length > 254) {
    throw new Error("กรุณาระบุอีเมลผู้รับ, CC และ Reply-To ให้ถูกต้อง");
  }
  return normalized;
}

export function gmailSmtpOptions(env: { GMAIL_USER?: string; GMAIL_APP_PASSWORD?: string }) {
  if (env.GMAIL_USER && env.GMAIL_USER.trim().toLowerCase() !== APPROVAL_SENDER) throw new Error(`GMAIL_USER ต้องเป็น ${APPROVAL_SENDER}`);
  const password = env.GMAIL_APP_PASSWORD?.replace(/\s/g, "") ?? "";
  if (!/^[a-z]{16}$/i.test(password)) throw new Error("กรุณาตั้งค่า GMAIL_APP_PASSWORD (App Password 16 ตัวอักษร) ใน Netlify แล้ว Deploy ใหม่");
  return { host: "smtp.gmail.com", port: 465, secure: true,
    auth: { user: APPROVAL_SENDER, pass: password }, tls: { minVersion: "TLSv1.2" as const },
    connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000,
    disableFileAccess: true, disableUrlAccess: true, logger: false, debug: false };
}

export function buildApprovalEmail(input: {
  recipientEmail: string; cc: string; subject: string; body: string; replyTo: string;
  projectName: string; sheetUrl: string; siteUrl: string; requestId: string; repeat: boolean;
  senderEmail?: string; senderName?: string;
}) {
  const to = address(input.recipientEmail);
  if (/[\r\n]/.test(input.cc) || /[\r\n]/.test(input.subject)) throw new Error("หัวข้อและอีเมลต้องไม่มีการขึ้นบรรทัดใหม่");
  const cc = [...new Set(input.cc.split(/[,;]/).map(value => value.trim()).filter(Boolean).map(address))].filter(email => email !== to);
  if (cc.length > 10 || input.subject.length > 300 || input.body.length > 50_000) throw new Error("รองรับ CC ไม่เกิน 10 คน, หัวข้อ 300 ตัวอักษร และเนื้อหา 50,000 ตัวอักษร");
  const url = new URL(input.siteUrl);
  if (url.protocol !== "https:" || url.username || url.password || /^(localhost|127\.|\[?::1)/i.test(url.hostname)) throw new Error("NEXT_PUBLIC_SITE_URL ต้องเป็น URL HTTPS ของเว็บจริง เพื่อให้ PO เปิดลิงก์ได้");
  const subject = `${input.repeat ? "[อัปเดต] " : ""}${input.subject.trim() || `[QA Approval] ${input.projectName.replace(/[\r\n]/g, " ")}`}`;
  const reviewUrl = `${url.origin}/approvals/${encodeURIComponent(input.requestId)}`;
  const sender = address(input.senderEmail ?? input.replyTo);
  if (sender !== address(input.replyTo)) throw new Error("ผู้ส่งต้องตรงกับบัญชี QA ที่เข้าสู่ระบบ");
  return { from: { name: (input.senderName || sender).replace(/[\r\n]/g, " ").slice(0, 160), address: sender }, to, cc, replyTo: sender, subject,
    text: [input.repeat ? "มีการอัปเดตผลการทดสอบ Project กรุณาตรวจสอบข้อมูลล่าสุด สถานะอนุมัติเดิมยังคงเดิม" : "", input.body.trim(), "", `เปิดหน้า Review และ Approve: ${reviewUrl}`, `Google Sheets: ${input.sheetUrl}`].filter(Boolean).join("\n") };
}

type Message = ReturnType<typeof buildApprovalEmail>;
type Receipt = { accepted: readonly unknown[]; rejected: readonly unknown[]; messageId: string; operationId?: string };
export type EmailDeliveryPatch = { email_sent_at: string | null; email_id: string; email_error: string };

export async function deliverApprovalEmail(message: Message, repeat: boolean,
  send: (message: Message) => Promise<Receipt>, save: (patch: EmailDeliveryPatch) => Promise<void>, provider: MailProvider = "gmail",
): Promise<{ ok: true; warning?: string } | { ok: false; error: string; reauthorize: boolean; warning?: never }> {
  let receipt: Receipt;
  try {
    receipt = await send(message);
    if (!receipt.accepted.some(value => String(value).toLowerCase() === message.to)) throw Object.assign(new Error("PO rejected"), {code: 400, status: 400});
  } catch (reason) {
    const error = provider === "microsoft" ? microsoftFailure(reason) : gmailFailure(reason);
    try { await save({email_sent_at: null, email_id: `${provider}-${"uncertain" in error && error.uncertain ? "unknown" : "failed"}`, email_error: error.message}); } catch { /* Keep pending lease until timeout; never pretend it was sent. */ }
    return {ok: false, error: error.message, reauthorize: error.reauthorize};
  }
  const warning = receipt.rejected.length ? `${provider === "microsoft" ? "Microsoft 365" : "Gmail"} ไม่รับ CC บางคน: ${receipt.rejected.map(String).join(", ")}` : undefined;
  try {
    await save({email_sent_at: new Date().toISOString(), email_id: `${provider}${repeat ? "-update" : ""}:${provider === "microsoft" ? `accepted:${receipt.operationId}` : receipt.messageId}`, email_error: warning ?? ""});
  } catch {
    return {ok: true, warning: "ผู้ให้บริการรับคำขอส่งแล้ว แต่บันทึกสถานะไม่สำเร็จ กรุณาตรวจ Sent ก่อนส่งซ้ำ"};
  }
  return {ok: true, warning};
}

export function approvalSendBlocked(existing: {email_id: string; requested_at: string; email_sent_at: string | null}, now = Date.now()) {
  return (/^(smtp|gmail|microsoft)-(pending|unknown)/.test(existing.email_id) && now - Date.parse(existing.requested_at) < 120_000)
    || /^(smtp|gmail|microsoft)(-update)?:/.test(existing.email_id) && !!existing.email_sent_at && now - Date.parse(existing.email_sent_at) < 30_000;
}
