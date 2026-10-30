import type { ApprovalOutlookDraft } from "./approval-outlook";
import { mailProvider, type MailProvider } from "./mail-provider";

export type ApprovalDeliveryMode = "oauth" | "manual";
export type ApprovalComposerSelection = {senderEmail: string | null; deliveryMode: ApprovalDeliveryMode | null};

export function approvalComposerSelection(state: ApprovalComposerSelection, event: {type: "sender"; value: string} | {type: "mode"; value: ApprovalDeliveryMode}): ApprovalComposerSelection {
  return event.type === "sender" ? {...state, senderEmail: event.value} : {...state, deliveryMode: event.value};
}

export type ApprovalManualDraft = ApprovalOutlookDraft & {projectName?: string};
export type ManualApprovalDelivery = {
  id: string;
  draft: ApprovalManualDraft;
  preparedAt: string;
  confirmedAt: string;
  confirmedByName: string;
};

export function approvalDeliveryMode(saved: unknown, email: string): ApprovalDeliveryMode {
  if (saved === "oauth") return "oauth";
  if (saved === "manual" || saved === "outlook") return "manual";
  return mailProvider(email) === "microsoft" ? "manual" : "oauth";
}

export function websiteDeliveryAvailable(provider: MailProvider | null, connection: {configured: boolean; connected: boolean} | null) {
  if (!provider || connection?.configured === false) return false;
  return provider === "microsoft" ? connection?.connected === true : true;
}

export function manualDeliveryId(emailId: string) {
  return /^manual(?:-update)?:([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})$/i.exec(emailId)?.[1] ?? null;
}

export function readManualDelivery(value: unknown): ManualApprovalDelivery {
  const row = value as Record<string, unknown> | null;
  const draft = row?.draft as Record<string, unknown> | null;
  if (!row || typeof row.id !== "string" || typeof row.prepared_at !== "string"
    || (row.confirmed_at !== null && typeof row.confirmed_at !== "string") || typeof row.confirmed_by_name !== "string"
    || !draft || (draft.projectName !== undefined && typeof draft.projectName !== "string") || ![draft.senderEmail, draft.recipientEmail, draft.subject, draft.body].every(item => typeof item === "string")
    || !Array.isArray(draft.cc) || !draft.cc.every(item => typeof item === "string")) {
    throw new Error("โหลดร่างอีเมลไม่สำเร็จ กรุณาเตรียมอีเมลใหม่");
  }
  return {id: row.id, draft: draft as ApprovalManualDraft, preparedAt: row.prepared_at,
    confirmedAt: row.confirmed_at ?? "", confirmedByName: row.confirmed_by_name};
}
