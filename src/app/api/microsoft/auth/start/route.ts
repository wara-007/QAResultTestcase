import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { appOrigin } from "@/lib/google-user-oauth";
import { approvalSenderEmail, mailProvider, safeMailReturnTo } from "@/lib/mail-provider";
import { microsoftConnectFailure } from "@/lib/microsoft-mail";
import { beginMicrosoftMailConnection, MICROSOFT_STATE_COOKIE, sealMicrosoftState } from "@/lib/microsoft-mail-server";

export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {data,error} = await supabase.auth.getUser();
    if (error || !data.user?.email) return NextResponse.json({error:"กรุณาเข้าสู่ระบบก่อนเชื่อม Outlook"},{status:401});
    const senderEmail = approvalSenderEmail(new URL(request.url).searchParams.get("senderEmail") ?? undefined, data.user.email);
    if (mailProvider(senderEmail) !== "microsoft") return NextResponse.json({error:"บัญชีนี้ไม่ได้ใช้ Microsoft 365 สำหรับส่งเมล"},{status:400});
    const origin = appOrigin(request.url);
    const returnTo = safeMailReturnTo(new URL(request.url).searchParams.get("returnTo"));
    const {url,state} = await beginMicrosoftMailConnection(data.user.id,senderEmail,returnTo,`${origin}/api/microsoft/auth/callback`);
    const response = NextResponse.redirect(url);
    response.headers.set("Cache-Control","no-store");
    response.cookies.set(MICROSOFT_STATE_COOKIE,sealMicrosoftState(state),{httpOnly:true,sameSite:"lax",secure:origin.startsWith("https://"),maxAge:600,path:"/api/microsoft/auth"});
    return response;
  } catch (reason) {
    return NextResponse.json({error:microsoftConnectFailure(reason)},{status:400});
  }
}
