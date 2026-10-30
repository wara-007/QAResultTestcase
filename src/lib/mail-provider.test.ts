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

test("mail authorization carries the edited sender without changing the return location", () => {
  for (const provider of ["gmail", "microsoft"] as const) {
    const url = new URL(mailConnectUrl(provider, "/groups/p?tab=approval", " Other@Gmail.com "), "https://app.test");
    assert.equal(url.searchParams.get("senderEmail"), "other@gmail.com");
    assert.equal(url.searchParams.get("returnTo"), "/groups/p?tab=approval");
  }
});

test("selected approval sender defaults only when absent and rejects unsupported or malformed mailboxes", async () => {
  const { approvalSenderEmail } = await import("./mail-provider");
  assert.equal(approvalSenderEmail(undefined, "qa@gmail.com"), "qa@gmail.com");
  assert.equal(approvalSenderEmail(" Other@truecorp.co.th ", "qa@gmail.com"), "other@truecorp.co.th");
  for (const email of ["", "other@example.com", "a\r\n@gmail.com", "a b@gmail.com", "a@@gmail.com"]) {
    assert.throws(() => approvalSenderEmail(email, "qa@gmail.com"));
  }
});

test("Outlook drafts are explicitly awaiting manual sending even if old sent timestamp exists", () => {
  assert.equal(mailDeliveryLabel("mailto", ""), "เตรียมร่างแล้ว · รอผู้ใช้ส่งผ่าน Outlook");
  assert.equal(mailDeliveryLabel("mailto-update", "2026-10-01"), "เตรียมร่างแล้ว · รอผู้ใช้ส่งผ่าน Outlook");
});

test("manual preparation and user-confirmed sending are separate from provider delivery", () => {
  const id = "manual:30000000-0000-4000-8000-000000000001";
  assert.equal(mailDeliveryLabel(id, "", {confirmedAt: "", confirmedByName: ""}), "เตรียมแล้ว · ยังไม่ยืนยันการส่ง");
  const confirmed = mailDeliveryLabel(id, "", {confirmedAt: "2026-10-30T04:00:00Z", confirmedByName: "QA One"});
  assert.match(confirmed, /ผู้ใช้ยืนยันว่าส่งแล้ว/);
  assert.match(confirmed, /QA One/);
  assert.doesNotMatch(confirmed, /รับคำขอส่งแล้ว|Approved/);
});
