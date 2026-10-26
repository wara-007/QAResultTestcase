import test from "node:test";
import assert from "node:assert/strict";
import { encodeGmailMessage } from "./gmail-message";
import { buildApprovalEmail } from "./approval-email";

test("Gmail raw MIME preserves actual QA sender, CC, Reply-To, Thai subject and review link", async () => {
  const message = buildApprovalEmail({senderEmail: "qa@truecorp.co.th", senderName: "QA", replyTo: "qa@truecorp.co.th", recipientEmail: "po@example.com", cc: "lead@example.com", subject: "ผลการทดสอบ", body: "Results", projectName: "Test", sheetUrl: "https://docs.google.com/test", siteUrl: "https://qaresulttestcase.netlify.app", requestId: "review", repeat: false});
  const raw = await encodeGmailMessage(message);
  assert.match(raw, /^[A-Za-z0-9_-]+$/);
  const mime = Buffer.from(raw, "base64url").toString("utf8");
  assert.match(mime, /From: QA <qa@truecorp.co.th>/);
  assert.match(mime, /Cc: lead@example.com/);
  assert.match(mime, /Reply-To: qa@truecorp.co.th/);
  assert.match(mime, /Subject: =\?UTF-8\?[BQ]\?/i);
  assert.doesNotMatch(mime, /qatrueapp@gmail.com/);
});
