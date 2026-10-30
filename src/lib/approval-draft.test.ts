import assert from "node:assert/strict";
import test from "node:test";
import { approvalDraftBody, isApprovalDraft } from "./approval-draft";

test("mail authorization round trip preserves automatic versus edited drafts", () => {
  for (const body of [null, "QA edited", ""]) {
    const restored: unknown = JSON.parse(JSON.stringify({ poEmail: "po@example.com", cc: "", subject: "Review", body }));
    assert.ok(isApprovalDraft(restored));
    assert.equal(restored.body, body);
  }
  assert.equal(isApprovalDraft({ poEmail: "po@example.com", cc: "", subject: "Review", body: 42 }), false);
});

test("unedited approval draft follows loaded counts and subsequent result changes", () => {
  const input = { projectName: "Project", environment: "UAT", totalCases: 0,
    counts: { Pass: 0, Failed: 0, Skip: 0, "Not Start": 0, "In Progress": 0 } };
  assert.match(approvalDraftBody(null, input), /Test cases ทั้งหมด: 0/);
  const loaded = { ...input, totalCases: 12, counts: { ...input.counts, "Not Start": 12 } };
  assert.match(approvalDraftBody(null, loaded), /Test cases ทั้งหมด: 12/);
  assert.match(approvalDraftBody(null, { ...loaded, counts: { ...loaded.counts, Pass: 1, "Not Start": 11 } }), /Pass: 1/);
  assert.equal(approvalDraftBody("ข้อความที่ QA แก้เอง", loaded), "ข้อความที่ QA แก้เอง");
  assert.equal(approvalDraftBody("", loaded), "");
});

test("sender survives draft restoration while malformed sender is rejected", () => {
  const draft = {poEmail: "po@example.com", cc: "", subject: "Review", body: null, senderEmail: "other@gmail.com"};
  assert.equal(isApprovalDraft(JSON.parse(JSON.stringify(draft))), true);
  assert.equal(isApprovalDraft({...draft, senderEmail: 42}), false);
});

test("OAuth draft restoration preserves chosen delivery method and rejects unknown methods", () => {
  const draft = {senderEmail: "qa@truecorp.co.th", poEmail: "po@example.com", cc: "", subject: "Review", body: null};
  assert.equal(isApprovalDraft({...draft, deliveryMode: "oauth"}), true);
  assert.equal(isApprovalDraft({...draft, deliveryMode: "outlook"}), true);
  assert.equal(isApprovalDraft({...draft, deliveryMode: "unknown"}), false);
});

test("copy mode survives draft restoration", () => {
  assert.equal(isApprovalDraft({senderEmail: "qa@gmail.com", deliveryMode: "manual", poEmail: "po@example.com", cc: "", subject: "Review", body: null}), true);
});
