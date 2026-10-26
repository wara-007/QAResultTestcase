import { AccessCheckUnavailable } from "@/components/access-check-unavailable";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Clock3, LogIn, RefreshCw, ShieldCheck } from "lucide-react";
import { signOut } from "@/app/auth/actions";
import { authorizedDestination, pendingAccessDestination } from "@/lib/access-flow";
import { getCurrentAppSession } from "@/lib/app-session";
import { safeReturnTo } from "@/lib/google-user-oauth";

export default async function AccessDeniedPage({ searchParams }: { searchParams: Promise<{ email?: string; next?: string }> }) {
  const query = await searchParams;
  const next = safeReturnTo(query.next ?? null);
  const lookup = await getCurrentAppSession().then(session => ({session,error:false})).catch(() => ({session:null,error:true}));
    if (lookup.error) return <AccessCheckUnavailable next={next}/>;
    const session = lookup.session;

  if (session?.role) redirect(authorizedDestination(session.role, next, session.passwordConfigured));

  const email = session?.email ?? query.email?.trim().toLowerCase() ?? "";
  const refreshPath = pendingAccessDestination(email, next);

  return <main className="auth-screen">
    <section className="auth-card access-pending-card">
      <div className="auth-icon pending"><Clock3 size={25} /></div>
      <p className="eyebrow">WAITING FOR ACCESS</p>
      <h1>กำลังรอการยืนยันสิทธิ์</h1>
      <p>{session ? <>บัญชี <strong>{email}</strong> เข้าสู่ระบบสำเร็จแล้ว แต่ System Owner ยังไม่ได้เพิ่มสิทธิ์เข้าใช้งาน</> : "Session หมดอายุ กรุณาเข้าสู่ระบบอีกครั้งเพื่อตรวจสอบสิทธิ์"}</p>
      {session ? <>
        <div className="access-pending-note"><ShieldCheck size={17} /><span>เมื่อได้รับสิทธิ์แล้ว กดตรวจสอบอีกครั้งหรือรีเฟรชหน้านี้ ระบบจะพาเข้าสู่ Workspace อัตโนมัติ</span></div>
        <a className="primary-button access-refresh-button" href={refreshPath}><RefreshCw size={16} />ตรวจสอบสิทธิ์อีกครั้ง</a>
        <form action={signOut}><button className="secondary-button access-other-account" type="submit"><LogIn size={16} />ใช้บัญชีอื่น</button></form>
      </> : <Link className="primary-button access-refresh-button" href="/auth/login"><LogIn size={16} />กลับไปหน้า Login</Link>}
      <nav className="login-legal"><Link href="/privacy">Privacy Policy</Link><Link href="/terms">Terms of Service</Link></nav>
    </section>
  </main>;
}
