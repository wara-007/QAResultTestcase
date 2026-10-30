import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {ApprovalManualComposer} from "./approval-manual-composer";

const props = {projectName:"Checkout",body:"ผลทดสอบ",recipientEmail:"po@example.com",disabled:false,onBodyChange:()=>{},onRecipientChange:()=>{},onCopyBody:()=>{},copyBodyDisabled:false,preparing:false,flash:()=>{}};

test("manual composer keeps required link settings visible above the body-copy action", () => {
  const html = renderToStaticMarkup(<ApprovalManualComposer {...props}/>);
  assert.match(html, /ชื่อโปรเจกต์/);
  assert.match(html, /Checkout/);
  assert.match(html, /เนื้อหาอีเมล/);
  assert.doesNotMatch(html, /<details|<summary/);
  assert.match(html, /<section[^>]*aria-label="ตั้งค่าลิงก์ Approve"/);
  assert.ok(html.indexOf('class="approval-manual-settings') < html.indexOf("คัดลอกเนื้อหาและลิงก์ Approve"));
  assert.match(html, /กำหนดสิทธิ์เปิดลิงก์ Approve/);
  assert.doesNotMatch(html, />CC<|>หัวข้ออีเมล<|เชื่อมสิทธิ์|อีเมลที่จะใช้ส่งเอง|qa@truecorp.co.th/);
});

test("missing PO remains visible without expanding anything and body is retained", () => {
  const body = "ภาษาไทย".repeat(1000);
  const html = renderToStaticMarkup(<ApprovalManualComposer {...props} body={body} recipientEmail=""/>);
  assert.doesNotMatch(html, /<details|<summary/);
  assert.ok(html.includes(body));
  assert.match(html, /ยังไม่ได้ระบุอีเมล PO/);
});


test("copy actions are visible directly beside project and below body", () => {
  const html = renderToStaticMarkup(<ApprovalManualComposer {...props}/>);
  assert.match(html, /คัดลอกชื่อโปรเจกต์/);
  assert.match(html, /คัดลอกเนื้อหาและลิงก์ Approve/);
  assert.match(html, /เตรียมลิงก์ Approve ก่อนคัดลอก/);
});

test("copying body is disabled until evidence is ready while project-name copy remains available", () => {
  const html = renderToStaticMarkup(<ApprovalManualComposer {...props} copyBodyDisabled/>);
  assert.match(html, /disabled=""[^>]*>.*?คัดลอกเนื้อหาและลิงก์ Approve/);
  assert.doesNotMatch(html, /disabled=""[^>]*>[^<]*คัดลอกชื่อโปรเจกต์/);
});
