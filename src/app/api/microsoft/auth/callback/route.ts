import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { appOrigin } from "@/lib/google-user-oauth";
import { approvalSenderEmail, mailProvider, mailReturnTo, safeMailReturnTo } from "@/lib/mail-provider";
import { MicrosoftMailConnectionRequiredError, microsoftConnectFailure, validateMicrosoftState } from "@/lib/microsoft-mail";
import { completeMicrosoftMailConnection, MICROSOFT_STATE_COOKIE, openMicrosoftState } from "@/lib/microsoft-mail-server";

export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const origin = appOrigin(request.url);
  let returnTo = "/groups";
  let errorMessage: string | undefined;
  try {
    const supabase = await createClient();
    const {data,error} = await supabase.auth.getUser();
    if (error || !data.user?.email) throw new MicrosoftMailConnectionRequiredError();
    const cookie = request.cookies.get(MICROSOFT_STATE_COOKIE)?.value;
    if (!cookie) throw new MicrosoftMailConnectionRequiredError();
    const url = new URL(request.url);
    const state = validateMicrosoftState(openMicrosoftState(cookie),url.searchParams.get("state"),data.user.id,`${origin}/api/microsoft/auth/callback`);
    returnTo = safeMailReturnTo(state.returnTo);
    const code = url.searchParams.get("code");
    if (url.searchParams.has("error") || !code) throw new MicrosoftMailConnectionRequiredError();
    const senderEmail = approvalSenderEmail(state.senderEmail, data.user.email);
    if (mailProvider(senderEmail) !== "microsoft") throw new MicrosoftMailConnectionRequiredError();
    await completeMicrosoftMailConnection(code,state,senderEmail);
  } catch (reason) {
    errorMessage = microsoftConnectFailure(reason);
  }
  // Only return to the draft. Connecting a mailbox must never send the draft automatically.
  const response = NextResponse.redirect(new URL(mailReturnTo(returnTo,errorMessage),origin));
  response.headers.set("Cache-Control","no-store");
  response.cookies.set(MICROSOFT_STATE_COOKIE,"",{maxAge:0,path:"/api/microsoft/auth",httpOnly:true,sameSite:"lax",secure:origin.startsWith("https://")});
  return response;
}
