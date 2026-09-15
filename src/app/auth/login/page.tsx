import { redirect } from "next/navigation";
import Link from "next/link";
import { ClipboardCheck, LockKeyhole, LogIn, Mail, ShieldCheck } from "lucide-react";
import { destinationForRole, getCurrentAppSession } from "@/lib/app-session";
import { safeReturnTo } from "@/lib/google-user-oauth";
import { hasValidSupabasePublicConfig } from "@/lib/supabase/config";

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const next = safeReturnTo(typeof query.next === "string" ? query.next : null);
  const poLogin = next === "/approvals" || next.startsWith("/approvals/");
  const error = typeof query.error === "string" ? query.error : "";

  if (hasValidSupabasePublicConfig()) {
    const session = await getCurrentAppSession();
    if (session?.role) redirect(destinationForRole(session.role, next));
  }

  return (
    <main className="login-screen">
      <section className="login-card">
        <div className="login-brand"><span><ClipboardCheck size={24} /></span><div><strong>QA Workspace</strong><small>Test execution</small></div></div>
        <div className="login-copy"><p className="eyebrow">{poLogin ? "PO PORTAL" : "WELCOME BACK"}</p><h1>{poLogin ? "เข้าสู่ระบบเพื่อตรวจสอบผลทดสอบ" : "เข้าสู่ระบบเพื่อเริ่มทดสอบ"}</h1><p>เข้าสู่ระบบด้วยอีเมลที่ System Owner อนุมัติ ระบบจะพาไปหน้า QA Workspace หรือ PO Review ตามสิทธิ์โดยอัตโนมัติ</p></div>
        {error && <p className="login-error">{error}</p>}
        <form className="password-login-form" action="/auth/password/sign-in" method="post">
          <input type="hidden" name="next" value={next} />
          <label><span>อีเมล</span><div><Mail size={17} /><input type="email" name="email" required autoComplete="email" placeholder="name@company.com" /></div></label>
          <label><span>รหัสผ่าน</span><div><LockKeyhole size={17} /><input type="password" name="password" required autoComplete="current-password" placeholder="รหัสผ่าน" /></div></label>
          <Link className="forgot-password-link" href="/auth/forgot-password">ตั้งหรือลืมรหัสผ่าน</Link>
          <button className="google-login-button" type="submit">เข้าสู่ระบบ</button>
        </form>
        <div className="login-divider"><span>หรือ</span></div>
        <form action="/auth/sign-in" method="get">
          <input type="hidden" name="next" value={next} />
          <button className="google-login-option" type="submit"><LogIn size={18} />เข้าสู่ระบบด้วย Google</button>
        </form>
        <div className="login-security"><ShieldCheck size={16} /><span>ถ้ายังไม่มีรหัสผ่าน ให้เข้าสู่ระบบด้วย Google ครั้งแรก ระบบจะตรวจสิทธิ์และพาไปตั้งรหัสผ่านก่อนเข้าใช้งาน</span></div>
        <nav className="login-legal"><Link href="/privacy">Privacy Policy</Link><Link href="/terms">Terms of Service</Link></nav>
      </section>
    </main>
  );
}
