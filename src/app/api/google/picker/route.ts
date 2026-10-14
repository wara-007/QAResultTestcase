import { createClient } from "@/lib/supabase/server";
import { getGoogleUserAuth, GoogleConnectionRequiredError, safeReturnTo } from "@/lib/google-user-oauth";
import { requireProjectCapability, ProjectAccessError } from "@/lib/project-access-server";
import { pickerConfiguration } from "@/lib/google-picker";
import { pickerSessionResponse } from "@/lib/google-picker-session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  // Only the short-lived access token is handed to Google's browser picker.
  // Refresh tokens, OAuth secrets and service-account credentials stay server-side.
  return pickerSessionResponse(request, {
    authorize: async projectId => {
      if (projectId) return requireProjectCapability(projectId, "view");
      const supabase = await createClient();
      const { data, error } = await supabase.auth.getClaims();
      if (error || typeof data?.claims?.sub !== "string") throw new ProjectAccessError("กรุณาเข้าสู่ระบบก่อนเลือกไฟล์", 401);
    },
    config: () => {
      try { return pickerConfiguration(process.env); }
      catch (error) { throw Object.assign(error as Error, { status: 503 }); }
    },
    token: async () => {
      try {
        const { token } = await (await getGoogleUserAuth()).getAccessToken();
        if (!token) throw new Error("ขอสิทธิ์ Google ไม่สำเร็จ");
        return token;
      } catch (reason) {
        if (reason instanceof GoogleConnectionRequiredError) {
          const referer = request.headers.get("referer");
          let returnTo = "/groups";
          if (referer) {
            const url = new URL(referer);
            if (url.origin === new URL(request.url).origin) returnTo = safeReturnTo(`${url.pathname}${url.search}`);
          }
          throw Object.assign(reason, { status: 401, authUrl: `/api/google/auth/start?returnTo=${encodeURIComponent(returnTo)}` });
        }
        throw reason;
      }
    },
  });
}
