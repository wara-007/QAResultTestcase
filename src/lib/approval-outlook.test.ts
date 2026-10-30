import assert from "node:assert/strict";
import test from "node:test";
import { outlookComposeLink, type ApprovalOutlookDraft } from "./approval-outlook";

const draft: ApprovalOutlookDraft = {senderEmail: "qa@truecorp.co.th", recipientEmail: "po@example.com", cc: ["lead@example.com"], subject: "ผลทดสอบ & Approve", body: "เรียน PO,\nผลทดสอบ: Pass\nhttps://qa.example.com/approvals/request"};

test("Outlook compose preserves recipients, Thai subject, body and review URL without claiming From", () => {
  const result = outlookComposeLink(draft);
  const url = new URL(result.url);
  assert.equal(url.protocol, "mailto:");
  assert.equal(url.pathname, "po@example.com");
  assert.equal(url.searchParams.get("cc"), "lead@example.com");
  assert.equal(url.searchParams.get("subject"), "ผลทดสอบ & Approve");
  assert.equal(url.searchParams.get("body"), "เรียน PO,\r\nผลทดสอบ: Pass\r\nhttps://qa.example.com/approvals/request");
  assert.equal(url.searchParams.has("from"), false);
  assert.equal(result.bodyIncluded, true);
  assert.equal(result.headersIncluded, true);
});

test("long email text requires copying while keeping full draft and short compose link", () => {
  const long = {...draft, body: "รายละเอียดผลทดสอบ\n".repeat(1000)};
  const result = outlookComposeLink(long);
  assert.ok(result.url.length <= 1800);
  assert.equal(new URL(result.url).searchParams.get("body"), null);
  assert.equal(new URL(result.url).searchParams.get("subject"), "ผลทดสอบ & Approve");
  assert.equal(result.bodyIncluded, false);
  assert.equal(result.headersIncluded, true);
  assert.equal(long.body, "รายละเอียดผลทดสอบ\n".repeat(1000));
});

test("oversized headers fall back to recipient only and tell UI to copy all fields", () => {
  const result = outlookComposeLink({...draft, subject: "ก".repeat(300)});
  assert.equal(result.url, "mailto:po@example.com");
  assert.equal(result.bodyIncluded, false);
  assert.equal(result.headersIncluded, false);
});
