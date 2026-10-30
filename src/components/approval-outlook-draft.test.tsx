import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ApprovalOutlookDraftDialog } from "./approval-outlook-draft";

const draft = {senderEmail: "qa@truecorp.co.th", recipientEmail: "po@example.com", cc: ["lead@example.com"], subject: "ผลทดสอบ", body: "Pass: 2\nhttps://qa.example.com/approvals/request"};

test("draft preview provides manual From guidance, compose link and full copyable review content", () => {
  const html = renderToStaticMarkup(<ApprovalOutlookDraftDialog draft={draft} onClose={() => {}} flash={() => {}} />);
  assert.match(html, /role="dialog"/);
  assert.match(html, /aria-modal="true"/);
  assert.match(html, /เปิด Outlook เพื่อส่ง/);
  assert.match(html, /mailto:po@example.com/);
  assert.match(html, /qa@truecorp.co.th/);
  assert.match(html, /From/);
  assert.match(html, /กด Send/);
  assert.match(html, /https:\/\/qa.example.com\/approvals\/request/);
  assert.match(html, /คัดลอกเนื้อหา/);
  assert.match(html, /ยังไม่ได้ส่งอีเมล/);
});

test("long draft warns which fields need manual copying and retains the entire body", () => {
  const body = "รายละเอียดผลทดสอบ ".repeat(1000) + "ท้ายข้อความ";
  const html = renderToStaticMarkup(<ApprovalOutlookDraftDialog draft={{...draft, body}} onClose={() => {}} flash={() => {}} />);
  assert.match(html, /เนื้อหายาว/);
  assert.match(html, /คัดลอกเนื้อหาไปวาง/);
  assert.ok(html.includes(body));
});
