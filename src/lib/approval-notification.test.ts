import test from "node:test";
import assert from "node:assert/strict";
import { approvalNotificationPatch, approvalUpdateNotice } from "./approval-notification";

test("resending preserves approval, review and existing links", () => {
  const original = { id: "one", status: "approved", reviewed_at: "2026-10-01", reviewer_comment: "OK", token_hash: "old", recipient_email: "po@example.com" };
  const updated = { ...original, ...approvalNotificationPatch("2026-10-04", "qa", "QA", true) };
  assert.equal(updated.status, original.status);
  assert.equal(updated.reviewed_at, original.reviewed_at);
  assert.equal(updated.reviewer_comment, original.reviewer_comment);
  assert.equal(updated.token_hash, original.token_hash);
  assert.equal(updated.id, original.id);
  assert.equal(updated.requested_at, "2026-10-04");
  assert.equal(updated.email_id, "mailto-update");
});

test("update notice is independent of approval status and stops after review", () => {
  assert.equal(approvalUpdateNotice("mailto-update", "2026-10-04", "2026-10-01"), true);
  assert.equal(approvalUpdateNotice("mailto-update", "2026-10-04", null), true);
  assert.equal(approvalUpdateNotice("mailto-update", "2026-10-04", "2026-10-05"), false);
  assert.equal(approvalUpdateNotice("mailto", "2026-10-04", null), false);
});
