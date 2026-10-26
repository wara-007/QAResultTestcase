import "server-only";
import { mailProvider, type MailConnection } from "./mail-provider";
import { canSendGoogleMail, gmailFailure } from "./google-mail";
import { getQaGmailSender, loadGoogleMailCredentials } from "./google-mail-server";
import { getMicrosoftMailConnection, getQaMicrosoftSender } from "./microsoft-mail-server";
import { MicrosoftMailSetupError, microsoftFailure } from "./microsoft-mail";

export async function getQaMailConnection(email: string): Promise<MailConnection> {
  const provider = mailProvider(email);
  if (!provider) return {email,provider,connected:false,configured:false,error:"รองรับบัญชี QA @gmail.com และ @truecorp.co.th สำหรับส่งเมล"};
  if (provider === "microsoft") return {email,provider,...await getMicrosoftMailConnection(email)};
  const configured = !!process.env.GOOGLE_OAUTH_CLIENT_ID && !!process.env.GOOGLE_OAUTH_CLIENT_SECRET && !!(process.env.GOOGLE_OAUTH_COOKIE_SECRET || process.env.PROJECT_ADMIN_SECRET);
  return {email,provider,configured,connected:configured && canSendGoogleMail(await loadGoogleMailCredentials(),email),
    ...(!configured ? {error:"ยังไม่ได้ตั้งค่าการส่ง Gmail กรุณาให้ผู้ดูแลตั้งค่า Google OAuth"} : {})};
}
export async function getQaMailSender(email: string) {
  const provider = mailProvider(email);
  if (!provider) throw new Error("รองรับบัญชี QA @gmail.com และ @truecorp.co.th สำหรับส่งเมล");
  return {provider,send:provider === "microsoft" ? await getQaMicrosoftSender(email) : await getQaGmailSender(email)};
}
export function qaMailPreparationFailure(reason: unknown, email: string) {
  if (reason instanceof MicrosoftMailSetupError) return {message:reason.message,reauthorize:false};
  if (reason instanceof Error && /migration|โหลดสิทธิ์|บันทึกสิทธิ์/.test(reason.message)) return {message:reason.message,reauthorize:false};
  if (!mailProvider(email)) return {message:"รองรับบัญชี QA @gmail.com และ @truecorp.co.th สำหรับส่งเมล",reauthorize:false};
  return mailProvider(email) === "microsoft" ? microsoftFailure(reason) : gmailFailure(reason);
}
