import "server-only";
import { ConfidentialClientApplication } from "@azure/msal-node";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createClient } from "./supabase/server";
import { openMailToken, sealMailToken } from "./mail-token-crypto";
import { hasMicrosoftMailScopes, loadMicrosoftMailbox, MICROSOFT_MAIL_SCOPES, MICROSOFT_GRAPH_SCOPES, MicrosoftMailConnectionRequiredError, MicrosoftMailSetupError, sendMicrosoftMessage, type MicrosoftOAuthState } from "./microsoft-mail";
import type { buildApprovalEmail } from "./approval-email";

export const MICROSOFT_STATE_COOKIE = "qa_microsoft_mail_state";
type MicrosoftConnection = {mailEmail: string; accountId: string; cache: string};

export function microsoftMailConfigured() {
  return /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(process.env.MICROSOFT_TENANT_ID ?? "")
    && !!process.env.MICROSOFT_CLIENT_ID && !!process.env.MICROSOFT_CLIENT_SECRET
    && (process.env.MAIL_TOKEN_ENCRYPTION_SECRET?.length ?? 0) >= 32;
}
function configuration() {
  if (!microsoftMailConfigured()) throw new MicrosoftMailSetupError();
  return {clientId:process.env.MICROSOFT_CLIENT_ID!,clientSecret:process.env.MICROSOFT_CLIENT_SECRET!,authority:`https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID}`};
}
function client() {
  return new ConfidentialClientApplication({auth:configuration(),system:{loggerOptions:{piiLoggingEnabled:false,loggerCallback:() => { /* Never log credential-bearing SDK errors. */ }}}});
}
export function sealMicrosoftState(value: MicrosoftOAuthState) {
  configuration();
  return sealMailToken(value,process.env.MAIL_TOKEN_ENCRYPTION_SECRET!);
}
export function openMicrosoftState(value: string) {
  configuration();
  return openMailToken(value,process.env.MAIL_TOKEN_ENCRYPTION_SECRET!);
}
async function store() {
  const supabase = await createClient();
  const {data,error} = await supabase.auth.getUser();
  if (error || !data.user?.email) throw new MicrosoftMailConnectionRequiredError();
  return {supabase,userId:data.user.id,email:data.user.email.trim().toLowerCase()};
}
async function loadConnection(): Promise<MicrosoftConnection | null> {
  const {supabase,userId} = await store();
  const {data,error} = await supabase.from("microsoft_mail_connections").select("token_ciphertext").eq("user_id",userId).maybeSingle();
  if (error) throw new Error("โหลดสิทธิ์ Outlook ไม่สำเร็จ กรุณารัน migration microsoft_mail_connections และตรวจสิทธิ์ฐานข้อมูล");
  if (!data?.token_ciphertext) return null;
  try {
    const saved = openMailToken(data.token_ciphertext,process.env.MAIL_TOKEN_ENCRYPTION_SECRET!) as Partial<MicrosoftConnection> | null;
    if (!saved || typeof saved.mailEmail !== "string" || typeof saved.accountId !== "string" || typeof saved.cache !== "string" || !saved.accountId || !saved.cache) throw new MicrosoftMailConnectionRequiredError();
    return saved as MicrosoftConnection;
  } catch { throw new MicrosoftMailConnectionRequiredError(); }
}
async function saveConnection(connection: MicrosoftConnection) {
  const {supabase,userId,email} = await store();
  if (email !== connection.mailEmail) throw new MicrosoftMailConnectionRequiredError();
  const {error} = await supabase.from("microsoft_mail_connections").upsert({user_id:userId,token_ciphertext:sealMailToken(connection,process.env.MAIL_TOKEN_ENCRYPTION_SECRET!),updated_at:new Date().toISOString()},{onConflict:"user_id"});
  if (error) throw new Error("บันทึกสิทธิ์ Outlook ไม่สำเร็จ กรุณาตรวจ migration และสิทธิ์ฐานข้อมูล");
}
export async function getMicrosoftMailConnection(expectedEmail: string) {
  if (!microsoftMailConfigured()) return {connected:false,configured:false,error:new MicrosoftMailSetupError().message};
  const saved = await loadConnection();
  return {connected:!!saved && saved.mailEmail === expectedEmail.trim().toLowerCase(),configured:true};
}
export async function beginMicrosoftMailConnection(userId: string, email: string, returnTo: string, redirectUri: string) {
  const verifier = randomBytes(48).toString("base64url");
  const state: MicrosoftOAuthState = {state:randomUUID(),userId,returnTo,redirectUri,verifier,expiresAt:Date.now()+600_000};
  const url = await client().getAuthCodeUrl({scopes:MICROSOFT_MAIL_SCOPES,redirectUri,state:state.state,
    codeChallenge:createHash("sha256").update(verifier).digest("base64url"),codeChallengeMethod:"S256",loginHint:email,prompt:"select_account"});
  return {url,state};
}
export async function completeMicrosoftMailConnection(code: string, state: MicrosoftOAuthState, expectedEmail: string) {
  const {userId,email} = await store();
  if (userId !== state.userId || email !== expectedEmail.trim().toLowerCase()) throw new MicrosoftMailConnectionRequiredError();
  const app = client();
  const result = await app.acquireTokenByCode({code,scopes:MICROSOFT_MAIL_SCOPES,redirectUri:state.redirectUri,codeVerifier:state.verifier});
  if (!result?.account || !hasMicrosoftMailScopes(result.scopes)) throw new MicrosoftMailConnectionRequiredError();
  const mailEmail = await loadMicrosoftMailbox(result.accessToken,expectedEmail);
  await saveConnection({mailEmail,accountId:result.account.homeAccountId,cache:app.getTokenCache().serialize()});
}
export async function getQaMicrosoftSender(expectedEmail: string) {
  const app = client();
  const saved = await loadConnection();
  if (!saved || saved.mailEmail !== expectedEmail.trim().toLowerCase()) throw new MicrosoftMailConnectionRequiredError();
  app.getTokenCache().deserialize(saved.cache);
  const account = await app.getTokenCache().getAccountByHomeId(saved.accountId);
  if (!account) throw new MicrosoftMailConnectionRequiredError();
  const token = await app.acquireTokenSilent({account,scopes:MICROSOFT_GRAPH_SCOPES});
  if (!token || !hasMicrosoftMailScopes(token.scopes)) throw new MicrosoftMailConnectionRequiredError();
  await loadMicrosoftMailbox(token.accessToken,expectedEmail);
  // Persist refresh/cache changes before sending, so a storage failure cannot cause a hidden send.
  await saveConnection({...saved,cache:app.getTokenCache().serialize()});
  return async (message: ReturnType<typeof buildApprovalEmail>) => {
    if (message.from.address !== saved.mailEmail || message.replyTo !== saved.mailEmail) throw new MicrosoftMailConnectionRequiredError();
    return sendMicrosoftMessage(token.accessToken,message,randomUUID());
  };
}
