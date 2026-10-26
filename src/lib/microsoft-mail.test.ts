import test from "node:test";
import assert from "node:assert/strict";
import { microsoftMailbox, validateMicrosoftState, sendMicrosoftMessage, microsoftFailure, MICROSOFT_MAIL_SCOPES } from "./microsoft-mail";
import { buildApprovalEmail } from "./approval-email";

const message = buildApprovalEmail({recipientEmail:"po@gmail.com",cc:"lead@example.com",subject:"Review",body:"Results",replyTo:"qa@truecorp.co.th",senderEmail:"qa@truecorp.co.th",projectName:"Test",sheetUrl:"https://docs.google.com/test",siteUrl:"https://qa.example.com",requestId:"id",repeat:false});
test("Microsoft primary mailbox must equal QA, not merely a matching UPN", () => {
  assert.equal(microsoftMailbox({mail:"QA@truecorp.co.th",userPrincipalName:"alias@tenant"}, "qa@truecorp.co.th"), "qa@truecorp.co.th");
  assert.throws(() => microsoftMailbox({mail:"other@truecorp.co.th",userPrincipalName:"qa@truecorp.co.th"}, "qa@truecorp.co.th"));
  assert.throws(() => microsoftMailbox({mail:null,userPrincipalName:"qa@truecorp.co.th"}, "qa@truecorp.co.th"));
});
test("OAuth state is bound to the initiating QA, verifier, callback and ten-minute lifetime", () => {
  const saved = {state:"state",userId:"qa",returnTo:"/groups",verifier:"v".repeat(64),redirectUri:"https://app.test/api/microsoft/auth/callback",expiresAt:2000};
  assert.deepEqual(validateMicrosoftState(saved,"state","qa",saved.redirectUri,1000), saved);
  for (const [state,user,redirect,now] of [["wrong","qa",saved.redirectUri,1000],["state","other",saved.redirectUri,1000],["state","qa","https://evil.test/callback",1000],["state","qa",saved.redirectUri,2000]] as const) assert.throws(() => validateMicrosoftState(saved,state,user,redirect,now));
  assert.throws(() => validateMicrosoftState({},"state","qa",saved.redirectUri,1000));
});
test("Graph sends from /me, preserves arbitrary recipients and QA Reply-To, and accepts empty 202", async () => {
  let calls = 0;
  const receipt = await sendMicrosoftMessage("access", message, "operation", async (url, options) => {
    calls++;
    assert.equal(url,"https://graph.microsoft.com/v1.0/me/sendMail");
    assert.equal(options?.method,"POST");
    const body = JSON.parse(String(options?.body));
    assert.deepEqual(body.message.toRecipients,[{emailAddress:{address:"po@gmail.com"}}]);
    assert.deepEqual(body.message.ccRecipients,[{emailAddress:{address:"lead@example.com"}}]);
    assert.deepEqual(body.message.replyTo,[{emailAddress:{address:"qa@truecorp.co.th"}}]);
    assert.equal(body.message.from,undefined);
    assert.equal(body.saveToSentItems,true);
    return new Response(null,{status:202});
  });
  assert.equal(calls,1);
  assert.equal(receipt.messageId,"");
  assert.equal(receipt.operationId,"operation");
  assert.deepEqual(receipt.accepted,["po@gmail.com","lead@example.com"]);
  assert.ok(MICROSOFT_MAIL_SCOPES.includes("Mail.Send"));
  assert.ok(!MICROSOFT_MAIL_SCOPES.includes("Mail.Read"));
});
test("Graph errors and timeouts do not retry or leak upstream secrets", async () => {
  let calls = 0;
  await assert.rejects(sendMicrosoftMessage("secret",message,"op",async () => { calls++; throw new Error("secret-token"); }));
  assert.equal(calls,1);
  const revoked = microsoftFailure({status:401});
  assert.equal(revoked.reauthorize,true);
  assert.equal(microsoftFailure({status:403}).reauthorize,false);
  assert.equal(microsoftFailure(new Error("secret-token")).uncertain,true);
  assert.doesNotMatch(JSON.stringify(microsoftFailure(new Error("secret-token"))),/secret-token/);
  await assert.rejects(sendMicrosoftMessage("secret",message,"op",async () => new Response("secret-token",{status:403})), /Microsoft/);
});

test("only Graph send and profile grants qualify, without requiring mailbox read access", async () => {
  const {hasMicrosoftMailScopes} = await import("./microsoft-mail");
  assert.equal(hasMicrosoftMailScopes(["Mail.Send","User.Read"]),true);
  assert.equal(hasMicrosoftMailScopes(["https://graph.microsoft.com/Mail.Send","https://graph.microsoft.com/User.Read"]),true);
  assert.equal(hasMicrosoftMailScopes(["User.Read"]),false);
  assert.equal(hasMicrosoftMailScopes(["Mail.Read","User.Read"]),false);
});

test("connection errors never imply an email was sent and do not expose configuration secrets", async () => {
  const {microsoftConnectFailure, MicrosoftMailSetupError} = await import("./microsoft-mail");
  const message = microsoftConnectFailure(new Error("secret-token"));
  assert.doesNotMatch(message,/secret-token|Sent Items/);
  assert.match(message,/เชื่อม/);
  assert.doesNotMatch(new MicrosoftMailSetupError().message,/CLIENT_SECRET|TENANT_ID/);
});
