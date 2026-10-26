import type { buildApprovalEmail } from "./approval-email";

export const MICROSOFT_MAIL_SCOPES = ["openid", "profile", "email", "offline_access", "User.Read", "Mail.Send"];
export const MICROSOFT_GRAPH_SCOPES = ["User.Read", "Mail.Send"];
export class MicrosoftMailConnectionRequiredError extends Error {
  constructor() { super("กรุณาเชื่อม Microsoft 365 ด้วยอีเมลเดียวกับ QA ที่เข้าสู่ระบบ และอนุญาตส่งอีเมล"); this.name = "MicrosoftMailConnectionRequiredError"; }
}
export class MicrosoftMailSetupError extends Error {
  constructor() { super("ระบบยังไม่ได้ตั้งค่าการส่งเมล Microsoft 365 / Outlook กรุณาติดต่อผู้ดูแลระบบ"); this.name = "MicrosoftMailSetupError"; }
}
export function microsoftMailbox(profile: {mail?: string | null; userPrincipalName?: string | null}, expectedEmail: string) {
  const email = profile.mail?.trim().toLowerCase();
  // UPN can be a different sign-in alias. It is not proof of the primary From mailbox.
  if (!email || email !== expectedEmail.trim().toLowerCase()) throw new MicrosoftMailConnectionRequiredError();
  return email;
}
export function hasMicrosoftMailScopes(scopes: string[]) {
  const granted = new Set(scopes.map(scope => scope.toLowerCase().replace(/^https:\/\/graph\.microsoft\.com\//, "")));
  return MICROSOFT_GRAPH_SCOPES.every(scope => granted.has(scope.toLowerCase()));
}
export type MicrosoftOAuthState = {state: string; userId: string; returnTo: string; verifier: string; redirectUri: string; expiresAt: number};
export function validateMicrosoftState(value: unknown, state: string | null, userId: string, redirectUri: string, now = Date.now()): MicrosoftOAuthState {
  const saved = value as Partial<MicrosoftOAuthState> | null;
  if (!saved || !state || saved.state !== state || !userId || saved.userId !== userId || saved.redirectUri !== redirectUri
    || typeof saved.expiresAt !== "number" || !Number.isFinite(saved.expiresAt) || saved.expiresAt <= now
    || saved.expiresAt > now + 600_000 || typeof saved.returnTo !== "string"
    || typeof saved.verifier !== "string" || !/^[A-Za-z0-9._~-]{43,128}$/.test(saved.verifier)) throw new Error("Microsoft OAuth session หมดอายุหรือไม่ตรงกับบัญชี QA กรุณาเชื่อมใหม่");
  return saved as MicrosoftOAuthState;
}
export function microsoftFailure(reason: unknown): {message: string; reauthorize: boolean; uncertain: boolean} {
  const error = reason as {name?: string; status?: number; errorCode?: string} | null;
  if (error?.name === "MicrosoftMailConnectionRequiredError" || error?.name === "InteractionRequiredAuthError" || error?.status === 401
    || /^(invalid_grant|interaction_required|consent_required|login_required|no_tokens_found)$/.test(error?.errorCode ?? "")) {
    return {message:"สิทธิ์ส่ง Microsoft 365 ยังไม่พร้อมหรือถูกถอน กรุณาเชื่อมบัญชีใหม่",reauthorize:true,uncertain:false};
  }
  if (error?.status === 403) return {message:"Microsoft 365 ไม่อนุญาตให้ส่งเมล กรุณาให้ IT ตรวจสิทธิ์ Mail.Send และนโยบายองค์กร",reauthorize:false,uncertain:false};
  if (error?.status === 429) return {message:"Microsoft 365 จำกัดจำนวนการส่ง กรุณารอก่อนลองใหม่",reauthorize:false,uncertain:false};
  if (error?.status && error.status >= 400 && error.status < 500) return {message:"Microsoft 365 ปฏิเสธคำขอส่ง กรุณาตรวจผู้รับและติดต่อ IT หากยังส่งไม่ได้",reauthorize:false,uncertain:false};
  return {message:"ยังยืนยันการส่ง Microsoft 365 ไม่ได้ กรุณาตรวจ Sent Items ของ QA ก่อนส่งซ้ำ",reauthorize:false,uncertain:true};
}
export async function loadMicrosoftMailbox(accessToken: string, expectedEmail: string, request: typeof fetch = fetch) {
  const response = await request("https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName", {
    headers:{Authorization:`Bearer ${accessToken}`}, cache:"no-store", signal:AbortSignal.timeout(15_000), redirect:"error",
  });
  if (!response.ok) throw Object.assign(new Error("Microsoft profile request failed"),{status:response.status});
  return microsoftMailbox(await response.json(), expectedEmail);
}
export async function sendMicrosoftMessage(accessToken: string, message: ReturnType<typeof buildApprovalEmail>, operationId: string, request: typeof fetch = fetch) {
  const address = (email: string) => ({emailAddress:{address:email}});
  const response = await request("https://graph.microsoft.com/v1.0/me/sendMail", {
    method:"POST", headers:{Authorization:`Bearer ${accessToken}`,"Content-Type":"application/json","client-request-id":operationId},
    body:JSON.stringify({message:{subject:message.subject,body:{contentType:"Text",content:message.text},
      toRecipients:[address(message.to)],ccRecipients:message.cc.map(address),replyTo:[address(message.replyTo)]},saveToSentItems:true}),
    cache:"no-store", signal:AbortSignal.timeout(20_000), redirect:"error",
  });
  if (response.status !== 202) throw Object.assign(new Error("Microsoft send request failed"),{status:response.status});
  // Graph returns no message ID. This is a local correlation reference only.
  return {accepted:[message.to,...message.cc],rejected:[],messageId:"",operationId};
}

export function microsoftConnectFailure(reason: unknown) {
  if (reason instanceof MicrosoftMailSetupError || reason instanceof MicrosoftMailConnectionRequiredError) return reason.message;
  const failure = microsoftFailure(reason);
  return failure.uncertain ? "เชื่อม Microsoft 365 ไม่สำเร็จ กรุณาลองใหม่หรือติดต่อ IT เพื่อตรวจสิทธิ์แอป" : failure.message;
}
