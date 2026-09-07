import { redirect } from "next/navigation";
import { ClipboardCheck, LogIn, ShieldCheck } from "lucide-react";
import { safeReturnTo } from "@/lib/google-user-oauth";
import { hasValidSupabasePublicConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const next = safeReturnTo(typeof query.next === "string" ? query.next : null);
  const error = typeof query.error === "string" ? query.error : "";

  if (hasValidSupabasePublicConfig()) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    if (data?.claims) redirect(next);
  }

  return (
    <main className="login-screen">
      <section className="login-card">
        <div className="login-brand"><span><ClipboardCheck size={24} /></span><div><strong>QA Workspace</strong><small>Test execution</small></div></div>
        <div className="login-copy"><p className="eyebrow">WELCOME BACK</p><h1>เข้าสู่ระบบเพื่อเริ่มทดสอบ</h1><p>ใช้บัญชี Google เพื่อเข้าถึง Projects, Google Sheets และแนบหลักฐานไปยัง Google Drive</p></div>
        {error && <p className="login-error">{error}</p>}
        <form action="/auth/sign-in" method="get">
          <input type="hidden" name="next" value={next} />
          <button className="google-login-button" type="submit"><LogIn size={19} />เข้าสู่ระบบด้วย Google</button>
        </form>
        <div className="login-security"><ShieldCheck size={16} /><span>ระบบขอสิทธิ์เฉพาะไฟล์ใน Drive ที่ QA Workspace สร้างหรือเปิดใช้งาน</span></div>
      </section>
    </main>
  );
}
