import type { TestStatus } from "./types";

export function isApprovalDraft(value: unknown): value is { deliveryMode?: "oauth" | "manual" | "outlook"; senderEmail?: string; poEmail: string; cc: string; subject: string; body: string | null } {
  if (!value || typeof value !== "object") return false;
  const draft = value as Record<string, unknown>;
  return (draft.deliveryMode === undefined || draft.deliveryMode === "oauth" || draft.deliveryMode === "manual" || draft.deliveryMode === "outlook")
    && (draft.senderEmail === undefined || typeof draft.senderEmail === "string")
    && [draft.poEmail, draft.cc, draft.subject].every(item => typeof item === "string")
    && (draft.body === null || typeof draft.body === "string");
}

export function approvalDraftBody(editedBody: string | null, input: {
  projectName: string; environment: string; totalCases: number; counts: Record<TestStatus, number>;
}) {
  if (editedBody !== null) return editedBody;
  return ["เรียน PO,", "", `ขอส่งผลการทดสอบ Project: ${input.projectName}`,
    `Environment: ${input.environment || "-"}`, `Test cases ทั้งหมด: ${input.totalCases}`,
    `Pass: ${input.counts.Pass} | Failed: ${input.counts.Failed} | Skip: ${input.counts.Skip}`,
    `Not Start: ${input.counts["Not Start"]} | Inprogress: ${input.counts["In Progress"]}`, "",
    "กรุณาเปิดลิงก์ Review ในอีเมลนี้เพื่อตรวจสอบและกด Approved"].join("\n");
}
