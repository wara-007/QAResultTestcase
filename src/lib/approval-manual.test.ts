import assert from "node:assert/strict";
import test from "node:test";
import { approvalDeliveryMode, manualDeliveryId, readManualDelivery, websiteDeliveryAvailable } from "./approval-manual";

test("sender defaults remain sensible while explicitly chosen modes work for both providers", () => {
  assert.equal(approvalDeliveryMode(undefined, "qa@gmail.com"), "oauth");
  assert.equal(approvalDeliveryMode(undefined, "qa@truecorp.co.th"), "manual");
  assert.equal(approvalDeliveryMode("manual", "qa@gmail.com"), "manual");
  assert.equal(approvalDeliveryMode("oauth", "qa@truecorp.co.th"), "oauth");
  assert.equal(approvalDeliveryMode("outlook", "qa@truecorp.co.th"), "manual");
});

test("unconnected company mail cannot select website sending, while Gmail may connect first", () => {
  assert.equal(websiteDeliveryAvailable("microsoft", null), false);
  assert.equal(websiteDeliveryAvailable("microsoft", {configured: false, connected: false}), false);
  assert.equal(websiteDeliveryAvailable("microsoft", {configured: true, connected: false}), false);
  assert.equal(websiteDeliveryAvailable("microsoft", {configured: true, connected: true}), true);
  assert.equal(websiteDeliveryAvailable("gmail", {configured: true, connected: false}), true);
  assert.equal(websiteDeliveryAvailable("gmail", {configured: false, connected: false}), false);
});

test("only current manual delivery markers can resolve persisted drafts", () => {
  const id = "30000000-0000-4000-8000-000000000001";
  assert.equal(manualDeliveryId(`manual:${id}`), id);
  assert.equal(manualDeliveryId(`manual-update:${id}`), id);
  for (const marker of ["mailto", "gmail:sent", "manual:invalid", `manual:${id}:other`]) assert.equal(manualDeliveryId(marker), null);
});

test("stored drafts are validated and confirmations expose user attestation without credentials", () => {
  const row = {id: "30000000-0000-4000-8000-000000000001", prepared_at: "2026-10-30T02:00:00Z", confirmed_at: null, confirmed_by_name: "", draft: {senderEmail: "qa@truecorp.co.th", recipientEmail: "po@example.com", cc: [], subject: "Review", body: "ผลทดสอบ"}};
  const result = readManualDelivery(row);
  assert.equal(result.confirmedAt, "");
  assert.equal(result.draft.body, "ผลทดสอบ");
  assert.equal(readManualDelivery({...row, confirmed_at: "2026-10-30T03:00:00Z", confirmed_by_name: "QA One"}).confirmedByName, "QA One");
  assert.throws(() => readManualDelivery({...row, draft: {...row.draft, cc: 42}}));
  assert.throws(() => readManualDelivery(null));
});

test("editing sender preserves explicit manual mode and never silently enables website delivery", async () => {
  const {approvalComposerSelection} = await import("./approval-manual");
  const selected = approvalComposerSelection({senderEmail: "qa@truecorp.co.th", deliveryMode: null}, {type: "mode", value: "manual"});
  const edited = approvalComposerSelection(selected, {type: "sender", value: "connected@gmail.com"});
  assert.equal(edited.senderEmail, "connected@gmail.com");
  assert.equal(approvalDeliveryMode(edited.deliveryMode, edited.senderEmail!), "manual");
  assert.equal(approvalComposerSelection(edited, {type: "mode", value: "oauth"}).deliveryMode, "oauth");
});
