import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ApprovalManualDialog } from "./approval-manual-dialog";

const delivery = {id: "30000000-0000-4000-8000-000000000001", preparedAt: "2026-10-30T02:00:00Z", confirmedAt: "", confirmedByName: "", draft: {senderEmail: "qa@truecorp.co.th", recipientEmail: "po@example.com", cc: ["lead@example.com"], projectName: "Checkout", subject: "Checkout", body: "ผลทดสอบ\nhttps://qa.example.com/approvals/request"}};

test("manual dialog contains complete copyable email and explicit send attestation, with no mailto launch", () => {
  const html = renderToStaticMarkup(<ApprovalManualDialog delivery={delivery} onClose={() => {}} onConfirm={() => {}} confirming={false} flash={() => {}} />);
  assert.match(html, /role="dialog"/);
  assert.match(html, /คัดลอกเนื้อหาและลิงก์ Approve/);
  assert.match(html, /ยืนยันว่าส่งคำขอ Approve แล้ว/);
  assert.match(html, /กดหลังจากส่งอีเมลจริงแล้วเท่านั้น/);
  assert.match(html, /Checkout/);
  assert.match(html, /คัดลอกชื่อโปรเจกต์/);
  assert.doesNotMatch(html, /po@example.com|lead@example.com|คัดลอกผู้รับ|คัดลอก CC|คัดลอกหัวข้อ/);
  assert.match(html, /https:\/\/qa.example.com\/approvals\/request/);
  assert.doesNotMatch(html, /mailto:|เปิด Outlook เพื่อส่ง/);
});

test("confirmed drafts show original actor/time and disable repeat confirmation without claiming PO approval", () => {
  const html = renderToStaticMarkup(<ApprovalManualDialog delivery={{...delivery, confirmedAt: "2026-10-30T04:00:00Z", confirmedByName: "QA One"}} onClose={() => {}} onConfirm={() => {}} confirming={false} flash={() => {}} />);
  assert.match(html, /QA One/);
  assert.match(html, /ผู้ใช้ยืนยันว่าส่งแล้ว/);
  assert.match(html, /disabled=""[^>]*>บันทึกการส่งแล้ว/);
  assert.doesNotMatch(html, />Approved</);
});

test("long Thai drafts remain complete and pending confirmation disables the action", () => {
  const body = "รายละเอียดผลทดสอบ ".repeat(2000) + "ท้ายข้อความ";
  const html = renderToStaticMarkup(<ApprovalManualDialog delivery={{...delivery, draft: {...delivery.draft, body}}} onClose={() => {}} onConfirm={() => {}} confirming flash={() => {}} />);
  assert.ok(html.includes(body));
  assert.match(html, /disabled=""[^>]*>กำลังบันทึก/);
});
