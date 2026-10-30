import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ApprovalDeliveryModePicker } from "./approval-delivery-mode-picker";

const render = (value: "manual" | "oauth", provider: "gmail" | "microsoft" = "gmail", configured = true) => renderToStaticMarkup(<ApprovalDeliveryModePicker idPrefix="approval" value={value} provider={provider} connection={{configured, connected:false}} onChange={() => {}} />);

test("delivery modes are accessible tabs and both remain reachable to edit sender", () => {
  const html = render("manual", "microsoft", false);
  assert.match(html, /role="tablist"/);
  assert.match(html, /role="tab"/);
  assert.match(html, /id="approval-tab-manual"[^>]*aria-selected="true"/);
  assert.match(html, /aria-controls="approval-panel-manual"/);
  assert.match(html, /ยังไม่มีสิทธิ์ส่งผ่านเว็บ/);
  assert.doesNotMatch(html, /<select|<option/);
  assert.doesNotMatch(html, /disabled=""/);
});

test("Gmail send tab warns about junk with possible causes and recipient action", () => {
  const html = render("oauth");
  assert.match(html, /Junk\/Spam/);
  assert.match(html, /นโยบาย.*บริษัท/);
  assert.match(html, /ความน่าเชื่อถือ.*ผู้ส่ง/);
  assert.match(html, /Not junk/);
  assert.match(html, /learn.microsoft.com/);
});

test("copy tab and Microsoft send tab do not show a Gmail-specific warning", () => {
  assert.doesNotMatch(render("manual"), /Junk\/Spam/);
  assert.doesNotMatch(render("oauth", "microsoft"), /Junk\/Spam/);
});
