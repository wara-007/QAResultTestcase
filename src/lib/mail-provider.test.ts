import test from "node:test";
import assert from "node:assert/strict";
import { mailProvider, mailConnectUrl, mailReturnTo, mailDeliveryLabel } from "./mail-provider";

test("provider comes from the QA mailbox, never the recipient or substring domains", () => {
  assert.equal(mailProvider(" QA@GMAIL.COM "), "gmail");
  assert.equal(mailProvider("qa@truecorp.co.th"), "microsoft");
  for (const email of ["qa@truecorp.co.th.evil.com", "qa@other.com", "qa@gmail.com@evil.com", ""]) assert.equal(mailProvider(email), null);
});
test("mail OAuth URLs preserve project drafts but cannot redirect outside the app", () => {
  const connect = new URL(mailConnectUrl("microsoft", "/groups/g/projects/p?mailAuth=old&tab=approval"), "https://app.test");
  assert.equal(connect.pathname, "/api/microsoft/auth/start");
  assert.equal(connect.searchParams.get("returnTo"), "/groups/g/projects/p?tab=approval");
  assert.match(mailConnectUrl("gmail", "/groups"), /purpose=mail/);
  for (const path of ["//evil.com", "/\\evil.com", "https://evil.com", "/%5cevil.com", "/\nevil.com"]) {
    assert.equal(new URL(mailReturnTo(path), "https://app.test").origin, "https://app.test");
    assert.equal(new URL(mailReturnTo(path), "https://app.test").pathname, "/groups");
  }
  assert.equal(mailReturnTo("/groups/g?gmailAuth=old"), "/groups/g?mailAuth=connected");
});
test("Microsoft acceptance and uncertainty are distinct from approval status", () => {
  assert.match(mailDeliveryLabel("microsoft:accepted:operation", "2026-10-22"), /Microsoft 365/);
  assert.match(mailDeliveryLabel("microsoft-update:accepted:operation", "2026-10-22"), /Microsoft 365/);
  assert.match(mailDeliveryLabel("microsoft-unknown", ""), /ยังยืนยัน/);
  assert.match(mailDeliveryLabel("microsoft-pending:id", ""), /กำลังส่ง/);
  assert.match(mailDeliveryLabel("gmail:message-id", "2026-10-22"), /Gmail/);
});
