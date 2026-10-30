import type { MailProvider } from "./mail-provider";
// Only notification metadata: never reset a PO decision or rotate existing links.
export function approvalNotificationPatch(now: string, userId: string, name: string, repeat: boolean, provider: MailProvider = "gmail") {
  return { requested_at: now, requested_by: userId, requested_by_name: name,
    email_sent_at: null, email_id: `${provider}-pending${repeat ? "-update" : ""}`, email_error: "" };
}

export function approvalUpdateNotice(emailId: string, requestedAt: string, reviewedAt: string | null) {
  return (emailId === "mailto-update" || /^manual-update:/.test(emailId) || /^(smtp|gmail|microsoft)-update:/.test(emailId)) && (!reviewedAt || Date.parse(requestedAt) > Date.parse(reviewedAt));
}
