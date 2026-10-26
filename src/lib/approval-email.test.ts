import test from "node:test";
import assert from "node:assert/strict";
import { buildApprovalEmail, gmailSmtpOptions, deliverApprovalEmail, approvalSendBlocked } from "./approval-email";

const input = { recipientEmail: "PO@example.com", cc: "lead@example.com; PO@example.com", subject: "ตรวจผล", body: "ผลทดสอบ", replyTo: "qa@truecorp.co.th", projectName: "Project", sheetUrl: "https://docs.google.com/spreadsheets/d/test", siteUrl: "https://qaresulttestcase.netlify.app", requestId: "request-1", repeat: true };

test("email uses authenticated QA sender, trusted reply-to, separate CC and existing review link", () => {
  const message = buildApprovalEmail({...input, senderEmail: "qa@truecorp.co.th", senderName: "QA"});
  assert.equal(message.from.address, "qa@truecorp.co.th");
  assert.equal(message.replyTo, "qa@truecorp.co.th");
  assert.equal(message.to, "po@example.com");
  assert.deepEqual(message.cc, ["lead@example.com"]);
  assert.match(message.subject, /^\[อัปเดต\]/);
  assert.match(message.text, /https:\/\/qaresulttestcase.netlify.app\/approvals\/request-1/);
});

test("invalid recipients, injected headers, oversized messages and local review URLs cannot be sent", () => {
  for (const change of [{ recipientEmail: "bad" }, { cc: "a@example.com\r\nBcc: victim@example.com" }, { subject: "test\nBcc: a@example.com" }, { replyTo: "" }, { body: "x".repeat(50_001) }, { siteUrl: "http://localhost:3002" }, { cc: Array.from({length: 11}, (_, i) => `qa${i}@example.com`).join(",") }]) {
    assert.throws(() => buildApprovalEmail({ ...input, ...change }));
  }
});

test("SMTP requires an App Password and never accepts a different sender or disables TLS", () => {
  assert.throws(() => gmailSmtpOptions({}), /GMAIL_APP_PASSWORD/);
  assert.throws(() => gmailSmtpOptions({ GMAIL_USER: "other@gmail.com", GMAIL_APP_PASSWORD: "abcdefghijklmnop" }));
  const options = gmailSmtpOptions({ GMAIL_APP_PASSWORD: "abcd efgh ijkl mnop" });
  assert.equal(options.auth.pass, "abcdefghijklmnop");
  assert.equal(options.auth.user, "qatrueapp@gmail.com");
  assert.equal(options.secure, true);
  assert.equal(options.port, 465);
  assert.equal(options.disableUrlAccess, true);
});

test("sent metadata is written only after SMTP accepts PO; rejected CC is a warning", async () => {
  const writes: unknown[] = [];
  const result = await deliverApprovalEmail(buildApprovalEmail(input), true, async () => {
    assert.deepEqual(writes, []);
    return { accepted: ["po@example.com"], rejected: ["lead@example.com"], messageId: "<id>" };
  }, async patch => { writes.push(patch); });
  assert.equal(result.ok, true);
  assert.match(result.warning ?? "", /lead@example.com/);
  assert.equal(writes.length, 1);
  assert.match(JSON.stringify(writes), /gmail-update:<id>/);
  assert.match(JSON.stringify(writes), /email_sent_at/);
});

test("SMTP failures and rejected PO never report success or leak SMTP credentials", async () => {
  for (const send of [async () => { throw Object.assign(new Error("secret-password"), { code: "EAUTH" }); }, async () => ({accepted: ["lead@example.com"], rejected: ["po@example.com"], messageId: "<id>"})]) {
    const writes: Record<string, unknown>[] = [];
    const result = await deliverApprovalEmail(buildApprovalEmail(input), false, send, async patch => { writes.push(patch); });
    assert.equal(result.ok, false);
    assert.equal(writes[0].email_sent_at, null);
    assert.doesNotMatch(JSON.stringify(result), /secret-password/);
  }
});

