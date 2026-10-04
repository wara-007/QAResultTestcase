// Only notification metadata: never reset a PO decision or rotate existing links.
export function approvalNotificationPatch(now: string, userId: string, name: string, repeat: boolean) {
  return { requested_at: now, requested_by: userId, requested_by_name: name,
    email_sent_at: now, email_id: repeat ? "mailto-update" : "mailto", email_error: "" };
}

export function approvalUpdateNotice(emailId: string, requestedAt: string, reviewedAt: string | null) {
  return emailId === "mailto-update" && (!reviewedAt || Date.parse(requestedAt) > Date.parse(reviewedAt));
}
