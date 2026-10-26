import test from "node:test";
import assert from "node:assert/strict";
import { mailCredentials, canSendGoogleMail, gmailFailure, gmailReturnTo, gmailConnectUrl, googleConsentOptions } from "./google-mail";
import { google } from "googleapis";

const granted = { access_token: "access", refresh_token: "refresh", scope: "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email" };
test("Drive consent never combines an earlier Gmail grant and mail consent never requests Drive", () => {
  const oauth = new google.auth.OAuth2("client", "secret", "http://localhost:3002/api/google/auth/callback");
  const drive = new URL(oauth.generateAuthUrl(googleConsentOptions("drive", "state", "qa@example.com", ["https://www.googleapis.com/auth/drive.file"])));
  assert.equal(drive.searchParams.get("include_granted_scopes"), "false");
  assert.equal(drive.searchParams.get("scope"), "https://www.googleapis.com/auth/drive.file");
  const mail = new URL(oauth.generateAuthUrl(googleConsentOptions("mail", "state", "qa@example.com", ["https://www.googleapis.com/auth/drive.file"])));
  assert.equal(mail.searchParams.get("include_granted_scopes"), "false");
  assert.doesNotMatch(mail.searchParams.get("scope") ?? "", /drive/);
  assert.equal(mail.searchParams.get("login_hint"), "qa@example.com");
});
test("mail consent binds a verified Google account to the signed-in QA, never an arbitrary sender", () => {
  const saved = mailCredentials(granted, {email: "QA@truecorp.co.th", verified_email: true}, "qa@truecorp.co.th", null);
  assert.equal(canSendGoogleMail(saved, "qa@truecorp.co.th"), true);
  assert.equal(canSendGoogleMail(saved, "other@gmail.com"), false);
  for (const profile of [{email: "other@gmail.com", verified_email: true}, {email: "qa@truecorp.co.th", verified_email: false}]) assert.throws(() => mailCredentials(granted, profile, "qa@truecorp.co.th", null));
});
test("Drive grants, partial consent, missing refresh and legacy unbound credentials cannot send", () => {
  assert.equal(canSendGoogleMail(granted, "qa@truecorp.co.th"), false);
  for (const tokens of [{...granted, scope: "https://www.googleapis.com/auth/drive.file"}, {...granted, refresh_token: undefined}]) assert.throws(() => mailCredentials(tokens, {email: "qa@truecorp.co.th", verified_email: true}, "qa@truecorp.co.th", null));
});
test("reconsent retains refresh token only for the same bound mailbox and checks new granted scopes", () => {
  const saved = mailCredentials(granted, {email: "qa@truecorp.co.th", verified_email: true}, "qa@truecorp.co.th", null);
  assert.equal(mailCredentials({...granted, refresh_token: undefined}, {email: "qa@truecorp.co.th", verified_email: true}, "qa@truecorp.co.th", saved).refresh_token, "refresh");
  assert.throws(() => mailCredentials({...granted, scope: "", refresh_token: undefined}, {email: "qa@truecorp.co.th", verified_email: true}, "qa@truecorp.co.th", saved));
});
test("Gmail reauthorization differs from API disabled, quota and delivery uncertainty, without secret leaks", () => {
  assert.equal(gmailFailure({response:{status:401,data:{error:{message:"secret-token"}}}}).reauthorize, true);
  assert.equal(gmailFailure({response:{data:{error:"invalid_grant"}}}).reauthorize, true);
  const disabled = gmailFailure({response:{status:403,data:{error:{errors:[{reason:"accessNotConfigured"}]}}}});
  assert.equal(disabled.reauthorize, false);
  assert.match(disabled.message, /Gmail API/);
  assert.equal(gmailFailure({response:{status:429}}).reauthorize, false);
  assert.doesNotMatch(JSON.stringify(gmailFailure(new Error("secret-token"))), /secret-token/);
});
test("mail OAuth returns to original project without triggering Drive import or automatic resend", () => {
  const connect = new URL(gmailConnectUrl("/groups/g/projects/p/overview?gmailAuthError=old"), "http://localhost:3002");
  assert.equal(connect.pathname, "/api/google/auth/start");
  assert.equal(connect.searchParams.get("purpose"), "mail");
  assert.equal(connect.searchParams.get("returnTo"), "/groups/g/projects/p/overview");
  assert.equal(gmailReturnTo("/groups/g/projects/p/overview"), "/groups/g/projects/p/overview?gmailAuth=connected");
  assert.equal(new URL(gmailConnectUrl("//evil.example"), "http://localhost:3002").searchParams.get("returnTo"), "/groups");
});

test("Gmail transport failures and server errors remain uncertain while client rejections are definitive",()=>{
 for(const reason of [{code:'ETIMEDOUT'},{code:'ECONNRESET'},new Error('fetch failed'),{response:{status:503}}]) assert.equal(gmailFailure(reason).uncertain,true);
 for(const status of [400,401,403,429]) assert.equal(gmailFailure({response:{status}}).uncertain,false);
});