test("SMTP acceptance followed by DB failure warns not to resend blindly", async () => {
  const result = await deliverApprovalEmail(buildApprovalEmail(input), false, async () => ({accepted: ["po@example.com"], rejected: [], messageId: "<id>"}), async () => { throw new Error("db down"); });
  assert.equal(result.ok, true);
  assert.match(result.warning ?? "", /สถานะ/);
});

test("active send and recently accepted mail block duplicate sends, stale pending can recover", () => {
  const now = Date.parse("2026-10-19T10:00:00Z");
  assert.equal(approvalSendBlocked({email_id: "smtp-pending:id", requested_at: "2026-10-19T09:59:30Z", email_sent_at: null}, now), true);
  assert.equal(approvalSendBlocked({email_id: "smtp:<id>", requested_at: "2026-10-19T09:59:50Z", email_sent_at: "2026-10-19T09:59:50Z"}, now), true);
  assert.equal(approvalSendBlocked({email_id: "smtp-pending:id", requested_at: "2026-10-19T09:50:00Z", email_sent_at: null}, now), false);
});

test("Microsoft 202 acceptance persists a local operation reference, not a fabricated Graph message id", async () => {
  const writes: Record<string, unknown>[] = [];
  const result = await deliverApprovalEmail(buildApprovalEmail(input), false, async () => ({accepted:["po@example.com"],rejected:[],messageId:"",operationId:"local-op"}),async patch => {writes.push(patch);}, "microsoft");
  assert.equal(result.ok,true);
  assert.equal(writes[0].email_id,"microsoft:accepted:local-op");
  assert.ok(writes[0].email_sent_at);
});
test("Microsoft uncertain sends remain unknown and accepted updates preserve duplicate protection", async () => {
  const writes: Record<string, unknown>[] = [];
  await deliverApprovalEmail(buildApprovalEmail(input),false,async () => {throw new Error("timeout secret");},async patch => {writes.push(patch);},"microsoft");
  assert.equal(writes[0].email_id,"microsoft-unknown");
  const now = Date.parse("2026-10-22T10:00:00Z");
  assert.equal(approvalSendBlocked({email_id:"microsoft-update:accepted:op",requested_at:"2026-10-22T09:59:55Z",email_sent_at:"2026-10-22T09:59:55Z"},now),true);
  assert.equal(approvalSendBlocked({email_id:"microsoft-unknown",requested_at:"2026-10-22T09:59:55Z",email_sent_at:null},now),true);
});

test("Gmail timeout persists an unknown outcome and guards immediate resend", async () => {
 const writes: Record<string, unknown>[] = [];
 const result=await deliverApprovalEmail(buildApprovalEmail(input),false,async()=>{throw Object.assign(new Error('secret-token'),{code:'ETIMEDOUT'});},async patch=>{writes.push(patch);});
 assert.equal(result.ok,false);
 assert.equal(writes[0].email_id,'gmail-unknown');
 assert.equal(writes[0].email_sent_at,null);
 const now=Date.parse('2026-10-26T10:00:00Z');
 assert.equal(approvalSendBlocked({email_id:String(writes[0].email_id),requested_at:'2026-10-26T09:59:55Z',email_sent_at:null},now),true);
 assert.doesNotMatch(JSON.stringify(result),/secret-token/);
});

test("definitive Gmail rejections stay failed and preserve reauthorization decisions",async()=>{
 for(const [status,reauthorize] of [[401,true],[403,false],[429,false]] as const){
  let saved='';
  const result=await deliverApprovalEmail(buildApprovalEmail(input),false,async()=>{throw {response:{status}};},async patch=>{saved=patch.email_id;});
  assert.equal(saved,'gmail-failed');
  assert.equal(result.ok,false);
  if(!result.ok) assert.equal(result.reauthorize,reauthorize);
 }
});
